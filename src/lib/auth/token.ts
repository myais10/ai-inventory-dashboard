// HMAC-signed session token. Web Crypto only, so it runs in the Edge middleware and in Node.

export const SESSION_COOKIE = "phoonica_session";
export const SESSION_TTL_MS = 14 * 86_400_000;

export interface SessionToken {
  uid: string;
  oid: string;
  iat: number;
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production" && process.env.PHOONICA_ALLOW_DEV_SECRET !== "1") {
    throw new Error("AUTH_SECRET must be set in production");
  }
  return s || "dev-only-insecure-secret-change-me";
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

export async function signToken(payload: SessionToken): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

export async function verifyToken(token: string | undefined): Promise<SessionToken | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(body);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionToken;
    if (!p.uid || !p.oid || Date.now() - p.iat > SESSION_TTL_MS) return null;
    return p;
  } catch {
    return null;
  }
}
