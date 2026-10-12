import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';

// Import service modules
const {
  renderHtmlToPdf,
  sanitizeDownloadFilename,
  getRendererStats,
  cleanOldTempFiles,
  shutdownRenderer
} = require('../../../server/services/renderer');

const {
  renderTemplate,
  listTemplates,
  escapeHtml
} = require('../../../server/services/templates');

const app = require('../../../server/server');

describe('P3 PDF Renderer Hardening & Isolation Suite', () => {

  afterAll(async () => {
    await shutdownRenderer();
  });

  describe('1. Path Traversal & Filename Sanitization', () => {
    it('sanitizes malicious directory traversal filenames in download headers', () => {
      expect(sanitizeDownloadFilename('../../.env')).toBe('.env.pdf');
      expect(sanitizeDownloadFilename('..\\..\\Windows\\System32\\cmd.exe')).toBe('cmd.exe.pdf');
      expect(sanitizeDownloadFilename('null\0byte_attack.pdf')).not.toContain('\0');
      expect(sanitizeDownloadFilename('جدول_التوقيت_2026.pdf')).toBe('جدول_التوقيت_2026.pdf');
      expect(sanitizeDownloadFilename('')).toMatch(/^document-\d+\.pdf$/);
    });

    it('ensures internal generated PDF files are strictly written inside temp directory with UUID', async () => {
      const result = await renderHtmlToPdf('<h1>Test PDF</h1>', {
        filename: '../../../../etc/shadow'
      });

      const tempDir = path.resolve(__dirname, '../../../server/temp');
      expect(result.outputPath.startsWith(tempDir)).toBe(true);
      expect(result.safeFileName).toMatch(/^[0-9a-f-]{36}\.pdf$/);
      expect(result.downloadFilename).toBe('shadow.pdf');
      expect(fs.existsSync(result.outputPath)).toBe(true);

      // Clean up
      await result.cleanup();
      expect(fs.existsSync(result.outputPath)).toBe(false);
    });
  });

  describe('2. SSRF, Metadata, and File Scheme Interception', () => {
    it('blocks external, cloud metadata (169.254.169.254), and local file:// requests inside Chromium', async () => {
      const initialStats = getRendererStats();
      const initialBlocked = initialStats.metrics.blockedRequestsCount;

      const maliciousHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>SSRF Test</title></head>
        <body>
          <h1>Testing SSRF Mitigation</h1>
          <!-- Attempt cloud metadata access -->
          <img src="http://169.254.169.254/latest/meta-data/iam/security-credentials/" />
          <!-- Attempt local file read -->
          <iframe src="file:///etc/passwd"></iframe>
          <!-- Attempt local network loopback -->
          <img src="http://127.0.0.1:3001/api/users" />
          <!-- Attempt external egress -->
          <img src="https://evil-attacker.com/leak.png" />
          <!-- Safe inline base64 image (allowed) -->
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" />
        </body>
        </html>
      `;

      const result = await renderHtmlToPdf(maliciousHtml, { filename: 'ssrf-test.pdf' });
      await result.cleanup();

      const updatedStats = getRendererStats();
      // Blocked requests count must have increased due to intercepted malicious resources
      expect(updatedStats.metrics.blockedRequestsCount).toBeGreaterThan(initialBlocked);
      expect(updatedStats.metrics.recentSecurityEvents.length).toBeGreaterThan(0);
    });
  });

  describe('3. Payload Size Guard & Input Validation', () => {
    it('rejects raw HTML payloads exceeding the 2MB ceiling with 413 error', async () => {
      // 2.5MB payload
      const hugeHtml = '<div>' + 'A'.repeat(2.5 * 1024 * 1024) + '</div>';

      await expect(renderHtmlToPdf(hugeHtml)).rejects.toThrow(/حجم HTML يتجاوز الحد المسموح به/);
    });

    it('rejects empty or non-string inputs with 400 error', async () => {
      await expect(renderHtmlToPdf('')).rejects.toThrow(/محتوى HTML مطلوب للتوليد/);
      await expect(renderHtmlToPdf(null as any)).rejects.toThrow();
    });
  });

  describe('4. Signed Templates Engine', () => {
    it('renders timetable template with valid structured data and escapes inputs', () => {
      const timetableData = {
        department: 'علوم التسيير',
        academicYear: '2025/2026',
        semester: 'السداسي الثاني',
        title: 'جدول الحصص الأسبوعي <script>alert(1)</script>',
        sessions: [
          {
            day: 'الأحد',
            time: '08:00 - 09:30',
            module: 'رياضيات مالية',
            professor: 'د. أحمد بن علي',
            room: 'مدرج 3',
            group: 'فوج 1'
          }
        ]
      };

      const html = renderTemplate('timetable', timetableData);
      expect(html).toContain('جامعة الشهيد حمه لخضر - الوادي');
      expect(html).toContain('رياضيات مالية');
      expect(html).toContain('د. أحمد بن علي');
      // Verify XSS escaping
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('validates schema and rejects invalid template data with Zod error', () => {
      expect(() => {
        renderTemplate('timetable', {
          department: '', // Invalid: min(1)
          academicYear: '2025/2026'
        });
      }).toThrow();
    });

    it('lists all available pre-vetted signed templates', () => {
      const templates = listTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(3);
      const ids = templates.map((t: any) => t.id);
      expect(ids).toContain('timetable');
      expect(ids).toContain('certificate');
      expect(ids).toContain('announcement');
    });

    it('escapes dangerous HTML characters properly', () => {
      expect(escapeHtml('<div class="danger">"Hello" & \'World\'</div>')).toBe(
        '&lt;div class=&quot;danger&quot;&gt;&quot;Hello&quot; &amp; &#039;World&#039;&lt;/div&gt;'
      );
    });
  });

  describe('5. HTTP API Endpoints & Zero-Downtime Signature', () => {
    it('POST /api/generate-pdf renders raw HTML with application/pdf response', async () => {
      const res = await request(app)
        .post('/api/generate-pdf')
        .set('Cookie', ['csrf_token=test_csrf_token_p3'])
        .set('x-csrf-token', 'test_csrf_token_p3')
        .send({
          html: '<h1 style="color: blue;">تقرير تجريبي آمن</h1>',
          options: { filename: 'report-sample.pdf' }
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('report-sample.pdf');
    });

    it('POST /api/generate-pdf supports signed templates directly via templateId', async () => {
      const res = await request(app)
        .post('/api/generate-pdf')
        .set('Cookie', ['csrf_token=test_csrf_token_p3'])
        .set('x-csrf-token', 'test_csrf_token_p3')
        .send({
          templateId: 'announcement',
          templateData: {
            title: 'إعلان هام للطلبة',
            content: 'يرجى الالتزام بمواعيد الامتحانات المحددة.',
            department: 'قسم الاقتصاد'
          },
          options: { filename: 'official-announcement.pdf' }
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('POST /api/generate-pdf supports asynchronous batch queue (202 Accepted)', async () => {
      const res = await request(app)
        .post('/api/generate-pdf')
        .set('Cookie', ['csrf_token=test_csrf_token_p3'])
        .set('x-csrf-token', 'test_csrf_token_p3')
        .send({
          html: '<h1>Async PDF Job</h1>',
          options: { async: true, filename: 'async-batch.pdf' }
        });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('queued');
      expect(res.body.jobId).toBeDefined();
      expect(res.body.pollUrl).toBeDefined();

      // Poll status endpoint
      const pollRes = await request(app).get(res.body.pollUrl);
      expect([200, 404]).toContain(pollRes.status);
    });

    it('GET /api/pdf-templates returns registered templates', async () => {
      const res = await request(app).get('/api/pdf-templates');
      expect(res.status).toBe(200);
      expect(res.body.templates).toBeDefined();
      expect(res.body.templates.length).toBeGreaterThanOrEqual(3);
    });

    it('GET /api/pdf-stats exposes renderer pool status and security audit telemetry', async () => {
      const res = await request(app).get('/api/pdf-stats');
      expect(res.status).toBe(200);
      expect(res.body.poolSize).toBeDefined();
      expect(res.body.metrics).toBeDefined();
      expect(res.body.metrics.totalRenders).toBeGreaterThan(0);
    });
  });

  describe('6. Housekeeping & Resource Cleanliness', () => {
    it('runs garbage collection without errors on temp directory', () => {
      expect(() => cleanOldTempFiles()).not.toThrow();
    });
  });
});
