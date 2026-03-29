import type { KenmeiSession } from "./types";

const STATE_KEY = "kenmei_session";

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

export function assertMustBeAuthenticated(): KenmeiSession {
  const sess = getSession();
  if (!sess) {
    throw new Error("You are not logged in. Please log in through the Kenmei settings.");
  }
  return sess;
}
