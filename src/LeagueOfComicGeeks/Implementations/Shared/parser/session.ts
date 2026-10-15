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

const AUTO_READ_KEY = "lofcg_auto_mark_read";
const AUTO_COLLECT_KEY = "lofcg_auto_add_collection";

/** Mark each issue you finish as read on League of Comic Geeks (default on). */
export function getAutoMarkRead(): boolean {
  return Application.getState(AUTO_READ_KEY) !== false;
}

export function setAutoMarkRead(value: boolean): void {
  Application.setState(value, AUTO_READ_KEY);
}

/** Also add each issue you finish to your collection (default off). */
export function getAutoAddToCollection(): boolean {
  return Application.getState(AUTO_COLLECT_KEY) === true;
}

export function setAutoAddToCollection(value: boolean): void {
  Application.setState(value, AUTO_COLLECT_KEY);
}
