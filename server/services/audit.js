const crypto = require('crypto');
const { executeQuery } = require('../database');

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
const MAX_BUFFER_SIZE = 1000;

// In-Memory Ring Buffer for high-availability audit resilience
const inMemoryAuditBuffer = [];

/**
 * Computes deterministic SHA-256 hash for an audit log entry.
 */
function computeRowHash({ prevHash, userId, action, entityType, entityId, details, ipAddress, createdAt, claimedBy }) {
    const serializedDetails = typeof details === 'object' && details !== null 
        ? JSON.stringify(details) 
        : String(details || '');

    const payload = [
        prevHash || GENESIS_HASH,
        userId ?? '',
        action ?? '',
        entityType ?? '',
        entityId ?? '',
        serializedDetails,
        ipAddress ?? '',
        createdAt ?? '',
        claimedBy ?? ''
    ].join('|');

    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Sends audit failure telemetry alert to METRICS_SINK if configured.
 */
async function notifyMetricsSink(eventType, payload) {
    const sinkUrl = process.env.METRICS_SINK;
    if (!sinkUrl) return;

    try {
        if (sinkUrl.startsWith('http://') || sinkUrl.startsWith('https://')) {
            await fetch(sinkUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: 'djadwal-audit',
                    event: eventType,
                    timestamp: new Date().toISOString(),
                    data: payload
                }),
                signal: AbortSignal.timeout(3000)
            });
        } else {
            // Local syslog or metrics socket string
            console.warn(`[METRICS_SINK:${sinkUrl}] Event: ${eventType}`, payload);
        }
    } catch (metricErr) {
        console.error('⚠️ Failed to deliver telemetry to METRICS_SINK:', metricErr.message);
    }
}

/**
 * Flushes in-memory buffered audit logs into database when connection recovers.
 */
async function flushAuditBuffer() {
    if (inMemoryAuditBuffer.length === 0) return 0;

    let flushedCount = 0;
    while (inMemoryAuditBuffer.length > 0) {
        const entry = inMemoryAuditBuffer[0];
        try {
            await writeAuditRowDirect(entry);
            inMemoryAuditBuffer.shift();
            flushedCount++;
        } catch (err) {
            console.error('⚠️ DB still unavailable during audit buffer flush:', err.message);
            break;
        }
    }

    if (flushedCount > 0) {
        console.log(`✅ Flushed ${flushedCount} pending audit records from memory buffer to DB.`);
    }
    return flushedCount;
}

/**
 * Low-level write of a calculated audit row to database.
 */
async function writeAuditRowDirect({ userId, action, entityType, entityId, details, ipAddress, createdAt, prevHash, rowHash, claimedBy }) {
    await executeQuery(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address, created_at, prev_hash, row_hash, claimed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
            userId || null,
            action,
            entityType || null,
            entityId || null,
            typeof details === 'object' ? JSON.stringify(details) : details,
            ipAddress || null,
            createdAt,
            prevHash,
            rowHash,
            claimedBy || null
        ]
    );
}

/**
 * Main tamper-evident audit logging engine.
 * 
 * Strict Identity Isolation:
 * - Attribution (user_id) derived EXCLUSIVELY from authenticated req.user (JWT/Session).
 * - Client-sent x-user-id / body.currentUserId are preserved ONLY in claimed_by for forensics.
 * - Cryptographic SHA-256 hash chaining ensures append-only tamper evidence.
 */
