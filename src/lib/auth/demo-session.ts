// Signed-cookie session used in demo mode (no Supabase configured).
// Uses Web Crypto so it works in both the Edge middleware and Node server runtime.

export const DEMO_COOKIE = "aii_session";

export interface DemoSessionPayload {
  userId: string;
  email: string;
  fullName: string;
  role: "owner" | "admin" | "manager" | "viewer";
  companyId: string;
  companyName: string;
  industry: string;
  trialStart: string;
  trialEnd: string;
  onboarded: boolean;
  dataSource: "sample" | "import";
  iat: number;
}

function secret() {
  // In production a real AUTH_SECRET must be set; the fallback only exists for local demo use.
  return process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me";
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
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

export async function signSession(payload: DemoSessionPayload): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

export async function verifySession(token: string | undefined): Promise<DemoSessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(body);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as DemoSessionPayload;
    // 14-day session lifetime
    if (Date.now() - payload.iat > 14 * 86_400_000) return null;
    return payload;
  } catch {
    return null;
  }
}
