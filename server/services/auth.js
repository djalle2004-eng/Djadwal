const argon2 = require('argon2');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { SignJWT, jwtVerify } = require('jose');
const { executeQuery } = require('../database');
const totp = require('./totp');

/**
 * Djadwal Modernized Identity & Authentication Service (P4)
 * 
 * Capabilities:
 * 1. Argon2id primary password hashing with automatic transparent migration from bcrypt on login.
 * 2. 15-minute access tokens with kid header + 30-day SHA-256 hashed refresh tokens in SQLite.
 * 3. Immediate individual & global session revocation and device management.
 * 4. Automatic token reuse detection (revokes all user sessions when leaked refresh token is reused).
 * 5. Safe password reset (No debugToken, SHA-256 hashed, 15m expiration, uniform responses).
 * 6. Invitation-only onboarding (disabling open signup, token-based verification).
 * 7. Opt-in TOTP two-factor authentication with 10 single-use recovery backup codes.
 * 8. Progressive brute-force lockout & security audit logging (auth_events).
 */

const PRIMARY_JWT_RAW = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const PREVIOUS_JWT_RAW = process.env.JWT_SECRET_PREVIOUS;

const JWT_SECRET = new TextEncoder().encode(PRIMARY_JWT_RAW);
const JWT_SECRET_PREVIOUS = PREVIOUS_JWT_RAW ? new TextEncoder().encode(PREVIOUS_JWT_RAW) : null;

// Argon2id Cost Parameters
const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: parseInt(process.env.ARGON2_MEMORY_COST || '19456', 10), // 19MiB
  timeCost: parseInt(process.env.ARGON2_TIME_COST || '2', 10),         // 2 iterations
  parallelism: parseInt(process.env.ARGON2_PARALLELISM || '1', 10)     // 1 thread
};

// Brute-force Lockout Memory Store (Tracks failed attempts per IP / email)
const failedAttemptsMap = new Map();

function hashTokenSha256(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// ----------------------------------------------------
// 1. Password Hashing & Dual-Verification
// ----------------------------------------------------

async function hashPassword(password) {
  return await argon2.hash(password, ARGON2_CONFIG);
}

async function verifyPassword(storedHash, plainPassword) {
  if (!storedHash || !plainPassword) {
    return { isValid: false, needsUpgrade: false };
  }

  // 1. If stored hash is Argon2id
  if (storedHash.startsWith('$argon2')) {
    try {
      const isValid = await argon2.verify(storedHash, plainPassword);
      return { isValid, needsUpgrade: false };
    } catch (e) {
      return { isValid: false, needsUpgrade: false };
    }
  }

  // 2. If stored hash is bcrypt ($2a$, $2b$, $2y$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    try {
      const isValid = await bcrypt.compare(plainPassword, storedHash);
      // If bcrypt verification succeeds, flag for transparent upgrade to Argon2id!
      return { isValid, needsUpgrade: isValid };
    } catch (e) {
      return { isValid: false, needsUpgrade: false };
    }
  }

  return { isValid: false, needsUpgrade: false };
}

async function upgradePasswordHashIfNeeded(userId, plainPassword, needsUpgrade) {
  if (!needsUpgrade) return;

  try {
    const newHash = await hashPassword(plainPassword);
    await executeQuery('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
    await logAuthEvent(userId, 'HASH_UPGRADED_TO_ARGON2ID', null, null);
    console.log(`🔒 [AuthService] Successfully upgraded password hash to Argon2id for user #${userId}`);
  } catch (err) {
    console.error('Failed to upgrade password hash to Argon2id:', err.message);
  }
}

// ----------------------------------------------------
// 2. Token & Session Management
// ----------------------------------------------------

async function createAccessToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', kid: 'v2' })
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(JWT_SECRET);
}

async function verifyToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch (primaryError) {
    if (JWT_SECRET_PREVIOUS) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET_PREVIOUS);
        return payload;
      } catch (prevError) {
        return null;
      }
    }
    return null;
  }
}

async function createSession({ userId, email, role, userAgent = '', ip = '' }) {
  const sessionId = crypto.randomUUID();
  const rawRefreshToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashTokenSha256(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await executeQuery(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, tokenHash, userAgent, ip, expiresAt.toISOString()]
  );

  const accessToken = await createAccessToken({
    userId,
    email,
    role,
    sessionId
  });

  await logAuthEvent(userId, 'LOGIN_SUCCESS', ip, userAgent);

  return {
    sessionId,
    accessToken,
    rawRefreshToken,
    expiresAt
  };
}

/**
 * Rotates refresh token on use with automated reuse detection
 */
