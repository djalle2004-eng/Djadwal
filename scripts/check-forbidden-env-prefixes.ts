import * as fs from 'fs';
import * as path from 'path';

/**
 * Djadwal Client Environment Prefix Linter
 * Ensures no sensitive credentials or keys use client-exposed prefixes (VITE_ / NEXT_PUBLIC_).
 */

export const FORBIDDEN_CLIENT_KEYWORDS = [
  'TURSO',
  'DATABASE',
  'DB_URL',
  'DB_PASS',
  'AUTH_TOKEN',
  'JWT_SECRET',
  'SESSION_SECRET',
  'GEMINI_API_KEY',
  'OPENROUTER',
  'SERVICE_ROLE',
  'ADMIN_KEY',
  'PRIVATE_KEY',
  'SECRET_KEY'
];

export function checkEnvFileForForbiddenPrefixes(filePath: string): { clean: boolean; violations: string[] } {
  if (!fs.existsSync(filePath)) return { clean: true, violations: [] };

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key] = trimmed.split('=');
    const varName = key.trim();

    if (varName.startsWith('VITE_') || varName.startsWith('NEXT_PUBLIC_')) {
      for (const forbidden of FORBIDDEN_CLIENT_KEYWORDS) {
        if (varName.toUpperCase().includes(forbidden)) {
          violations.push(`Forbidden client env var detected: "${varName}" contains keyword "${forbidden}"`);
        }
      }
    }
  }

  return {
    clean: violations.length === 0,
    violations
  };
}

function main() {
  const envExamplePath = path.resolve(process.cwd(), '.env.example');
  console.log(`[EnvCheck] Verifying client environment variables in: ${envExamplePath}`);

  const { clean, violations } = checkEnvFileForForbiddenPrefixes(envExamplePath);

  if (!clean) {
    console.error('\n❌ [EnvCheck] VIOLATIONS FOUND in .env template:');
    for (const v of violations) {
      console.error(`   - ${v}`);
    }
    console.error('⛔ CI Gate Failed: Sensitive credentials must NEVER use VITE_ or NEXT_PUBLIC_ prefixes.\n');
    process.exit(1);
  }

  console.log('✅ [EnvCheck] PASS: All client-exposed environment prefixes comply with security policy.');
}

if (process.argv[1] && process.argv[1].endsWith('check-forbidden-env-prefixes.ts')) {
  main();
}
