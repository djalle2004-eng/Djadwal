const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { URL } = require('url');

/**
 * Djadwal Secure PDF Renderer Service
 * Enterprise-grade, hardened PDF rendering engine.
 * 
 * Mitigations:
 * 1. SSRF & Internal Network: Blackhole proxy, blackhole DNS, Puppeteer request interception blocking file://, 169.254.169.254, RFC1918.
 * 2. Path Traversal: UUID storage filenames, strict path.resolve validation, sanitized download headers.
 * 3. Resource Exhaustion: Bounded browser pool, page recycling (50 uses), 15s timeout, 2MB payload ceiling, in-memory queue.
 * 4. Disk Exhaustion: Automated 10-minute temp file cleanup, 50MB quota enforcement.
 */

const TEMP_DIR = path.resolve(__dirname, '../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const POOL_SIZE = Math.max(1, parseInt(process.env.PDF_POOL_SIZE || '2', 10));
const RENDER_TIMEOUT_MS = parseInt(process.env.PDF_RENDER_TIMEOUT_MS || '15000', 10);
const MAX_HTML_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_PAGE_USES = 50;
const MAX_TEMP_AGE_MS = 10 * 60 * 1000; // 10 minutes
const MAX_TEMP_DIR_BYTES = 50 * 1024 * 1024; // 50MB

// Metrics & Security Auditing
const metrics = {
  totalRenders: 0,
  successfulRenders: 0,
  failedRenders: 0,
  blockedRequestsCount: 0,
  recentSecurityEvents: []
};

function logSecurityEvent(type, details) {
  metrics.blockedRequestsCount++;
  const event = {
    timestamp: new Date().toISOString(),
    type,
    details
  };
  metrics.recentSecurityEvents.unshift(event);
  if (metrics.recentSecurityEvents.length > 50) {
    metrics.recentSecurityEvents.pop();
  }
  console.warn(`🚨 [SEC-AUDIT] PDF Renderer Security Violation [${type}]:`, JSON.stringify(details));
}

// Check if an IP/hostname belongs to private or cloud metadata ranges
function isPrivateOrMetadataHost(hostname) {
  if (!hostname) return true;
  const lower = hostname.toLowerCase();
  
  if (
    lower === '169.254.169.254' || // AWS/GCP/Azure/DO Metadata
    lower === 'metadata.google.internal' ||
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1'
  ) {
    return true;
  }

  // IPv4 private ranges check (RFC 1918 / RFC 3927)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = lower.match(ipv4Regex);
  if (match) {
    const oct1 = parseInt(match[1], 10);
    const oct2 = parseInt(match[2], 10);
    if (oct1 === 10) return true; // 10.0.0.0/8
    if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) return true; // 172.16.0.0/12
    if (oct1 === 192 && oct2 === 168) return true; // 192.168.0.0/16
    if (oct1 === 169 && oct2 === 254) return true; // 169.254.0.0/16 Link-local
    if (oct1 === 127) return true; // 127.0.0.0/8 Loopback
  }

  return false;
}

function getExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// Bounded Browser Pool Manager
class BrowserPool {
  constructor(size) {
    this.size = size;
    this.browsers = [];
    this.useCounts = new Map();
    this.queue = [];
    this.activeRenders = 0;
  }

  async getBrowser() {
    // Purge disconnected browsers
    this.browsers = this.browsers.filter(b => b.isConnected());

    if (this.browsers.length < this.size) {
      const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          // Blackhole proxy & DNS to prevent Chromium-level egress
          '--proxy-server=http://127.0.0.1:1',
          '--host-resolver-rules=MAP * ~NOTFOUND',
          '--disable-features=site-per-process,AudioServiceOutOfProcess'
        ]
      };
      const execPath = getExecutablePath();
      if (execPath) {
        launchOptions.executablePath = execPath;
      }

