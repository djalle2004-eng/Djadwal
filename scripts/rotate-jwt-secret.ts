import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { SignJWT, jwtVerify } from 'jose';

/**
 * Djadwal Zero-Downtime JWT Secret Rotation Utility
 * 
 * Supports dual-key verification (active key + previous key).
 * Ensures active user sessions remain valid for their full lifecycle
 * while immediately issuing new sessions with the fresh cryptographic key.
 */

export function generateSecureSecret(lengthBytes: number = 32): string {
  return crypto.randomBytes(lengthBytes).toString('hex'); // 64 hex characters (256 bits)
}

export async function testDualKeyVerification(
  currentSecretStr: string,
  newSecretStr: string
): Promise<{ success: boolean; details: string[] }> {
  const currentKey = new TextEncoder().encode(currentSecretStr);
  const newKey = new TextEncoder().encode(newSecretStr);

  const logs: string[] = [];

  // 1. Simulate an existing active session signed before rotation
  const existingToken = await new SignJWT({ userId: 101, username: 'prof_ali', role: 'admin' })
    .setProtectedHeader({ alg: 'HS256', kid: 'key-v1' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(currentKey);

  logs.push('✓ Created test token signed with previous secret (simulating existing user session)');

  // 2. Dual verification helper
  async function verifyWithDualSecret(token: string, primary: Uint8Array, previous: Uint8Array | null) {
    try {
      const { payload } = await jwtVerify(token, primary);
      return { valid: true, payload, verifiedBy: 'primary' };
    } catch (primaryErr) {
      if (previous) {
        try {
          const { payload } = await jwtVerify(token, previous);
          return { valid: true, payload, verifiedBy: 'previous' };
        } catch (prevErr) {
          return { valid: false, error: prevErr };
        }
      }
      return { valid: false, error: primaryErr };
    }
  }

  // 3. Verify existing token against (primary: newKey, previous: currentKey)
  const verifyOldResult = await verifyWithDualSecret(existingToken, newKey, currentKey);
  if (!verifyOldResult.valid || verifyOldResult.verifiedBy !== 'previous') {
    throw new Error('Dual-verification failed: existing session could not be verified by previous secret.');
  }
  logs.push('✓ Verified existing session successfully via fallback previous secret (NO mass logout!)');

  // 4. Create and verify a new session with newKey
  const freshToken = await new SignJWT({ userId: 102, username: 'prof_fatima', role: 'professor' })
    .setProtectedHeader({ alg: 'HS256', kid: 'key-v2' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(newKey);

  const verifyNewResult = await verifyWithDualSecret(freshToken, newKey, currentKey);
  if (!verifyNewResult.valid || verifyNewResult.verifiedBy !== 'primary') {
    throw new Error('Verification failed for fresh token signed with new secret.');
  }
  logs.push('✓ Verified newly issued session successfully via new primary secret');

  return { success: true, details: logs };
}

async function main() {
  console.log('🔄 ==========================================');
  console.log('🔄 Djadwal JWT Secret Rotation Tool');
  console.log('🔄 ==========================================\n');

  const newKey = generateSecureSecret(32);
  console.log('🔑 Newly Generated Cryptographic Key (256-bit):');
  console.log(`   Length: ${newKey.length} characters (hex)`);
  console.log(`   Entropy: Cryptographically strong pseudo-random bytes\n`);

  const envPath = path.resolve(process.cwd(), '.env');
  let currentKey = 'default_legacy_key_minimum_32_characters_long_for_test';

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^JWT_SECRET=(.*)$/m);
    if (match && match[1] && match[1].trim().length >= 10) {
      currentKey = match[1].trim();
    }
  }

  console.log('🧪 Testing Dual-Key Zero-Downtime Verification...');
  const testResult = await testDualKeyVerification(currentKey, newKey);
  for (const log of testResult.details) {
    console.log(`   ${log}`);
  }

  console.log('\n📋 Rotation Deployment Instructions:');
  console.log('1. Set the following environment variables in Render Dashboard (or local .env):');
  console.log(`   JWT_SECRET_PREVIOUS="${currentKey}"`);
  console.log(`   JWT_SECRET="${newKey}"`);
  console.log('2. Redeploy the server. Both active tokens and new tokens are accepted.');
  console.log('3. After 7 days (maximum token lifetime), remove JWT_SECRET_PREVIOUS to conclude rotation.\n');
}

if (process.argv[1] && process.argv[1].endsWith('rotate-jwt-secret.ts')) {
  main().catch(err => {
    console.error('❌ Rotation test failed:', err);
    process.exit(1);
  });
}
