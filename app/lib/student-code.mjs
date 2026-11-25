import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

// Bearer credentials: 128 bits of randomness; store only the digest.
export function createStudentCode() {
  return randomBytes(16).toString('base64url');
}
export function codeDigest(code) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(code)) return null;
  return createHash('sha256').update(code, 'utf8').digest();
}
export function verifyStudentCode(code, storedDigest) {
  const digest = codeDigest(code);
  return !!digest && Buffer.isBuffer(storedDigest) && storedDigest.length === digest.length && timingSafeEqual(digest, storedDigest);
}