async function rotateRefreshToken(rawRefreshToken, { userAgent = '', ip = '' } = {}) {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    return { error: 'REFRESH_TOKEN_REQUIRED', status: 400 };
  }

  const tokenHash = hashTokenSha256(rawRefreshToken);
  const sessions = await executeQuery('SELECT * FROM sessions WHERE token_hash = ?', [tokenHash]);

  if (sessions.length === 0) {
    return { error: 'INVALID_REFRESH_TOKEN', status: 401 };
  }

  const currentSession = sessions[0];

  // --- TOKEN REUSE DETECTION (SEC-01) ---
  // If session is already marked revoked, an attacker or old client re-submitted a consumed token!
  if (currentSession.revoked_at !== null) {
    console.warn(`🚨 [SEC-ALERT] Refresh token reuse detected for user #${currentSession.user_id}! Revoking all sessions.`);
    // Revoke all active sessions for this user immediately
    await executeQuery(
      'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
      [currentSession.user_id]
    );
    await logAuthEvent(currentSession.user_id, 'TOKEN_REUSE_DETECTED_ALL_REVOKED', ip, userAgent);
    return {
      error: 'SECURITY_ALERT_TOKEN_REUSED',
      message: 'تم رصد استخدام رمز جلسة ملغى، تم إلغاء كافة جلساتك لحماية الحساب',
      status: 401
    };
  }

  // Check expiration
  const now = new Date();
  if (new Date(currentSession.expires_at) < now) {
    return { error: 'SESSION_EXPIRED', status: 401 };
  }

  // Revoke current session (consumed single-use)
  await executeQuery('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?', [currentSession.id]);

  // Fetch current user details
  const users = await executeQuery('SELECT id, email, role, is_active FROM users WHERE id = ?', [currentSession.user_id]);
  if (users.length === 0 || !users[0].is_active) {
    return { error: 'USER_INACTIVE_OR_DELETED', status: 403 };
  }
  const user = users[0];

  // Issue new session & refresh token
  const newSession = await createSession({
    userId: user.id,
    email: user.email,
    role: user.role,
    userAgent: userAgent || currentSession.user_agent,
    ip: ip || currentSession.ip
  });

  await logAuthEvent(user.id, 'TOKEN_ROTATED', ip, userAgent);

  return {
    success: true,
    user: { id: user.id, email: user.email, role: user.role },
    accessToken: newSession.accessToken,
    rawRefreshToken: newSession.rawRefreshToken,
    sessionId: newSession.sessionId
  };
}

async function getUserSessions(userId, currentSessionId = null) {
  const rows = await executeQuery(
    `SELECT id, user_agent, ip, created_at, expires_at, revoked_at
     FROM sessions
     WHERE user_id = ? AND revoked_at IS NULL AND datetime(expires_at) > datetime('now')
     ORDER BY created_at DESC`,
    [userId]
  );

  return rows.map(r => ({
    id: r.id,
    userAgent: r.user_agent || 'Unknown Device',
    ip: r.ip || 'Unknown IP',
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    isCurrent: r.id === currentSessionId
  }));
}

async function revokeSession(sessionId, userId) {
  const result = await executeQuery(
    'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [sessionId, userId]
  );
  await logAuthEvent(userId, 'SESSION_REVOKED', null, null);
  return result;
}

async function revokeAllUserSessions(userId, exceptSessionId = null) {
  let query = 'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL';
  const params = [userId];

  if (exceptSessionId) {
    query += ' AND id != ?';
    params.push(exceptSessionId);
  }

  const result = await executeQuery(query, params);
  await logAuthEvent(userId, exceptSessionId ? 'OTHER_SESSIONS_REVOKED' : 'ALL_SESSIONS_REVOKED', null, null);
  return result;
}

// ----------------------------------------------------
// 3. Brute-Force Lockout Guard
// ----------------------------------------------------

function checkBruteForceLockout(identifier) {
  const now = Date.now();
  const record = failedAttemptsMap.get(identifier);

  if (!record) return { isLocked: false, remainingSeconds: 0 };

  // Reset if window (15 mins) expired
  if (now - record.firstAttemptTime > 15 * 60 * 1000) {
    failedAttemptsMap.delete(identifier);
    return { isLocked: false, remainingSeconds: 0 };
  }

  if (record.count >= 5) {
    const lockExpiresAt = record.lastAttemptTime + 15 * 60 * 1000;
    if (now < lockExpiresAt) {
      const remainingSeconds = Math.ceil((lockExpiresAt - now) / 1000);
      return { isLocked: true, remainingSeconds };
    } else {
      failedAttemptsMap.delete(identifier);
      return { isLocked: false, remainingSeconds: 0 };
    }
  }

  return { isLocked: false, remainingSeconds: 0 };
}

