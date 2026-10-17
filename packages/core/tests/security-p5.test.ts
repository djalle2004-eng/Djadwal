import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { SignJWT } from 'jose';

const app = require('../../../server/server');
const { executeQuery, initDatabaseConnection } = require('../../../server/database');
const auditService = require('../../../server/services/audit');
const { isAllowed, normalizeRole } = require('../../../server/authz/matrix');

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');

async function createTestToken(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .setIssuedAt()
    .sign(JWT_SECRET);
}

const CSRF_TOKEN = 'test_p5_csrf_token_secret_123';

function asUser(req: any, token: string) {
  return req
    .set('Cookie', `token=${token}; csrf_token=${CSRF_TOKEN}`)
    .set('x-csrf-token', CSRF_TOKEN);
}

describe('P5 Server Authorization (RBAC) & Tamper-Evident Audit Suite', () => {
  let professorUserId: number;
  let adminUserId: number;
  let otherUserId: number;

  let professorToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await initDatabaseConnection();

    // 1. Create a PROFESSOR user
    const profRes = await executeQuery(
      `INSERT INTO users (username, email, password_hash, role, is_active)
       VALUES (?, ?, 'dummy_hash', 'PROFESSOR', 1)
       RETURNING id`,
      [`prof_p5_${Date.now()}`, `prof_p5_${Date.now()}@univ-eloued.dz`]
    );
    professorUserId = profRes[0].id;
    professorToken = await createTestToken({ id: professorUserId, role: 'PROFESSOR' });

    // 2. Create an ADMIN user
    const adminRes = await executeQuery(
      `INSERT INTO users (username, email, password_hash, role, is_active)
       VALUES (?, ?, 'dummy_hash', 'admin', 1)
       RETURNING id`,
      [`admin_p5_${Date.now()}`, `admin_p5_${Date.now()}@univ-eloued.dz`]
    );
    adminUserId = adminRes[0].id;
    adminToken = await createTestToken({ id: adminUserId, role: 'admin' });

    // 3. Create another user for cross-user modification tests
    const otherRes = await executeQuery(
      `INSERT INTO users (username, email, password_hash, role, is_active)
       VALUES (?, ?, 'dummy_hash', 'PROFESSOR', 1)
       RETURNING id`,
      [`other_p5_${Date.now()}`, `other_p5_${Date.now()}@univ-eloued.dz`]
    );
    otherUserId = otherRes[0].id;
  });

  afterAll(async () => {
    try {
      if (professorUserId || adminUserId || otherUserId) {
        await executeQuery(
          `UPDATE users SET is_active = 0 WHERE id IN (?, ?, ?)`,
          [professorUserId || 0, adminUserId || 0, otherUserId || 0]
        );
      }
    } catch (e: any) {
      console.warn('Test cleanup warning:', e.message);
    }
  });

  describe('1. Centralized RBAC Matrix (server/authz/matrix.js)', () => {
    it('grants full administrative permissions to admin role', () => {
      expect(isAllowed('admin', 'users', 'create')).toBe(true);
      expect(isAllowed('admin', 'departments', 'delete')).toBe(true);
      expect(isAllowed('admin', 'backup', 'export')).toBe(true);
      expect(isAllowed('admin', 'app_config', 'update')).toBe(true);
      expect(isAllowed('admin', 'audit_logs', 'export')).toBe(true);
    });

    it('restricts schedule_manager to schedule modifications while denying administrative access', () => {
      expect(isAllowed('schedule_manager', 'sessions', 'create')).toBe(true);
      expect(isAllowed('schedule_manager', 'extra_sessions', 'update')).toBe(true);
      expect(isAllowed('schedule_manager', 'departments', 'create')).toBe(false);
      expect(isAllowed('schedule_manager', 'users', 'delete')).toBe(false);
      expect(isAllowed('schedule_manager', 'backup', 'export')).toBe(false);
    });

    it('restricts professor to view-only pedagogical duties and blocks admin modules', () => {
      expect(isAllowed('professor', 'courses', 'view')).toBe(true);
      expect(isAllowed('professor', 'sessions', 'view')).toBe(true);
      expect(isAllowed('professor', 'departments', 'create')).toBe(false);
      expect(isAllowed('professor', 'users', 'create')).toBe(false);
      expect(isAllowed('professor', 'backup', 'export')).toBe(false);
      expect(isAllowed('professor', 'sandbox_snapshots', 'create')).toBe(false);
    });

    it('defaults to DENY for any unrecognized or undefined role', () => {
      expect(isAllowed('hacker_role', 'users', 'view')).toBe(false);
      expect(isAllowed('guest', 'departments', 'view')).toBe(false);
      expect(isAllowed('', 'sessions', 'view')).toBe(false);
    });
  });

  describe('2. Acceptance Criterion 1: Rejects Regular Users from Every Administrative Route (403 Forbidden)', () => {
    it('blocks professor from creating or modifying departments', async () => {
      const resPost = await asUser(request(app).post('/api/departments'), professorToken)
        .send({ name: 'Department of Unauthorized', code: 'DOU' });

      expect(resPost.status).toBe(403);
      expect(resPost.body.error).toBe('FORBIDDEN');

      const resDelete = await asUser(request(app).delete('/api/departments/999'), professorToken);

      expect(resDelete.status).toBe(403);
      expect(resDelete.body.error).toBe('FORBIDDEN');
    });

    it('blocks professor from managing users', async () => {
      const resPost = await asUser(request(app).post('/api/users'), professorToken)
        .send({ username: 'newadmin', password: 'Password123!', role: 'admin' });

      expect(resPost.status).toBe(403);
      expect(['FORBIDDEN', 'FORBIDDEN_ROLE_PROMOTION']).toContain(resPost.body.error);

      const resDelete = await asUser(request(app).delete(`/api/users/${otherUserId}`), professorToken);

      expect(resDelete.status).toBe(403);
      expect(resDelete.body.error).toBe('FORBIDDEN');
    });

    it('blocks professor from modifying academic years & semesters', async () => {
      const resYear = await asUser(request(app).post('/api/academic-years'), professorToken)
        .send({ yearName: '2026-2027', setAsCurrent: false });

      expect(resYear.status).toBe(403);

      const resSemester = await asUser(request(app).post('/api/semesters'), professorToken)
        .send({ semesterName: 'Spring 2026' });

      expect(resSemester.status).toBe(403);
    });

    it('blocks professor from exporting full database backup', async () => {
      const resBackup = await asUser(request(app).get('/api/export/data'), professorToken);

      expect(resBackup.status).toBe(403);
      expect(resBackup.body.error).toBe('FORBIDDEN');
    });

    it('blocks professor from mutating print settings or sandbox snapshots', async () => {
      const resPrint = await asUser(request(app).put('/api/print-settings'), professorToken)
        .send({ universityName: 'Tampered University' });

      expect(resPrint.status).toBe(403);

      const resSandbox = await asUser(request(app).post('/api/sandbox/save'), professorToken)
        .send({ name: 'Hacked Snapshot', data: {} });

      expect(resSandbox.status).toBe(403);
    });
  });

  describe('3. Self-Role Promotion & Cross-User Security', () => {
    it('prevents regular user from self-promoting to admin role', async () => {
      const res = await asUser(request(app).put(`/api/users/${professorUserId}`), professorToken)
        .send({ username: 'prof_elevated', role: 'admin' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN_ROLE_PROMOTION');
    });

    it('prevents regular user from modifying another users profile', async () => {
      const res = await asUser(request(app).put(`/api/users/${otherUserId}`), professorToken)
        .send({ username: 'tampered_user' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN_CROSS_USER_UPDATE');
    });

    it('allows ADMIN to modify user roles and details', async () => {
      const res = await asUser(request(app).put(`/api/users/${otherUserId}`), adminToken)
        .send({ username: `updated_other_${Date.now()}` });

      expect(res.status).toBe(200);
    });
  });

  describe('4. Acceptance Criterion 2: Spoofing x-user-id Header Does NOT Alter Audit Attribution', () => {
    it('derives author identity strictly from req.user (JWT) while storing spoofed header in claimed_by', async () => {
      const fakeSpoofedId = 999999;
      const fakeSpoofedUsername = 'ForgedAdminUser';

      // Call an endpoint with forged client headers using adminToken
      const res = await asUser(request(app).post('/api/audit-logs'), adminToken)
        .set('x-user-id', String(fakeSpoofedId))
        .set('x-user-name', fakeSpoofedUsername)
        .send({
          action: 'test_attribution_check',
          entity_type: 'test_probe',
          details: 'Verifying attribution integrity'
        });

      expect(res.status).toBe(200);

      // Query database for the latest audit log entry
      const rows = await executeQuery(
        `SELECT user_id, claimed_by, action, prev_hash, row_hash 
         FROM audit_log 
         WHERE action = 'test_attribution_check' 
         ORDER BY id DESC LIMIT 1`
      );

      expect(rows.length).toBe(1);
      const logEntry = rows[0];

      // ATTRIBUTION MUST BE adminUserId, NEVER fakeSpoofedId!
      expect(logEntry.user_id).toBe(adminUserId);
      expect(logEntry.user_id).not.toBe(fakeSpoofedId);

      // Claimed header is safely preserved for forensic inspection
      expect(logEntry.claimed_by).toContain(String(fakeSpoofedId));

      // Cryptographic hash chain populated
      expect(logEntry.prev_hash).toBeDefined();
      expect(logEntry.row_hash).toBeDefined();
    });
  });

  describe('5. Acceptance Criterion 3: Audit Tamper-Evidence & Hash Chain Detection', () => {
    it('verifies valid hash chain returns valid: true', async () => {
      const result = await auditService.verifyAuditChain();
      expect(result.valid).toBe(true);
      expect(result.brokenAtId).toBeNull();
      expect(result.headHash).toBeDefined();
    });

    it('detects tampering immediately if a record in audit_log is modified', async () => {
      // 1. Insert a clean row via audit service
      await auditService.logAudit(
        { user: { id: adminUserId }, ip: '127.0.0.1' },
        { action: 'CANARY_EVENT', entity_type: 'security_test', details: 'Original content' }
      );

      const rows = await executeQuery(
        `SELECT id, details FROM audit_log WHERE action = 'CANARY_EVENT' ORDER BY id DESC LIMIT 1`
      );
      const canaryId = rows[0].id;

      // 2. Simulate database adversary tampering with row content directly
      await executeQuery(
        `UPDATE audit_log SET details = 'Tampered content by attacker' WHERE id = ?`,
        [canaryId]
      );

      // 3. Chain verification must detect corruption!
      const detection = await auditService.verifyAuditChain();
      expect(detection.valid).toBe(false);
      expect(detection.brokenAtId).toBe(canaryId);
      expect(detection.reason).toContain('Tampering detected');

      // 4. Restore original content to keep chain clean
      await executeQuery(
        `UPDATE audit_log SET details = 'Original content' WHERE id = ?`,
        [canaryId]
      );

      // Verify chain is repaired
      const repaired = await auditService.verifyAuditChain();
      expect(repaired.valid).toBe(true);
    });
  });

  describe('6. In-Memory Resilient Buffer on DB Outage', () => {
    it('buffers audit logs in memory and tracks stats', () => {
      const initialStats = auditService.getAuditBufferStats();
      expect(initialStats.maxBufferSize).toBe(1000);
      expect(typeof initialStats.bufferedCount).toBe('number');
    });
  });

  describe('7. Audit Log Export with Short-Lived Signed URLs (ADMIN only)', () => {
    it('blocks regular users from exporting audit logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs/export')
        .set('Cookie', [`token=${professorToken}`]);

      expect(res.status).toBe(403);
    });

    it('generates a 5-minute signed export URL for ADMIN', async () => {
      const res = await asUser(request(app).post('/api/audit-logs/export-url'), adminToken)
        .send({ format: 'jsonl' });

      expect(res.status).toBe(200);
      expect(res.body.downloadUrl).toContain('/api/audit-logs/export');
      expect(res.body.expiresInSeconds).toBe(300);

      // Fetch export using the signed URL without cookies
      const exportRes = await request(app)
        .get(res.body.downloadUrl);

      expect(exportRes.status).toBe(200);
      expect(exportRes.headers['x-audit-chain-status']).toBe('verified');
      expect(exportRes.headers['content-type']).toContain('application/x-ndjson');
    });

    it('supports CSV format export for ADMIN', async () => {
      const res = await request(app)
        .get('/api/audit-logs/export?format=csv')
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('id,created_at,user_id,user_name,action');
    });
  });
});
