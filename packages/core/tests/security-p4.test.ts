import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const authService = require('../../../server/services/auth');
const totp = require('../../../server/services/totp');
const { executeQuery, initDatabaseConnection } = require('../../../server/database');
const app = require('../../../server/server');

describe('P4 Authentication Revamp & Identity Security Suite', () => {
  let testUserId: number;
  const testUserEmail = `test_prof_${Date.now()}@univ-eloued.dz`;
  const testPassword = 'Password123!Secure';
  let adminUserId: number;
  const adminEmail = `admin_${Date.now()}@univ-eloued.dz`;

  beforeAll(async () => {
    await initDatabaseConnection();

    // 1. Create a test user with a legacy bcrypt hash to test dual-verification and auto-upgrade
    const legacyBcryptHash = await bcrypt.hash(testPassword, 10);
    const userRes = await executeQuery(
      `INSERT INTO users (username, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'PROFESSOR', 1)
       RETURNING id`,
      [testUserEmail.split('@')[0], testUserEmail, legacyBcryptHash]
    );
    testUserId = userRes[0].id;

    // 2. Create an admin user for invitation testing
    const adminHash = await authService.hashPassword('AdminPass123!');
    const adminRes = await executeQuery(
      `INSERT INTO users (username, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'admin', 1)
       RETURNING id`,
      [adminEmail.split('@')[0], adminEmail, adminHash]
    );
    adminUserId = adminRes[0].id;
  });

  afterAll(async () => {
    try {
      if (testUserId) {
        await executeQuery('DELETE FROM sessions WHERE user_id = ?', [testUserId]);
        await executeQuery('DELETE FROM auth_events WHERE user_id = ?', [testUserId]);
        await executeQuery('DELETE FROM mfa_factors WHERE user_id = ?', [testUserId]);
        await executeQuery('DELETE FROM password_reset_tokens WHERE user_id = ?', [testUserId]);
        await executeQuery('DELETE FROM users WHERE id = ?', [testUserId]);
      }
      if (adminUserId) {
        await executeQuery('DELETE FROM invitations WHERE invited_by = ?', [adminUserId]);
        await executeQuery('DELETE FROM sessions WHERE user_id = ?', [adminUserId]);
        await executeQuery('DELETE FROM auth_events WHERE user_id = ?', [adminUserId]);
        await executeQuery('DELETE FROM users WHERE id = ?', [adminUserId]);
      }
    } catch (e) {
      console.warn('Test cleanup warning:', e.message);
    }
  });

  describe('1. Argon2id Password Hashing & Transparent Migration', () => {
    it('generates compliant Argon2id hashes with 19MiB memory and 2 iterations', async () => {
      const hash = await authService.hashPassword('StrongPassword2026!');
      expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    });

    it('verifies Argon2id hashes and sets needsUpgrade to false', async () => {
      const hash = await authService.hashPassword('Secret123');
      const result = await authService.verifyPassword(hash, 'Secret123');
      expect(result.isValid).toBe(true);
      expect(result.needsUpgrade).toBe(false);
    });

    it('verifies legacy bcrypt hashes and flags needsUpgrade as true (Dual-Verification)', async () => {
      const bcryptHash = await bcrypt.hash('LegacyBcryptPass!', 10);
      const result = await authService.verifyPassword(bcryptHash, 'LegacyBcryptPass!');
      expect(result.isValid).toBe(true);
      expect(result.needsUpgrade).toBe(true);
    });

    it('automatically upgrades bcrypt hash to Argon2id upon successful signin without user disruption', async () => {
      // User initially has bcrypt hash
      const beforeUser = await executeQuery('SELECT password_hash FROM users WHERE id = ?', [testUserId]);
      expect(beforeUser[0].password_hash).toMatch(/^\$2b\$/);

      // Perform signin via HTTP
      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: testUserEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();

      // Check DB: hash must now be upgraded to Argon2id transparently!
      const afterUser = await executeQuery('SELECT password_hash FROM users WHERE id = ?', [testUserId]);
      expect(afterUser[0].password_hash).toMatch(/^\$argon2id\$/);
    });
  });

  describe('2. 15-Minute Access Tokens, Rotating Refresh Sessions & Reuse Detection', () => {
    let sessionRefreshToken: string;
    let currentSessionId: string;

    it('issues 15m access token and 30d refresh token session in database', async () => {
      const session = await authService.createSession({
        userId: testUserId,
        email: testUserEmail,
        role: 'PROFESSOR',
        userAgent: 'Vitest Test Agent',
        ip: '127.0.0.1'
      });

      expect(session.accessToken).toBeDefined();
      expect(session.rawRefreshToken).toBeDefined();
      expect(session.sessionId).toBeDefined();

      sessionRefreshToken = session.rawRefreshToken;
      currentSessionId = session.sessionId;

      // Verify token payload includes sessionId
      const payload = await authService.verifyToken(session.accessToken);
      expect(payload.sessionId).toBe(session.sessionId);
      expect(payload.userId).toBe(testUserId);
    });

    it('rotates refresh token on use, revoking the old session and returning a fresh one', async () => {
      const rotation = await authService.rotateRefreshToken(sessionRefreshToken, {
        userAgent: 'Rotated Device',
        ip: '127.0.0.1'
      });

      expect(rotation.success).toBe(true);
      expect(rotation.accessToken).toBeDefined();
      expect(rotation.rawRefreshToken).toBeDefined();
      expect(rotation.sessionId).not.toBe(currentSessionId);

      // Verify previous session is marked revoked
      const oldSession = await executeQuery('SELECT revoked_at FROM sessions WHERE id = ?', [currentSessionId]);
      expect(oldSession[0].revoked_at).not.toBeNull();

      // Update to new refresh token
      sessionRefreshToken = rotation.rawRefreshToken;
      currentSessionId = rotation.sessionId;
    });

    it('CRITICAL SEC-01: Detects refresh token reuse and immediately revokes ALL user sessions', async () => {
      // 1. Create another active session for the same user
      const secondSession = await authService.createSession({
        userId: testUserId,
        email: testUserEmail,
        role: 'PROFESSOR'
      });

      // 2. Consume sessionRefreshToken once
      const firstUse = await authService.rotateRefreshToken(sessionRefreshToken);
      expect(firstUse.success).toBe(true);

      // 3. Re-present the ALREADY CONSUMED sessionRefreshToken (simulates token theft / replay attack)
      const reuseAttempt = await authService.rotateRefreshToken(sessionRefreshToken);
      expect(reuseAttempt.status).toBe(401);
      expect(reuseAttempt.error).toBe('SECURITY_ALERT_TOKEN_REUSED');

      // 4. Verify that ALL active sessions for this user were revoked!
      const activeSessions = await executeQuery(
        'SELECT * FROM sessions WHERE user_id = ? AND revoked_at IS NULL',
        [testUserId]
      );
      expect(activeSessions.length).toBe(0);

      // 5. Verify security event was recorded
      const events = await executeQuery(
        "SELECT * FROM auth_events WHERE user_id = ? AND kind = 'TOKEN_REUSE_DETECTED_ALL_REVOKED'",
        [testUserId]
      );
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('3. Devices & Sessions Management', () => {
    it('allows listing active sessions and revoking individual sessions immediately', async () => {
      const s1 = await authService.createSession({ userId: testUserId, email: testUserEmail, role: 'PROFESSOR' });
      const s2 = await authService.createSession({ userId: testUserId, email: testUserEmail, role: 'PROFESSOR' });

      const activeList = await authService.getUserSessions(testUserId, s1.sessionId);
      expect(activeList.length).toBeGreaterThanOrEqual(2);

      // Revoke s2
      await authService.revokeSession(s2.sessionId, testUserId);
      const updatedList = await authService.getUserSessions(testUserId, s1.sessionId);
      const revokedIds = updatedList.map((s: any) => s.id);
      expect(revokedIds).not.toContain(s2.sessionId);
    });
  });

  describe('4. Safe Password Recovery (SEC-04)', () => {
    it('returns identical uniform response for existing and non-existing emails (Zero Enumeration)', async () => {
      const resReal = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUserEmail });

      const resFake = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent_ghost_999@univ-eloued.dz' });

      expect(resReal.status).toBe(200);
      expect(resFake.status).toBe(200);
      expect(resReal.body.success).toBe(true);
      expect(resFake.body.success).toBe(true);
      expect(resReal.body.message).toBe(resFake.body.message);

      // CRITICAL DoD #1: Zero debugToken in ANY response
      expect(resReal.body.debugToken).toBeUndefined();
      expect(resReal.body.debugLink).toBeUndefined();
      expect(resFake.body.debugToken).toBeUndefined();
    });

    it('completes password reset using single-use hashed token and revokes previous sessions', async () => {
      const recovery = await authService.requestPasswordRecovery(testUserEmail);
      expect(recovery.internalToken).toBeDefined();

      const newPassword = 'BrandNewPassword2026!';
      const resetRes = await authService.completePasswordReset(recovery.internalToken, newPassword);
      expect(resetRes.success).toBe(true);

      // Verify login with new password succeeds
      const checkUser = await executeQuery('SELECT password_hash FROM users WHERE id = ?', [testUserId]);
      const verifyNew = await authService.verifyPassword(checkUser[0].password_hash, newPassword);
      expect(verifyNew.isValid).toBe(true);

      // Verify token cannot be re-used (single-use)
      const secondAttempt = await authService.completePasswordReset(recovery.internalToken, 'AnotherPass!');
      expect(secondAttempt.success).toBe(false);
    });
  });

  describe('5. Closed Onboarding via Invitations (SEC-08)', () => {
    let inviteToken: string;
    const invitedEmail = `invited_scholar_${Date.now()}@univ-eloued.dz`;

    it('rejects public signup when FEATURE_OPEN_SIGNUP is false', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `unauthorized_${Date.now()}@univ-eloued.dz`,
          password: 'Password123!'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('INVITATION_ONLY');
    });

    it('creates an invitation with hashed token storage and 7-day expiration', async () => {
      const invitation = await authService.createInvitation({
        email: invitedEmail,
        role: 'PROFESSOR',
        invitedBy: adminUserId
      });

      expect(invitation.email).toBe(invitedEmail);
      expect(invitation.rawToken).toBeDefined();
      expect(invitation.expiresAt).toBeDefined();
      inviteToken = invitation.rawToken;

      // Verify token is stored as SHA-256 hash in database
      const rows = await executeQuery('SELECT token_hash FROM invitations WHERE email = ?', [invitedEmail]);
      const expectedHash = authService.hashTokenSha256(inviteToken);
      expect(rows[0].token_hash).toBe(expectedHash);
    });

    it('accepts invitation, creates user with email_verified_at timestamp, and marks invite accepted', async () => {
      const acceptedUser = await authService.acceptInvitation({
        rawToken: inviteToken,
        password: 'InvitedUserPass2026!',
        fullName: 'د. أستاذ مدعو'
      });

      expect(acceptedUser.id).toBeDefined();
      expect(acceptedUser.email).toBe(invitedEmail);

      // Verify email_verified_at is populated
      const dbUser = await executeQuery('SELECT email_verified_at FROM users WHERE id = ?', [acceptedUser.id]);
      expect(dbUser[0].email_verified_at).not.toBeNull();

      // Clean up
      await executeQuery('DELETE FROM auth_events WHERE user_id = ?', [acceptedUser.id]);
      await executeQuery('DELETE FROM sessions WHERE user_id = ?', [acceptedUser.id]);
      await executeQuery('DELETE FROM professors WHERE user_id = ?', [acceptedUser.id]);
      await executeQuery('DELETE FROM users WHERE id = ?', [acceptedUser.id]);
      await executeQuery('DELETE FROM invitations WHERE email = ?', [invitedEmail]);
    });
  });

  describe('6. RFC 6238 TOTP Two-Factor Authentication (SEC-10)', () => {
    it('generates base32 secret, 10 backup codes, and otpauth URI', async () => {
      const setup = await authService.setupMfa(testUserId, testUserEmail);
      expect(setup.secret).toBeDefined();
      expect(setup.backupCodes.length).toBe(10);
      expect(setup.otpAuthUri).toContain('otpauth://totp/Djadwal');
    });

    it('verifies TOTP code matching current time step', () => {
      const secret = totp.generateSecret();
      const currentCode = totp.generateTOTP(secret);
      expect(totp.verifyTOTP(currentCode, secret)).toBe(true);
      expect(totp.verifyTOTP('000000', secret)).toBe(false);
    });

    it('enables MFA and verifies login challenge with TOTP and backup recovery code', async () => {
      const secret = totp.generateSecret();
      const backupCodes = totp.generateBackupCodes(10);
      const validCode = totp.generateTOTP(secret);

      // Enable MFA
      const enableRes = await authService.enableMfa(testUserId, validCode, secret, backupCodes);
      expect(enableRes.success).toBe(true);
      expect(await authService.isMfaEnabled(testUserId)).toBe(true);

      // Verify challenge with current TOTP code
      const challengeTotp = await authService.verifyMfaChallenge(testUserId, totp.generateTOTP(secret));
      expect(challengeTotp.verified).toBe(true);

      // Verify challenge with backup recovery code (and confirm single-use consumption)
      const testBackupCode = backupCodes[0];
      const challengeBackup = await authService.verifyMfaChallenge(testUserId, testBackupCode);
      expect(challengeBackup.verified).toBe(true);
      expect(challengeBackup.usedBackupCode).toBe(true);

      // Re-using same backup code must fail
      const reuseBackup = await authService.verifyMfaChallenge(testUserId, testBackupCode);
      expect(reuseBackup.verified).toBe(false);
    });
  });

  describe('7. Progressive Brute-Force Lockout', () => {
    it('locks account after 5 failed attempts for 15 minutes', () => {
      const key = `127.0.0.1:bruteforce_test_${Date.now()}`;
      expect(authService.checkBruteForceLockout(key).isLocked).toBe(false);

      for (let i = 0; i < 5; i++) {
        authService.recordFailedAttempt(key);
      }

      const lockout = authService.checkBruteForceLockout(key);
      expect(lockout.isLocked).toBe(true);
      expect(lockout.remainingSeconds).toBeGreaterThan(0);

      authService.clearFailedAttempts(key);
      expect(authService.checkBruteForceLockout(key).isLocked).toBe(false);
    });
  });
});
