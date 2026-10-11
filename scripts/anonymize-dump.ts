import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Anonymization Utility for Djadwal Production Snapshots
 * 
 * Complies with educational data privacy regulations (PII protection).
 * Uses deterministic HMAC-SHA256 masking so referential integrity,
 * search filters, and repeated test assertions remain 100% reproducible.
 */

const DEFAULT_SALT = process.env.ANONYMIZE_SALT || 'djadwal_staging_reproducible_salt_2026';

export function createDeterministicHash(val: string, salt: string = DEFAULT_SALT): string {
  return crypto.createHmac('sha256', salt).update(String(val)).digest('hex').substring(0, 8);
}

export function anonymizeName(originalName: string, prefix: string = 'أستاذ'): string {
  if (!originalName || originalName.trim().length === 0) return originalName;
  const hash = createDeterministicHash(originalName);
  return `${prefix}_مجهول_${hash}`;
}

export function anonymizeEmail(originalEmail: string): string {
  if (!originalEmail || !originalEmail.includes('@')) return originalEmail;
  const hash = createDeterministicHash(originalEmail);
  return `user_${hash}@univ-staging.dz`;
}

export function anonymizePhone(originalPhone: string): string {
  if (!originalPhone) return '';
  const hash = createDeterministicHash(originalPhone);
  const numericSuffix = parseInt(hash, 16) % 1000000;
  return `0550${String(numericSuffix).padStart(6, '0')}`;
}

export interface ProfessorRecord {
  id: number | string;
  name?: string;
  nom?: string;
  prenom?: string;
  email?: string;
  phone?: string;
  telephone?: string;
  [key: string]: any;
}

export function anonymizeProfessors(records: ProfessorRecord[]): ProfessorRecord[] {
  return records.map(prof => {
    const copy = { ...prof };
    if (copy.name) copy.name = anonymizeName(copy.name, 'أستاذ');
    if (copy.nom) copy.nom = `لقب_${createDeterministicHash(copy.nom)}`;
    if (copy.prenom) copy.prenom = `اسم_${createDeterministicHash(copy.prenom)}`;
    if (copy.email) copy.email = anonymizeEmail(copy.email);
    if (copy.phone) copy.phone = anonymizePhone(copy.phone);
    if (copy.telephone) copy.telephone = anonymizePhone(copy.telephone);
    return copy;
  });
}

export interface UserRecord {
  id: number | string;
  username: string;
  password?: string;
  email?: string;
  [key: string]: any;
}

export function anonymizeUsers(users: UserRecord[]): UserRecord[] {
  // Safe standardized test password bcrypt hash (password: "StagingPass2026!")
  const SAFE_PASSWORD_HASH = '$2b$10$Ep37ZJ91yH043qE/k20XveiN6rE.XqFfV.Xn54j9aP50h2/g7G0C.';
  return users.map(user => ({
    ...user,
    username: user.username === 'admin' ? 'admin' : `user_${createDeterministicHash(user.username)}`,
    email: user.email ? anonymizeEmail(user.email) : undefined,
    password: SAFE_PASSWORD_HASH
  }));
}

/**
 * Main command line execution
 */
export async function runAnonymization(inputFilePath: string, outputFilePath: string) {
  console.log(`[Anonymize] Reading input dump from: ${inputFilePath}`);
  if (!fs.existsSync(inputFilePath)) {
    throw new Error(`Input file not found: ${inputFilePath}`);
  }

  const raw = fs.readFileSync(inputFilePath, 'utf8');
  const data = JSON.parse(raw);

  if (Array.isArray(data.professors)) {
    console.log(`[Anonymize] Anonymizing ${data.professors.length} professors...`);
    data.professors = anonymizeProfessors(data.professors);
  }

  if (Array.isArray(data.users)) {
    console.log(`[Anonymize] Anonymizing ${data.users.length} user accounts...`);
    data.users = anonymizeUsers(data.users);
  }

  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
  fs.writeFileSync(outputFilePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[Anonymize] Anonymized dump successfully written to: ${outputFilePath}`);
}

// Auto-run if executed directly via tsx/node
if (process.argv[1] && process.argv[1].endsWith('anonymize-dump.ts')) {
  const inputFile = process.argv[2] || path.join(process.cwd(), 'tools', 'archive', 'sample-prod-dump.json');
  const outputFile = process.argv[3] || path.join(process.cwd(), 'staging-anonymized-dump.json');

  if (fs.existsSync(inputFile)) {
    runAnonymization(inputFile, outputFile).catch(err => {
      console.error('[Anonymize] Error:', err);
      process.exit(1);
    });
  } else {
    console.log(`[Anonymize] Ready. Usage: tsx scripts/anonymize-dump.ts <input-dump.json> <output-dump.json>`);
  }
}
