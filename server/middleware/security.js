const helmet = require('helmet');
const cors = require('cors');
const { rateLimit, MemoryStore } = require('express-rate-limit');
const crypto = require('crypto');

/**
 * Djadwal Security Perimeter Middleware Suite
 * 
 * Implements:
 * 1. Strict HTTP Security Headers (Helmet, HSTS, CSP Report-Only, Permissions-Policy).
 * 2. Origin-Restricted CORS Whitelist with preflight caching.
 * 3. Two-Tier Rate Limiting (General: 300 req/min, Sensitive: 10 req/min).
 * 4. Double-Submit Cookie CSRF Protection for state-mutating endpoints.
 * 5. Unified 413 (Payload Too Large) and 429 (Rate Limit Exceeded) handlers.
 * 
 * Entire suite guarded by FEATURE_HTTP_HARDENING feature flag.
 */

const isProduction = process.env.NODE_ENV === 'production';
const isHardeningEnabled = process.env.FEATURE_HTTP_HARDENING !== 'false';

// --- 1. Allowed CORS Origins Whitelist ---
function getAllowedOrigins() {
  const envOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
    : [];

  const defaults = [
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5000',
    'http://localhost:5050',
    'https://djadwal.onrender.com'
  ];

  if (process.env.CORS_ORIGIN) {
    defaults.push(process.env.CORS_ORIGIN.trim());
  }

  return Array.from(new Set([...defaults, ...envOrigins])).filter(Boolean);
}

const allowedOriginsList = getAllowedOrigins();

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, Electron file://)
    if (!origin) return callback(null, true);

    if (allowedOriginsList.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS_NOT_ALLOWED: Origin ${origin} is not authorized`));
  },
  credentials: true,
  maxAge: 86400, // 24 hours preflight cache
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-csrf-token',
    'x-user-id',
    'x-user-name'
  ]
});

// --- 2. Helmet Security Headers ---
const helmetMiddleware = helmet({
  // Red Line 1: CSP must run in Report-Only mode for the first week
  contentSecurityPolicy: {
    reportOnly: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "https://openrouter.ai"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false, // Prevent breaking PDF embeds
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
});

// Additional Custom Headers (Permissions-Policy)
function permissionsPolicyMiddleware(req, res, next) {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  next();
}

// --- 3. Rate Limiters ---
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'تم تجاوز الحد المسموح به من الطلبات العامة (300 طلب/دقيقة). يرجى الانتظار قليلاً.'
    });
  }
});

const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    res.status(429).json({
      error: 'SENSITIVE_RATE_LIMIT_EXCEEDED',
      message: 'تم تجاوز الحد المسموح به للعمليات الحساسة (10 طلبات/دقيقة). يرجى الانتظار دقيقة كاملة.'
    });
  }
});

// --- 4. Double-Submit CSRF Protection ---
function csrfProtectionMiddleware(req, res, next) {
  // If hardening is disabled via feature flag, pass through
  if (!isHardeningEnabled) return next();

  // 1. Ensure csrf_token cookie exists on client
  let csrfToken = req.cookies?.csrf_token;
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(24).toString('hex');
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false, // Must be readable by client JS to include in x-csrf-token header
      sameSite: 'lax',
      path: '/',
      secure: isProduction
    });
  }

  // 2. Safe idempotent methods do not mutate state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  // 3. Exempted paths (OAuth callbacks, initial login without prior cookie, public status)
  const exemptedPaths = [
    '/api/email/oauth2callback',
    '/api/status',
    '/api/auth/login' // Login establishes session; protected by rate limiter
  ];

  if (exemptedPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  // 4. Verify double-submit header against cookie
  const headerToken = req.headers['x-csrf-token'];
  if (!headerToken || !csrfToken || headerToken !== csrfToken) {
    return res.status(403).json({
      error: 'CSRF_TOKEN_INVALID',
      message: 'رمز التحقق ضد التزوير (CSRF) مفقود أو غير مطابق. يرجى إعادة تحميل الصفحة.'
    });
  }

  next();
}

// --- 5. Unified Error Handler (413 & CORS & Rate-limit) ---
function securityErrorHandler(err, req, res, next) {
  if (err.type === 'entity.too.large' || err.status === 413 || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'PAYLOAD_TOO_LARGE',
      message: 'حجم البيانات المرسلة يتجاوز الحد الأقصى المسموح به (256KB للبيانات و 5MB للملفات).'
    });
  }

  if (err.message && err.message.startsWith('CORS_NOT_ALLOWED')) {
    return res.status(403).json({
      error: 'CORS_FORBIDDEN',
      message: 'الأصل البرمجي الذي أرسل الطلب غير مصرح له بالوصول إلى هذا الخادم.'
    });
  }

  next(err);
}

module.exports = {
  isHardeningEnabled,
  allowedOriginsList,
  corsMiddleware,
  helmetMiddleware,
  permissionsPolicyMiddleware,
  generalLimiter,
  sensitiveLimiter,
  csrfProtectionMiddleware,
  securityErrorHandler
};
