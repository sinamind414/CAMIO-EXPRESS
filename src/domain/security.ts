import crypto from 'node:crypto';

/**
 * Sécurité serveur — modèle inspiré de l'analyse fonctionnelle Lalamove
 * (sessions signées, autorisation par rôle, idempotence, rate limiting).
 *
 * Aucun secret n'est codé en dur en production : SESSION_SECRET doit être fourni.
 * En développement, une valeur par défaut est utilisée avec un avertissement.
 */

export interface SessionIdentity {
  sub: string; // téléphone vérifié (E.164)
  role: 'client' | 'driver' | 'admin';
  name: string;
  iat: number;
  exp: number;
}

const SESSION_COOKIE = 'camio_sid';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET doit être défini (>= 16 caractères) en production');
  }
  return 'camio-dev-secret-change-me-1234567890';
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

/** Crée un token de session signé HMAC-SHA256. */
export function createSessionToken(identity: Omit<SessionIdentity, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionIdentity = {
    ...identity,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/** Vérifie un token : signature, expiration, champs requis. Retourne null si invalide. */
export function verifySessionToken(token: string | undefined | null): SessionIdentity | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionIdentity;
    if (!payload.sub || !payload.role || typeof payload.exp !== 'number') return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getSessionFromRequest(req: { headers: { cookie?: string; authorization?: string } }): SessionIdentity | null {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE]) return verifySessionToken(cookies[SESSION_COOKIE]);
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return verifySessionToken(auth.slice(7));
  return null;
}

/** En-tête Set-Cookie pour la session (httpOnly, SameSite=Lax, Secure en production). */
export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

/** Code OTP de démonstration : configurable, jamais renvoyé au client. */
export function getDemoOtpCode(): string {
  return process.env.OTP_DEMO_CODE ?? '00000';
}

/** Limiteur de débit simple en mémoire (par IP + chemin). */
export function createRateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, number[]>();
  return (key: string): { allowed: boolean; retryAfterSec: number } => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      hits.set(key, arr);
      return { allowed: false, retryAfterSec: Math.ceil((arr[0] + windowMs - now) / 1000) };
    }
    arr.push(now);
    hits.set(key, arr);
    return { allowed: true, retryAfterSec: 0 };
  };
}

/** Garde d'idempotence : une même clé ne peut être consommée qu'une fois. */
export function createIdempotencyGuard(ttlMs: number) {
  const seen = new Map<string, number>();
  return (key: string | undefined): boolean => {
    if (!key) return true; // pas de clé = non protégé (compatibilité)
    const now = Date.now();
    for (const [k, t] of seen) if (now - t > ttlMs) seen.delete(k);
    if (seen.has(key)) return false;
    seen.set(key, now);
    return true;
  };
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
