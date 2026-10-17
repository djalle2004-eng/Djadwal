/**
 * Djadwal Audit Log Cryptographic Chain Verifier
 * 
 * Verifies that the audit_log table has not been tampered with:
 * - Each row's prev_hash must match the previous row's row_hash.
 * - Each row's row_hash must match the SHA-256 digest of its contents.
 * 
 * Usage:
 *   npx ts-node scripts/verify-audit-chain.ts
 *   npx ts-node scripts/verify-audit-chain.ts --backfill
 */

const { initDatabaseConnection } = require('../server/database');
const { verifyAuditChain, backfillAuditChain } = require('../server/services/audit');

async function main() {
    console.log('🔍 [AuditVerifier] Initializing database connection...');
    await initDatabaseConnection();

    const args = process.argv.slice(2);
    if (args.includes('--backfill')) {
        console.log('🛠️ [AuditVerifier] Backfilling legacy unhashed rows...');
        const backfilled = await backfillAuditChain();
        console.log(`✅ [AuditVerifier] Successfully backfilled and hashed ${backfilled} legacy audit rows.`);
    }

    console.log('🔍 [AuditVerifier] Running cryptographic chain validation...');
    const result = await verifyAuditChain();

    if (!result.valid) {
        console.error('=================================================================');
        console.error('🚨 AUDIT LOG TAMPERING OR CORRUPTION DETECTED!');
        console.error(`❌ Broken at Row ID: #${result.brokenAtId}`);
        console.error(`❌ Failure Reason: ${result.reason}`);
        console.error('=================================================================');
        process.exit(1);
    }

    console.log('=================================================================');
    console.log('✅ AUDIT LOG CHAIN FULLY VERIFIED');
    console.log(`📊 Total Records Verified: ${result.totalRows}`);
    console.log(`🔒 Chain Head Hash: ${result.headHash || 'genesis'}`);
    console.log('🛡️ Status: All rows cryptographically verified & append-only intact.');
    console.log('=================================================================');
    process.exit(0);
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal verification error:', err);
        process.exit(1);
    });
}

module.exports = { main };