      const browser = await puppeteer.launch(launchOptions);
      this.browsers.push(browser);
      this.useCounts.set(browser, 0);
      return browser;
    }

    // Pick least-used browser
    this.browsers.sort((a, b) => (this.useCounts.get(a) || 0) - (this.useCounts.get(b) || 0));
    return this.browsers[0];
  }

  async acquirePage() {
    const browser = await this.getBrowser();
    const currentUses = (this.useCounts.get(browser) || 0) + 1;
    this.useCounts.set(browser, currentUses);

    // If browser exceeded lifetime threshold, cycle it after this render
    const shouldRecycle = currentUses >= MAX_PAGE_USES;

    const page = await browser.newPage();

    // Enable strict request interception
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      try {
        const reqUrl = req.url();
        const parsed = new URL(reqUrl);
        const protocol = parsed.protocol.toLowerCase();
        const hostname = parsed.hostname.toLowerCase();

        // 1. Allow inline data URIs (Base64 fonts / images)
        if (protocol === 'data:') {
          return req.continue();
        }

        // 2. Block file:// scheme entirely (Prevents arbitrary local file disclosure /etc/passwd, .env)
        if (protocol === 'file:') {
          logSecurityEvent('BLOCKED_FILE_PROTOCOL', { url: reqUrl });
          return req.abort('blockedbyclient');
        }

        // 3. Block Metadata & Internal Private IPs (SSRF)
        if (isPrivateOrMetadataHost(hostname)) {
          logSecurityEvent('BLOCKED_SSRF_INTERNAL', { url: reqUrl, hostname });
          return req.abort('blockedbyclient');
        }

        // 4. Block all other egress
        logSecurityEvent('BLOCKED_EGRESS_NETWORK', { url: reqUrl });
        return req.abort('blockedbyclient');
      } catch (err) {
        logSecurityEvent('MALFORMED_URL_REQUEST', { error: err.message });
        req.abort('blockedbyclient');
      }
    });

    return {
      page,
      browser,
      release: async () => {
        try {
          if (!page.isClosed()) {
            await page.close();
          }
        } catch (e) {}

        if (shouldRecycle && browser.isConnected()) {
          try {
            await browser.close();
            this.browsers = this.browsers.filter(b => b !== browser);
            this.useCounts.delete(browser);
          } catch (e) {}
        }
      }
    };
  }

  async runWithConcurrencyLimit(task) {
    if (this.activeRenders >= this.size) {
      if (this.queue.length >= 20) {
        const queueErr = new Error('خادم توليد المستندات محمل بالكامل، يرجى المحاولة بعد قليل');
        queueErr.statusCode = 429;
        throw queueErr;
      }
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const idx = this.queue.indexOf(resume);
          if (idx !== -1) this.queue.splice(idx, 1);
          const timeoutErr = new Error('انتهت مهلة انتظار طابور المعالجة');
          timeoutErr.statusCode = 504;
          reject(timeoutErr);
        }, 30000);

        const resume = () => {
          clearTimeout(timeout);
          resolve();
        };
        this.queue.push(resume);
      });
    }

    this.activeRenders++;
    try {
      return await task();
    } finally {
      this.activeRenders--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }

  async closeAll() {
    for (const browser of this.browsers) {
      try {
        if (browser.isConnected()) await browser.close();
      } catch (e) {}
    }
    this.browsers = [];
    this.useCounts.clear();
  }
}

const pool = new BrowserPool(POOL_SIZE);

// Graceful cleanup on server shutdown
process.on('SIGINT', () => pool.closeAll());
process.on('SIGTERM', () => pool.closeAll());

// Sanitize user download filename
function sanitizeDownloadFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return `document-${Date.now()}.pdf`;
  }
  // Strip paths, null bytes, and dangerous characters
  let clean = path.basename(filename).replace(/[^\w\s.\u0600-\u06FF-]/gi, '_').trim();
  if (!clean.toLowerCase().endsWith('.pdf')) {
    clean += '.pdf';
  }
  if (clean.length > 100) {
    clean = clean.slice(0, 96) + '.pdf';
  }
  return clean || `document-${Date.now()}.pdf`;
}

