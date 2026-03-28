const STATE_KEY = "lofcg_session";

export interface Session {
  username: string;
  userId: string;
}

export function getSession(): Session | undefined {
  const raw = Application.getSecureState(STATE_KEY) as string | null;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return undefined;
  }
}

export function setSession(sess: Session): void {
  Application.setSecureState(JSON.stringify(sess), STATE_KEY);
}

export function clearSession(): void {
  Application.setSecureState(null, STATE_KEY);
}

export function assertMustBeAuthenticated(): void {
  if (!getSession()) {
    throw new Error(
      "You are not authenticated. Please log in through the League of Comic Geeks settings.",
    );
  }
}