function recordFailedAttempt(identifier) {
  const now = Date.now();
  const record = failedAttemptsMap.get(identifier) || { count: 0, firstAttemptTime: now, lastAttemptTime: now };
  record.count++;
  record.lastAttemptTime = now;
  failedAttemptsMap.set(identifier, record);
}

function clearFailedAttempts(identifier) {
  failedAttemptsMap.delete(identifier);
}

// ----------------------------------------------------
// 4. Safe Password Recovery (SEC-04)
// ----------------------------------------------------

async function requestPasswordRecovery(email, { ip = '', ua = '' } = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return { success: true };
  }

  const users = await executeQuery('SELECT id, email FROM users WHERE LOWER(email) = ?', [cleanEmail]);
  if (users.length === 0) {
    // UNIFORM RESPONSE: Never disclose account existence
    return { success: true };
  }

  const user = users[0];

  // Invalidate previous reset tokens for this user
  await executeQuery(
    'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL',
    [user.id]
  );

  // Generate single-use token, 15 minutes validity
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashTokenSha256(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  await executeQuery(
    'INSERT INTO password_reset_tokens (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [user.id, tokenHash, tokenHash, expiresAt.toISOString()]
  );

  await logAuthEvent(user.id, 'PASSWORD_RESET_REQUESTED', ip, ua);

  return {
    success: true,
    // Returned ONLY internally for mailer dispatch; NEVER rendered to API responses
    internalToken: rawToken,
    internalUser: user
  };
}