async function logAudit(req, { action, entity_type, entity_id = null, details = null, user_id = null }) {
    const isHashChainEnabled = process.env.FEATURE_AUDIT_HASH_CHAIN !== 'false';
    const createdAt = new Date().toISOString();

    // 1. Determine Authentic Actor Identity (req.user takes absolute priority)
    let finalUserId = null;
    let claimedBy = null;

    if (req?.headers?.['x-user-id']) {
        claimedBy = `x-user-id:${req.headers['x-user-id']}`;
    } else if (req?.body?.currentUserId) {
        claimedBy = `body.currentUserId:${req.body.currentUserId}`;
    }

    if (req?.user?.id) {
        finalUserId = req.user.id;
    } else if (req?.user?.userId) {
        finalUserId = req.user.userId;
    } else if (user_id) {
        finalUserId = user_id;
    }

    const ip = req ? (req.headers?.['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || null) : null;

    // 2. Fetch Latest Hash for Chaining
    let prevHash = GENESIS_HASH;
    if (isHashChainEnabled) {
        try {
            const lastRows = await executeQuery('SELECT id, row_hash FROM audit_log ORDER BY id DESC LIMIT 1');
            if (lastRows && lastRows.length > 0 && lastRows[0].row_hash) {
                prevHash = lastRows[0].row_hash;
            }
        } catch (chainErr) {
            console.warn('⚠️ Could not fetch latest audit hash for chaining:', chainErr.message);
        }
    }

    // 3. Calculate Cryptographic Hash
    const rowHash = isHashChainEnabled 
        ? computeRowHash({
            prevHash,
            userId: finalUserId,
            action,
            entityType: entity_type,
            entityId: entity_id,
            details,
            ipAddress: ip,
            createdAt,
            claimedBy
        })
        : null;

    const record = {
        userId: finalUserId,
        action,
        entityType: entity_type,
        entityId: entity_id,
        details,
        ipAddress: ip,
        createdAt,
        prevHash,
        rowHash,
        claimedBy
    };

    // 4. Attempt Persist with In-Memory Resilient Buffer Fallback
    try {
        await writeAuditRowDirect(record);

        // Opportunistic flush of any buffered records
        if (inMemoryAuditBuffer.length > 0) {
            setImmediate(() => flushAuditBuffer());
        }
    } catch (writeErr) {
        // Enqueue to buffer to prevent data loss
        if (inMemoryAuditBuffer.length >= MAX_BUFFER_SIZE) {
            inMemoryAuditBuffer.shift(); // Evict oldest if full
        }
        inMemoryAuditBuffer.push(record);

        // Raise metric alarm via METRICS_SINK
        await notifyMetricsSink('AUDIT_WRITE_FAILED', {
            error: writeErr.message,
            bufferedCount: inMemoryAuditBuffer.length,
            action,
            entity_type
        });

        console.error(`🚨 [AUDIT-FAIL] Failed to persist audit row to DB: ${writeErr.message}. Stored in resilient buffer (Size: ${inMemoryAuditBuffer.length}).`);
    }
}

/**
 * Verifies the integrity of the audit log hash chain.
 * Returns { valid: boolean, totalRows: number, brokenAtId: number | null, reason: string | null }
 */
async function verifyAuditChain() {
    const rows = await executeQuery('SELECT * FROM audit_log ORDER BY id ASC');
    if (!rows || rows.length === 0) {
        return { valid: true, totalRows: 0, brokenAtId: null, reason: null };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Skip legacy unhashed rows before P5 if prev_hash is missing
        if (!row.row_hash) {
            continue;
        }

        // 1. Verify prev_hash link
        if (row.prev_hash && row.prev_hash !== expectedPrevHash && i !== 0) {
            return {
                valid: false,
                totalRows: rows.length,
                brokenAtId: row.id,
                reason: `Chain broken at Row #${row.id}: prev_hash (${row.prev_hash}) does not match expected (${expectedPrevHash})`
            };
        }

        // 2. Recompute and verify row_hash
        const computed = computeRowHash({
            prevHash: row.prev_hash,
            userId: row.user_id,
            action: row.action,
            entityType: row.entity_type,
            entityId: row.entity_id,
            details: row.details,
            ipAddress: row.ip_address,
            createdAt: row.created_at,
            claimedBy: row.claimed_by
        });

        if (computed !== row.row_hash) {
            return {
                valid: false,
                totalRows: rows.length,
                brokenAtId: row.id,
                reason: `Tampering detected at Row #${row.id}: row_hash mismatch! Stored: ${row.row_hash}, Computed: ${computed}`
            };
        }

        expectedPrevHash = row.row_hash;
    }

    return {
        valid: true,
        totalRows: rows.length,
        headHash: expectedPrevHash,
        brokenAtId: null,
        reason: null
    };
}

/**
 * Backfills existing legacy rows with valid hashes to initialize the chain.
 */
async function backfillAuditChain() {
    const rows = await executeQuery('SELECT * FROM audit_log ORDER BY id ASC');
    if (!rows || rows.length === 0) return 0;

    let prevHash = GENESIS_HASH;
    let updated = 0;

    for (const row of rows) {
        if (!row.row_hash || !row.prev_hash) {
            const rowHash = computeRowHash({
                prevHash,
                userId: row.user_id,
                action: row.action,
                entityType: row.entity_type,
                entityId: row.entity_id,
                details: row.details,
                ipAddress: row.ip_address,
                createdAt: row.created_at,
                claimedBy: row.claimed_by
            });

            await executeQuery(
                'UPDATE audit_log SET prev_hash = $1, row_hash = $2 WHERE id = $3',
                [prevHash, rowHash, row.id]
            );

            prevHash = rowHash;
            updated++;
        } else {
            prevHash = row.row_hash;
        }
    }

    return updated;
}

/**
 * Returns in-memory buffer status for diagnostic inspection.
 */
function getAuditBufferStats() {
    return {
        bufferedCount: inMemoryAuditBuffer.length,
        maxBufferSize: MAX_BUFFER_SIZE
    };
}

module.exports = {
    GENESIS_HASH,
    computeRowHash,
    logAudit,
    verifyAuditChain,
    backfillAuditChain,
    flushAuditBuffer,
    getAuditBufferStats,
    inMemoryAuditBuffer
};
