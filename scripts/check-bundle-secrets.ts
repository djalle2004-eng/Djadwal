import * as fs from 'fs';
import * as path from 'path';

/**
 * Djadwal Client Bundle Secret Scanner
 * Inspects all production build artifacts in dist/ to ensure
 * no sensitive credentials, database URLs, or AI tokens are leaked to the browser.
 */

interface SecretRule {
  name: string;
  pattern: RegExp;
  severity: 'CRITICAL' | 'HIGH';
}

const FORBIDDEN_RULES: SecretRule[] = [
  {
    name: 'Turso Cloud Connection URL (libsql://)',
    pattern: /libsql:\/\/[a-zA-Z0-9_.-]+/i,
    severity: 'CRITICAL'
  },
  {
    name: 'JSON Web Token (JWT Signature eyJ...)',
    pattern: /eyJ[a-zA-Z0-9_-]{15,}\.eyJ[a-zA-Z0-9_-]{15,}/,
    severity: 'CRITICAL'
  },
  {
    name: 'Google / Gemini API Key (AIzaSy...)',
    pattern: /AIzaSy[a-zA-Z0-9_-]{33}/,
    severity: 'CRITICAL'
  },
  {
    name: 'OpenRouter API Key (sk-or-...)',
    pattern: /sk-or-v1-[a-zA-Z0-9]{32,}/,
    severity: 'CRITICAL'
  },
  {
    name: 'OpenAI Secret Key (sk-...)',
    pattern: /sk-[a-zA-Z0-9]{48}/,
    severity: 'CRITICAL'
  },
  {
    name: 'Forbidden Environment Prefix (VITE_TURSO_*)',
    pattern: /VITE_TURSO_[A-Z0-9_]+/i,
    severity: 'HIGH'
  },
  {
    name: 'Forbidden Environment Prefix (VITE_GEMINI_*)',
    pattern: /VITE_GEMINI_[A-Z0-9_]+/i,
    severity: 'HIGH'
  },
  {
    name: 'Forbidden Environment Prefix (VITE_OPENROUTER_*)',
    pattern: /VITE_OPENROUTER_[A-Z0-9_]+/i,
    severity: 'HIGH'
  }
];

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (/\.(js|html|css|json|map)$/i.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

export function scanBundle(distDir: string): { clean: boolean; findings: { file: string; rule: string }[] } {
  console.log(`[BundleScan] Inspecting directory: ${distDir}`);
  const files = getAllFiles(distDir);
  console.log(`[BundleScan] Found ${files.length} build artifact files.`);

  const findings: { file: string; rule: string }[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const rule of FORBIDDEN_RULES) {
      if (rule.pattern.test(content)) {
        findings.push({
          file: path.relative(distDir, file),
          rule: rule.name
        });
      }
    }
  }

  return {
    clean: findings.length === 0,
    findings
  };
}

function main() {
  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    console.error(`❌ [BundleScan] dist directory not found at: ${distDir}. Run build first.`);
    process.exit(1);
  }

  const { clean, findings } = scanBundle(distDir);

  if (!clean) {
    console.error('\n❌ [BundleScan] VULNERABILITY DETECTED! Sensitive secrets leaked in client bundle:');
    for (const f of findings) {
      console.error(`   - File: ${f.file} -> Matched rule: ${f.rule}`);
    }
    console.error('⛔ Build failed: Client bundle MUST NOT contain private keys or database URLs.\n');
    process.exit(1);
  }

  console.log('✅ [BundleScan] PASS: No leaked credentials or database URLs found in client bundle.');
}

if (process.argv[1] && process.argv[1].endsWith('check-bundle-secrets.ts')) {
  main();
}