async function completePasswordReset(rawToken, newPassword) {
  if (!rawToken || !newPassword) {
    return { success: false, error: 'رمز الاستعادة وكلمة المرور الجديدة مطلوبان' };
  }

  const tokenHash = hashTokenSha256(rawToken);
  const records = await executeQuery(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')`,
    [tokenHash]
  );

  if (records.length === 0) {
    return {
      success: false,
      error: 'رمز استعادة كلمة المرور غير صالح أو منتهي الصلاحية'
    };
  }

  const resetRecord = records[0];
  const newHash = await hashPassword(newPassword);

  // Update password and mark token used
  await executeQuery('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, resetRecord.user_id]);
  await executeQuery('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [resetRecord.id]);

  // Revoke all active sessions for this user on password change
  await executeQuery(
    'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
    [resetRecord.user_id]
  );

  await logAuthEvent(resetRecord.user_id, 'PASSWORD_RESET_COMPLETED', null, null);

  return { success: true };
}

// ----------------------------------------------------
// 5. Invitations Flow (SEC-08)
// ----------------------------------------------------

async function createInvitation({ email, role = 'PROFESSOR', invitedBy = null }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('البريد الإلكتروني غير صحيح');
  }

  const existingUsers = await executeQuery('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
  if (existingUsers.length > 0) {
    throw new Error('يوجد حساب مسجل بالفعل بهذا البريد الإلكتروني');
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashTokenSha256(rawToken);
  const invitationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await executeQuery(
    `INSERT INTO invitations (id, email, role, token_hash, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       token_hash = excluded.token_hash,
       expires_at = excluded.expires_at,
       accepted_at = NULL`,
    [invitationId, cleanEmail, role.toUpperCase(), tokenHash, invitedBy, expiresAt.toISOString()]
  );

  if (invitedBy) {
    await logAuthEvent(invitedBy, 'INVITATION_CREATED', null, null);
  }

  return {
    invitationId,
    email: cleanEmail,
    role: role.toUpperCase(),
    rawToken,
    expiresAt
  };
}

async function acceptInvitation({ rawToken, password, fullName = '' }) {
  if (!rawToken || !password) {
    throw new Error('رمز الدعوة وكلمة المرور مطلوبان');
  }

  const tokenHash = hashTokenSha256(rawToken);
  const records = await executeQuery(
    `SELECT * FROM invitations
     WHERE token_hash = ? AND accepted_at IS NULL AND datetime(expires_at) > datetime('now')`,
    [tokenHash]
  );

  if (records.length === 0) {
    throw new Error('رابط الدعوة غير صالح أو منتهي الصلاحية');
  }

  const inv = records[0];
  const hashedPassword = await hashPassword(password);
  const safeEmail = inv.email;
  const username = safeEmail.split('@')[0] + '_' + crypto.randomBytes(2).toString('hex');

  // Insert user with email_verified_at set
  const userRows = await executeQuery(
    `INSERT INTO users (username, email, password_hash, full_name, role, is_active, email_verified_at)
     VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
     RETURNING id, email, role, full_name`,
    [username, safeEmail, hashedPassword, fullName || username, inv.role]
  );
  const user = userRows[0];

  // Mark invitation accepted
  await executeQuery('UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = ?', [inv.id]);

  // Create professor profile placeholder if role is PROFESSOR
  if (inv.role === 'PROFESSOR') {
    try {
      await executeQuery(
        `INSERT INTO professors (user_id, name, professional_email, full_name_arabic, full_name_latin, academic_rank, department, primary_phone, phd_specialization)
         VALUES (?, ?, ?, ?, '', '', '', '', '')`,
        [user.id, fullName || username, safeEmail, fullName || '']
      );
    } catch (e) {}
  }

  await logAuthEvent(user.id, 'INVITATION_ACCEPTED', null, null);

  return user;
}

// ----------------------------------------------------
// 6. Two-Factor Authentication (MFA / TOTP)
// ----------------------------------------------------

async function setupMfa(userId, userEmail) {
  const secret = totp.generateSecret();
  const backupCodes = totp.generateBackupCodes(10);
  const otpAuthUri = totp.generateOtpAuthUri({
    account: userEmail,
    issuer: 'Djadwal',
    secret
  });

  return {
    secret,
    otpAuthUri,
    backupCodes
  };
}

async function enableMfa(userId, code, secret, backupCodes) {
  const isValid = totp.verifyTOTP(code, secret);
  if (!isValid) {
    return { success: false, error: 'رمز التحقق 2FA غير صحيح' };
  }

  // Hash backup codes before saving
  const hashedBackupCodes = backupCodes.map(c => hashTokenSha256(c));

  await executeQuery(
    `INSERT INTO mfa_factors (user_id, secret, backup_codes, enabled_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       secret = excluded.secret,
       backup_codes = excluded.backup_codes,
       enabled_at = CURRENT_TIMESTAMP`,
    [userId, secret, JSON.stringify(hashedBackupCodes)]
  );

  await logAuthEvent(userId, 'MFA_ENABLED', null, null);

  return { success: true };
}

async function verifyMfaChallenge(userId, tokenOrBackupCode) {
  const factors = await executeQuery('SELECT * FROM mfa_factors WHERE user_id = ? AND enabled_at IS NOT NULL', [userId]);
  if (factors.length === 0) {
    return { verified: true };
  }

  const factor = factors[0];
  const cleanInput = String(tokenOrBackupCode || '').trim();

  // 1. Try TOTP Code
  if (totp.verifyTOTP(cleanInput, factor.secret)) {
    return { verified: true };
  }

  // 2. Try Backup Code
  const inputHash = hashTokenSha256(cleanInput.toUpperCase());
  let storedCodes = [];
  try {
    storedCodes = JSON.parse(factor.backup_codes || '[]');
  } catch (e) {}

  const codeIndex = storedCodes.indexOf(inputHash);
  if (codeIndex !== -1) {
    // Consume single-use backup code
    storedCodes.splice(codeIndex, 1);
    await executeQuery('UPDATE mfa_factors SET backup_codes = ? WHERE id = ?', [JSON.stringify(storedCodes), factor.id]);
    await logAuthEvent(userId, 'MFA_BACKUP_CODE_USED', null, null);
    return { verified: true, usedBackupCode: true, remainingBackupCodes: storedCodes.length };
  }

  return { verified: false, error: 'رمز المصادقة الثنائية غير صحيح' };
}

async function isMfaEnabled(userId) {
  const factors = await executeQuery('SELECT id FROM mfa_factors WHERE user_id = ? AND enabled_at IS NOT NULL', [userId]);
  return factors.length > 0;
}

// ----------------------------------------------------
// 7. Security Audit Logging
// ----------------------------------------------------

async function logAuthEvent(userId, kind, ip = null, ua = null) {
  try {
    await executeQuery(
      'INSERT INTO auth_events (user_id, kind, ip, ua) VALUES (?, ?, ?, ?)',
      [userId || null, kind, ip || null, ua || null]
    );
  } catch (e) {
    console.error('Failed to write auth event:', e.message);
  }
}

module.exports = {
  // Password hashing
  hashPassword,
  verifyPassword,
  upgradePasswordHashIfNeeded,

  // Tokens & Sessions
  createAccessToken,
  verifyToken,
  createSession,
  rotateRefreshToken,
  getUserSessions,
  revokeSession,
  revokeAllUserSessions,

  // Lockout
  checkBruteForceLockout,
  recordFailedAttempt,
  clearFailedAttempts,

  // Recovery
  requestPasswordRecovery,
  completePasswordReset,

  // Invitations
  createInvitation,
  acceptInvitation,

  // MFA
  setupMfa,
  enableMfa,
  verifyMfaChallenge,
  isMfaEnabled,

  // Auditing
  logAuthEvent,
  hashTokenSha256
};
