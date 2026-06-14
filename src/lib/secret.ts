// Single source for the HMAC signing secret used by sessions and reset tokens.
// In production a missing AUTH_SECRET is fatal — we must never silently fall back
// to a public default (that would let anyone forge an owner session). In dev we
// allow a clearly-insecure fallback so local setup works without config.
const DEV_FALLBACK = 'dev-insecure-secret-change-me';

export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is not set (or too short). Set a strong AUTH_SECRET in the environment.');
  }
  return DEV_FALLBACK;
}
