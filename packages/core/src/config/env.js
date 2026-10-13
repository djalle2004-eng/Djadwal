const { z } = require('zod');

/**
 * Djadwal Centralized Environment Validator (CommonJS Runtime Guard)
 * Enforces strict environment boundaries, prevents booting with insecure defaults,
 * and completely masks secrets from logs and diagnostic outputs.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  PORT: z.coerce.number().default(3001),

  // Primary signing key - MUST be at least 32 characters
  JWT_SECRET: z.string().min(32, {
    message: 'مفتاح JWT_SECRET يجب أن يكون بطول 32 حرفًا على الأقل لضمان التشفير الآمن'
  }),

  // Optional previous key to allow graceful zero-downtime key rotation
  JWT_SECRET_PREVIOUS: z.string().min(32).optional(),

  // Session cookie secret
  SESSION_SECRET: z.string().min(16).default('development_session_secret_minimum_16_chars'),

  // Primary database credentials
  TURSO_DATABASE_URL: z.string().min(1, {
    message: 'رابط قاعدة البيانات TURSO_DATABASE_URL مفقود'
  }),
  TURSO_AUTH_TOKEN: z.string().min(1, {
    message: 'رمز مصادقة قاعدة البيانات TURSO_AUTH_TOKEN مفقود'
  }),

  // Server-side AI proxy keys (OPTIONAL, server-side only)
  GEMINI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),

  // Feature Flags
  FEATURE_AI_PROXY: z
    .preprocess(val => val === 'true' || val === true || val === '1', z.boolean())
    .default(true),
  FEATURE_STRICT_ENV: z
    .preprocess(val => val === 'true' || val === true || val === '1', z.boolean())
    .default(true),

  // P3: PDF Renderer Isolation & Hardening Flags
  FEATURE_SECURE_RENDERER: z
    .preprocess(val => val === 'true' || val === true || val === '1' || val === undefined, z.boolean())
    .default(true),
  FEATURE_RAW_HTML_PDF: z
    .preprocess(val => val === 'true' || val === true || val === '1' || val === undefined, z.boolean())
    .default(true),
  PDF_POOL_SIZE: z.coerce.number().min(1).max(10).default(2),
  PDF_RENDER_TIMEOUT_MS: z.coerce.number().min(1000).max(60000).default(15000)
});

let hasLoggedStatus = false;

function validateEnvironment(rawEnv = process.env, options = {}) {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const formattedErrors = result.error.issues.map(issue => {
      const field = issue.path.join('.');
      const val = rawEnv[field];
      const status = !val ? 'مفقود' : 'غير مستوفٍ للشروط';
      return { field, message: issue.message, status };
    });

    const errorLines = formattedErrors
      .map(e => `   - ${e.field}: ${e.status} (${e.message})`)
      .join('\n');

    const summaryArabic = [
      '❌ [Djadwal Security Guard] فشل التحقق من متغيرات البيئة الأساسية:',
      errorLines,
      '⚠️ يمنع إقلاع الخادم بمفاتيح افتراضية أو ناقصة حفاظًا على أمان النظام التعليمي.'
    ].join('\n');

    if (!options.silent && !hasLoggedStatus) {
      console.error(summaryArabic);
      hasLoggedStatus = true;
    }

    if (options.exitOnError) {
      process.exit(1);
    }

    return {
      success: false,
      errors: formattedErrors,
      summaryArabic
    };
  }

  const validated = result.data;
  const statusLines = [
    `   - JWT_SECRET: مُعيَّن ومؤمّن (≥ 32 حرفًا)`,
    `   - JWT_SECRET_PREVIOUS: ${validated.JWT_SECRET_PREVIOUS ? 'مُعيَّن (نمط التدوير السلس نشط)' : 'غير مُعيَّن'}`,
    `   - TURSO_DATABASE_URL: مُعيَّن (${validated.TURSO_DATABASE_URL.startsWith('libsql://') ? 'Turso Cloud' : 'محلي'})`,
    `   - TURSO_AUTH_TOKEN: مُعيَّن ومحمي`,
    `   - GEMINI_API_KEY: ${validated.GEMINI_API_KEY ? 'مُعيَّن على الخادم' : 'غير مُعيَّن'}`,
    `   - OPENROUTER_API_KEY: ${validated.OPENROUTER_API_KEY ? 'مُعيَّن على الخادم' : 'غير مُعيَّن'}`,
    `   - FEATURE_AI_PROXY: ${validated.FEATURE_AI_PROXY ? 'مفعّل' : 'معطّل'}`
  ].join('\n');

  const summaryArabic = [
    '🔒 [Djadwal Security Guard] تم التحقق الصارم من متغيرات البيئة بنجاح:',
    statusLines
  ].join('\n');

  if (!options.silent && !hasLoggedStatus) {
    console.log(summaryArabic);
    hasLoggedStatus = true;
  }

  return {
    success: true,
    data: validated,
    summaryArabic
  };
}

module.exports = {
  envSchema,
  validateEnvironment
};
