import type { KenmeiSession } from "./types";

const STATE_KEY = "kenmei_session";
const CREDENTIALS_KEY = "kenmei_credentials";

export function getSession(): KenmeiSession | undefined {
  const raw = Application.getSecureState(STATE_KEY) as string | null;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as KenmeiSession;
  } catch {
    return undefined;
  }
}

export function setSession(sess: KenmeiSession): void {
  Application.setSecureState(JSON.stringify(sess), STATE_KEY);
}

export function clearSession(): void {
  Application.setSecureState(null, STATE_KEY);
}

export interface KenmeiCredentials {
  email: string;
  password: string;
}

export function getCredentials(): KenmeiCredentials | undefined {
  const raw = Application.getSecureState(CREDENTIALS_KEY) as string | null;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as KenmeiCredentials;
  } catch {
    return undefined;
  }
}

export function setCredentials(email: string, password: string): void {
  Application.setSecureState(JSON.stringify({ email, password }), CREDENTIALS_KEY);
}

export function clearCredentials(): void {
  Application.setSecureState(null, CREDENTIALS_KEY);
}

/**
 * Decodes the `exp` claim from a JWT (no signature verification — used only for
 * local expiry checks). Returns `undefined` if the token can't be parsed.
 */
export function decodeJwtExpiry(token: string): number | undefined {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;
    // base64url → base64 → decode
    const b64 = (parts[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const decoded = atob(padded);
    const payload = JSON.parse(decoded) as Record<string, unknown>;
    const exp = payload["exp"];
    return typeof exp === "number" ? exp : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns true when the stored access token is known to be expired
 * (i.e. `expiresAt` is set and within 60 seconds of now).
 */
export function isSessionExpired(sess: KenmeiSession): boolean {
  if (sess.expiresAt == null) return false;
  return Date.now() / 1000 >= sess.expiresAt - 60;
}

export function assertMustBeAuthenticated(): KenmeiSession {
  const sess = getSession();
  if (!sess) {
    throw new Error("You are not logged in. Please log in through the Kenmei settings.");
  }
  return sess;
}