// Background Temp Directory Garbage Collector
function cleanOldTempFiles() {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;
    const now = Date.now();
    const files = fs.readdirSync(TEMP_DIR);
    let totalSize = 0;
    const fileStats = [];

    for (const file of files) {
      const fullPath = path.join(TEMP_DIR, file);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
        totalSize += stat.size;
        fileStats.push({ file, fullPath, mtimeMs: stat.mtimeMs, size: stat.size });

        // Remove if older than MAX_TEMP_AGE_MS (10 min)
        if (now - stat.mtimeMs > MAX_TEMP_AGE_MS) {
          fs.unlinkSync(fullPath);
        }
      } catch (err) {}
    }

    // If still over MAX_TEMP_DIR_BYTES (50MB), purge oldest first
    if (totalSize > MAX_TEMP_DIR_BYTES) {
      fileStats.sort((a, b) => a.mtimeMs - b.mtimeMs);
      for (const item of fileStats) {
        try {
          if (fs.existsSync(item.fullPath)) {
            fs.unlinkSync(item.fullPath);
            totalSize -= item.size;
            if (totalSize <= MAX_TEMP_DIR_BYTES / 2) break;
          }
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error('Failed to run temp directory cleanup:', err);
  }
}

// Run cleanup every 5 minutes (unref to avoid hanging process exit)
const cleanupInterval = setInterval(cleanOldTempFiles, 5 * 60 * 1000);
if (cleanupInterval.unref) cleanupInterval.unref();

/**
 * Main Secure Render Method
 */
async function renderHtmlToPdf(rawHtml, options = {}) {
  metrics.totalRenders++;
  const startTime = Date.now();

  if (!rawHtml || typeof rawHtml !== 'string') {
    metrics.failedRenders++;
    const err = new Error('محتوى HTML مطلوب للتوليد');
    err.statusCode = 400;
    throw err;
  }

  // 1. Payload Size Guard (2MB Max)
  const byteLength = Buffer.byteLength(rawHtml, 'utf8');
  if (byteLength > MAX_HTML_SIZE_BYTES) {
    metrics.failedRenders++;
    const err = new Error(`حجم HTML يتجاوز الحد المسموح به (2MB). الحجم المرسل: ${(byteLength / 1024 / 1024).toFixed(2)}MB`);
    err.statusCode = 413;
    throw err;
  }

  // 2. Strict Path Traversal Mitigation
  const safeFileUuid = `${crypto.randomUUID()}.pdf`;
  const outputPath = path.resolve(TEMP_DIR, safeFileUuid);

  // Assertion: Ensure outputPath cannot escape TEMP_DIR
  if (!outputPath.startsWith(TEMP_DIR)) {
    logSecurityEvent('PATH_TRAVERSAL_ATTEMPT', { target: outputPath });
    metrics.failedRenders++;
    const err = new Error('محاولة غير مصرح بها لاجتياز المسار');
    err.statusCode = 400;
    throw err;
  }

  const downloadFilename = sanitizeDownloadFilename(options.filename);

  const pdfOptions = {
    format: options.format || 'A4',
    landscape: Boolean(options.landscape),
    margin: options.margins || {
      top: '1cm',
      right: '1cm',
      bottom: '1cm',
      left: '1cm'
    },
    printBackground: true
  };

  // 3. Render through Concurrency-Limited Browser Pool
  return await pool.runWithConcurrencyLimit(async () => {
    let pageResource = null;
    try {
      pageResource = await pool.acquirePage();
      const { page } = pageResource;

      // Set timeout
      page.setDefaultTimeout(RENDER_TIMEOUT_MS);
      page.setDefaultNavigationTimeout(RENDER_TIMEOUT_MS);

      // Render content
      await page.setContent(rawHtml, {
        waitUntil: 'networkidle0',
        timeout: RENDER_TIMEOUT_MS
      });

      // Write PDF to disk inside guaranteed safe path
      await page.pdf({
        path: outputPath,
        ...pdfOptions
      });

      const durationMs = Date.now() - startTime;
      const fileStat = fs.statSync(outputPath);
      metrics.successfulRenders++;

      return {
        outputPath,
        safeFileName: safeFileUuid,
        downloadFilename,
        durationMs,
        sizeBytes: fileStat.size,
        cleanup: async () => {
          try {
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
          } catch (e) {}
        }
      };
    } catch (renderError) {
      metrics.failedRenders++;
      // Clean up orphaned file on error
      if (fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch (e) {}
      }

      if (renderError.name === 'TimeoutError') {
        const timeoutErr = new Error('استغرقت معالجة المستند وقتًا أطول من الحد المسموح (15 ثانية)');
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }
      throw renderError;
    } finally {
      if (pageResource) {
        await pageResource.release();
      }
    }
  });
}

function getRendererStats() {
  return {
    poolSize: POOL_SIZE,
    activeRenders: pool.activeRenders,
    queueLength: pool.queue.length,
    metrics
  };
}

module.exports = {
  renderHtmlToPdf,
  sanitizeDownloadFilename,
  cleanOldTempFiles,
  getRendererStats,
  shutdownRenderer: () => pool.closeAll()
};
