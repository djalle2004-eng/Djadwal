const crypto = require('crypto');

/**
 * Djadwal RFC 6238 TOTP Service
 * Standards-compliant, dependency-free Time-based One-Time Password engine.
 * Compatible with Google Authenticator, Microsoft Authenticator, etc.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Base32 encoding
function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

// Base32 decoding
function base32Decode(str) {
  const clean = str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

// Generate random secret (20 bytes = 160 bits, standard)
function generateSecret() {
  const buf = crypto.randomBytes(20);
  return base32Encode(buf);
}

// Generate HOTP code for counter
function generateHOTP(secretBase32, counter) {
  const key = base32Decode(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const codeInt =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = codeInt % 1000000;
  return otp.toString().padStart(6, '0');
}

// Generate TOTP for current or specific timestamp
function generateTOTP(secretBase32, timestamp = Date.now(), stepSeconds = 30) {
  const counter = Math.floor(timestamp / 1000 / stepSeconds);
  return generateHOTP(secretBase32, counter);
}

// Verify TOTP code with window of ±1 step (±30s)
function verifyTOTP(token, secretBase32, window = 1, timestamp = Date.now(), stepSeconds = 30) {
  if (!token || typeof token !== 'string') return false;
  const cleanToken = token.trim();
  if (cleanToken.length !== 6) return false;

  const currentCounter = Math.floor(timestamp / 1000 / stepSeconds);

  for (let i = -window; i <= window; i++) {
    const generated = generateHOTP(secretBase32, currentCounter + i);
    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(generated))) {
      return true;
    }
  }

  return false;
}

// Generate single-use recovery backup codes
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(2).toString('hex');
    const part2 = crypto.randomBytes(2).toString('hex');
    codes.push(`${part1}-${part2}`.toUpperCase());
  }
  return codes;
}

// Generate standard otpauth URI
function generateOtpAuthUri({ account, issuer = 'Djadwal', secret }) {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(account);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateBackupCodes,
  generateOtpAuthUri,
  base32Encode,
  base32Decode
};
