import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../server/server.js';

describe('P2 HTTP Perimeter & Hardening Test Suite', () => {

  // --- 1. CORS Whitelist Validation ---
  describe('1. CORS Origin Protection', () => {
    it('Allows requests from authorized origins with credentials', async () => {
      const res = await request(app)
        .get('/api/status')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('Rejects requests from unauthorized foreign origins with 403', async () => {
      const res = await request(app)
        .get('/api/status')
        .set('Origin', 'https://malicious-attacker.com');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CORS_FORBIDDEN');
    });

    it('Allows requests with no origin (Electron desktop / same-origin)', async () => {
      const res = await request(app).get('/api/status');
      expect(res.status).toBe(200);
    });
  });

  // --- 2. Security Headers (Helmet, CSP Report-Only, Frameguard) ---
  describe('2. Security Headers', () => {
    it('Emits X-Frame-Options: DENY to prevent clickjacking', async () => {
      const res = await request(app).get('/api/status');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('Emits Referrer-Policy: strict-origin-when-cross-origin', async () => {
      const res = await request(app).get('/api/status');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('Emits Content-Security-Policy-Report-Only (Red Line 1: Zero breaking changes in initial release)', async () => {
      const res = await request(app).get('/api/status');
      expect(res.headers['content-security-policy-report-only']).toBeDefined();
      expect(res.headers['content-security-policy-report-only']).toContain("frame-ancestors 'none'");
    });

    it('Emits restricted Permissions-Policy header', async () => {
      const res = await request(app).get('/api/status');
      expect(res.headers['permissions-policy']).toBeDefined();
      expect(res.headers['permissions-policy']).toContain('camera=()');
    });
  });

  // --- 3. Double-Submit CSRF Protection ---
  describe('3. Double-Submit CSRF Guard', () => {
    it('Issues csrf_token cookie on incoming GET requests', async () => {
      const res = await request(app).get('/api/status');
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.startsWith('csrf_token='))).toBe(true);
    });

    it('Rejects state-mutating requests when x-csrf-token header is missing with 403', async () => {
      const res = await request(app)
        .post('/api/departments')
        .set('Cookie', ['csrf_token=valid_csrf_token_abc123'])
        .send({ name: 'Département Test', code: 'TEST' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF_TOKEN_INVALID');
      expect(res.body.message).toContain('CSRF');
    });

    it('Rejects state-mutating requests when x-csrf-token does not match cookie', async () => {
      const res = await request(app)
        .post('/api/departments')
        .set('Cookie', ['csrf_token=secret_token_111'])
        .set('x-csrf-token', 'tampered_token_222')
        .send({ name: 'Département Test', code: 'TEST' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF_TOKEN_INVALID');
    });
  });

  // --- 4. Request Payload Limits (256KB) ---
  describe('4. Request Payload Limits', () => {
    it('Rejects JSON payloads exceeding 256KB with 413 Payload Too Large', async () => {
      const largeString = 'a'.repeat(300 * 1024); // 300KB > 256KB limit
      const csrfToken = 'test_token_payload';

      const res = await request(app)
        .post('/api/departments')
        .set('Cookie', [`csrf_token=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send({ bigData: largeString });

      expect(res.status).toBe(413);
      expect(res.body.error).toBe('PAYLOAD_TOO_LARGE');
      expect(res.body.message).toContain('256KB');
    });
  });

  // --- 5. Sensitive Rate Limiting (/api/generate-pdf) ---
  describe('5. Rate Limiting Protection', () => {
    it('Enforces sensitive rate limit on /api/generate-pdf returning 429 when threshold exceeded', async () => {
      const ip = '198.51.100.42'; // Unique test IP
      const requests = [];

      // Sensitive limiter max is 10 requests/minute
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .post('/api/generate-pdf')
            .set('X-Forwarded-For', ip)
            .send({})
        );
      }

      const responses = await Promise.all(requests);
      const wasRateLimited = responses.some(r => r.status === 429);
      expect(wasRateLimited).toBe(true);

      const rateLimitedRes = responses.find(r => r.status === 429);
      expect(rateLimitedRes?.body.error).toBe('SENSITIVE_RATE_LIMIT_EXCEEDED');
    });
  });

});
