import { describe, it, expect } from 'vitest';
import { validateEnvironment } from '../src/config/env.js';
import { testDualKeyVerification } from '../../../scripts/rotate-jwt-secret.js';
import { checkEnvFileForForbiddenPrefixes } from '../../../scripts/check-forbidden-env-prefixes.js';
import { scanBundle } from '../../../scripts/check-bundle-secrets.js';
import * as path from 'path';

describe('P1 Environment Security & Secret Guard Suite', () => {

  describe('1. Centralized Environment Validator (packages/core/src/config/env.ts)', () => {
    const validBaseEnv = {
      NODE_ENV: 'production',
      JWT_SECRET: 'this_is_a_very_secure_key_that_is_at_least_32_characters_long',
      TURSO_DATABASE_URL: 'libsql://test-db.turso.io',
      TURSO_AUTH_TOKEN: 'valid_auth_token_secret_123',
      SESSION_SECRET: 'session_secret_32_chars_minimum_here'
    };

    it('Criterion 1a: Rejects startup when JWT_SECRET is missing', () => {
      const invalidEnv = { ...validBaseEnv };
      delete (invalidEnv as any).JWT_SECRET;

      const result = validateEnvironment(invalidEnv, { silent: true });
      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.field === 'JWT_SECRET')).toBe(true);
      expect(result.summaryArabic).toContain('JWT_SECRET');
    });

    it('Criterion 1b: Rejects startup when JWT_SECRET is shorter than 32 characters', () => {
      const weakEnv = {
        ...validBaseEnv,
        JWT_SECRET: 'short_key_only_24_chars!'
      };

      const result = validateEnvironment(weakEnv, { silent: true });
      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.field === 'JWT_SECRET')).toBe(true);
      expect(result.summaryArabic).toContain('32 حرفًا');
    });

    it('Criterion 1c: Rejects startup when TURSO_DATABASE_URL is missing', () => {
      const invalidEnv = { ...validBaseEnv };
      delete (invalidEnv as any).TURSO_DATABASE_URL;

      const result = validateEnvironment(invalidEnv, { silent: true });
      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.field === 'TURSO_DATABASE_URL')).toBe(true);
    });

    it('Criterion 1d: Passes validation and sets configuration when valid', () => {
      const result = validateEnvironment(validBaseEnv, { silent: true });
      expect(result.success).toBe(true);
      expect(result.data?.JWT_SECRET).toBe(validBaseEnv.JWT_SECRET);
      expect(result.data?.FEATURE_AI_PROXY).toBe(true);
    });

    it('Criterion 1e: Never leaks secret values in error messages or diagnostic summary', () => {
      const secretToHide = 'my_super_secret_value_12345';
      const failingEnv = {
        ...validBaseEnv,
        TURSO_AUTH_TOKEN: secretToHide,
        JWT_SECRET: 'too_short'
      };

      const result = validateEnvironment(failingEnv, { silent: true });
      expect(result.success).toBe(false);
      expect(result.summaryArabic).not.toContain(secretToHide);
    });
  });

  describe('2. Zero-Downtime JWT Secret Rotation (Dual-Key Verification)', () => {
    it('Criterion 4: Verifies existing user tokens via previous secret while issuing new tokens with primary secret', async () => {
      const oldSecret = 'previous_active_session_secret_at_least_32_characters_ok';
      const newSecret = 'brand_new_rotated_session_secret_at_least_32_characters_long';

      const rotationTest = await testDualKeyVerification(oldSecret, newSecret);
      expect(rotationTest.success).toBe(true);
      expect(rotationTest.details.length).toBe(3);
    });
  });

  describe('3. Client Environment & Forbidden Prefixes Linter', () => {
    it('Criterion 2a: Confirms .env.example contains zero forbidden sensitive VITE_ variables', () => {
      const envExamplePath = path.resolve(process.cwd(), '.env.example');
      const check = checkEnvFileForForbiddenPrefixes(envExamplePath);
      expect(check.clean).toBe(true);
      expect(check.violations.length).toBe(0);
    });
  });

  describe('4. Client Bundle Secret Scanner', () => {
    it('Criterion 2b: Verifies compiled client bundle in dist/ has zero leaked credentials or database URLs', () => {
      const distDir = path.resolve(process.cwd(), 'dist');
      const scan = scanBundle(distDir);
      expect(scan.clean).toBe(true);
      expect(scan.findings.length).toBe(0);
    });
  });

});
