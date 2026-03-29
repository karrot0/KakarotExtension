import type {
  KenmeiEntryPayload,
  KenmeiEntryResponse,
  KenmeiEntryV2,
  KenmeiEntryV2Response,
  KenmeiLibraryResponse,
  KenmeiLoginResponse,
  KenmeiMangaSeriesResponse,
  KenmeiMangaSourcesResponse,
  KenmeiSearchResponse,
  KenmeiSession,
  KenmeiSourceChaptersResponse,
  KenmeiUserProfile,
} from "../Implementations/Shared/types";
import { assertMustBeAuthenticated, getSession } from "../Implementations/Shared/session";

const BASE_URL = "https://api.kenmei.co";

function authHeaders(): Record<string, string> {
  const sess = getSession();
  const headers: Record<string, string> = {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    origin: "https://www.kenmei.co",
    referer: "https://www.kenmei.co/",
    "content-type": "application/json",
  };
  if (sess?.accessToken) {
    headers["authorization"] = `Bearer ${sess.accessToken}`;
  }
  return headers;
}

async function scheduleJson<T>(request: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<T> {
  const [response, data] = await Application.scheduleRequest({
    url: request.url,
    method: request.method,
    headers: request.headers ?? authHeaders(),
    body: request.body,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Kenmei API error (${response.status}) for ${request.url}`);
  }

  const text = Application.arrayBufferToUTF8String(data);
  return JSON.parse(text) as T;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<KenmeiSession> {
  const payload = {
    user: { login: email, password, remember_me: true },
  };

  const result = await scheduleJson<KenmeiLoginResponse>({
    url: `${BASE_URL}/auth/sessions`,
    method: "POST",
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json",
      origin: "https://www.kenmei.co",
      referer: "https://www.kenmei.co/",
    },
    body: JSON.stringify(payload),
  });

  return {
    accessToken: result.access,
    userId: result.user_id,
    username: result.username,
  };
}

export async function logout(): Promise<void> {
  // Kenmei doesn't require a server-side logout call; token expires server-side.
  // Session is cleared locally by the caller.
}

// ── Search ───────────────────────────────────────────────────────────────────

export async function searchSeries(searchTerm: string, page = 1): Promise<KenmeiSearchResponse> {
  const url = `${BASE_URL}/api/v2/series_search?search_term=${encodeURIComponent(searchTerm)}&page=${page}`;
  return scheduleJson<KenmeiSearchResponse>({ url, method: "GET" });
}

// ── Series detail ─────────────────────────────────────────────────────────────

export async function getSeriesDetail(slug: string): Promise<KenmeiMangaSeriesResponse> {
  const url = `${BASE_URL}/api/v1/manga_series/${encodeURIComponent(slug)}`;
  return scheduleJson<KenmeiMangaSeriesResponse>({ url, method: "GET" });
}

// ── User library entries ───────────────────────────────────────────────────────

export async function getEntryForSeries(mangaSeriesId: number): Promise<KenmeiEntryResponse | null> {
  const sess = assertMustBeAuthenticated();
  const url = `${BASE_URL}/api/v1/manga_list_entries?manga_series_id=${mangaSeriesId}&user_id=${sess.userId}`;
  try {
    return await scheduleJson<KenmeiEntryResponse>({ url, method: "GET" });
  } catch {
    return null;
  }
}

export async function upsertEntry(payload: KenmeiEntryPayload): Promise<KenmeiEntryResponse> {
  assertMustBeAuthenticated();
  // Use POST to create; Kenmei will handle duplicate on its end.
  return scheduleJson<KenmeiEntryResponse>({
    url: `${BASE_URL}/api/v1/manga_list_entries`,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEntry(
  entryId: number,
  payload: KenmeiEntryPayload,
): Promise<KenmeiEntryResponse> {
  assertMustBeAuthenticated();
  return scheduleJson<KenmeiEntryResponse>({
    url: `${BASE_URL}/api/v1/manga_list_entries/${entryId}`,
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteEntry(entryId: number): Promise<void> {
  assertMustBeAuthenticated();
  const [response] = await Application.scheduleRequest({
    url: `${BASE_URL}/api/v1/manga_list_entries/${entryId}`,
    method: "DELETE",
    headers: authHeaders(),
  });
  if (response.status !== 200 && response.status !== 204) {
    throw new Error(`Failed to delete entry ${entryId}: status ${response.status}`);
  }
}

// ── v2 manga_entries API ──────────────────────────────────────────────────────

/**
 * GET /api/v2/manga_entries/{mangaSeriesId}
 * Returns the user's entry for the given manga_series_id, or null if not in list.
 */
export async function getEntryBySeriesId(mangaSeriesId: number): Promise<KenmeiEntryV2 | null> {
  assertMustBeAuthenticated();
  try {
    const result = await scheduleJson<KenmeiEntryV2Response>({
      url: `${BASE_URL}/api/v2/manga_entries/${mangaSeriesId}`,
      method: "GET",
    });
    return result.data;
  } catch {
    return null;
  }
}

/**
 * POST /api/v2/manga_entries
 * Creates a new entry for the series.
 */
export async function createEntryV2(payload: {
  status: number;
  manga_source_id?: number;
  manga_source_chapter_id?: number;
  hidden?: boolean;
  favourite?: boolean;
  score?: number;
  notes?: string;
  user_tag_ids?: number[];
}): Promise<KenmeiEntryV2> {
  assertMustBeAuthenticated();
  const result = await scheduleJson<KenmeiEntryV2Response>({
    url: `${BASE_URL}/api/v2/manga_entries`,
    method: "POST",
    body: JSON.stringify({ manga_entry: payload }),
  });
  return result.data;
}

/**
 * PUT /api/v2/manga_entries/{entryId}
 * Updates the user's entry by its entry ID (not the series ID).
 */
export async function updateEntryV2(
  entryId: number,
  payload: {
    status?: number;
    score?: number;
    notes?: string;
    hidden?: boolean;
    favourite?: boolean;
    manga_source_chapter_id?: number;
  },
): Promise<KenmeiEntryV2> {
  assertMustBeAuthenticated();
  const result = await scheduleJson<KenmeiEntryV2Response>({
    url: `${BASE_URL}/api/v2/manga_entries/${entryId}`,
    method: "PUT",
    body: JSON.stringify({ manga_entry: payload }),
  });
  return result.data;
}

/**
 * DELETE /api/v2/manga_entries/{entryId}
 */
export async function deleteEntryV2(entryId: number): Promise<void> {
  assertMustBeAuthenticated();
  const [response] = await Application.scheduleRequest({
    url: `${BASE_URL}/api/v2/manga_entries/${entryId}`,
    method: "DELETE",
    headers: authHeaders(),
  });
  if (response.status !== 200 && response.status !== 204) {
    throw new Error(`Failed to delete entry ${entryId}: status ${response.status}`);
  }
}

/**
 * GET /api/v2/manga_entries?page={page}&status={status}
 * Fetches the user's library (all entries, or filtered by status code).
 */
export async function getLibrary(page = 1, status?: number): Promise<KenmeiLibraryResponse> {
  assertMustBeAuthenticated();
  let url = `${BASE_URL}/api/v2/manga_entries?page=${page}`;
  if (status != null) url += `&status=${status}`;
  return scheduleJson<KenmeiLibraryResponse>({ url, method: "GET" });
}

// ── User profiles ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/user_profiles/{username}
 * Returns public profile including library counts.
 */
export async function getUserProfile(username: string): Promise<KenmeiUserProfile> {
  assertMustBeAuthenticated();
  return scheduleJson<KenmeiUserProfile>({
    url: `${BASE_URL}/api/v1/user_profiles/${encodeURIComponent(username)}`,
    method: "GET",
  });
}

// ── manga_sources ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/manga_sources?manga_source[filter][manga_series]={mangaSeriesId}
 * Returns all sources for the given series.
 */
export async function getMangaSources(mangaSeriesId: number): Promise<KenmeiMangaSourcesResponse> {
  assertMustBeAuthenticated();
  const url = `${BASE_URL}/api/v1/manga_sources?manga_source%5Bfilter%5D%5Bmanga_series%5D=${mangaSeriesId}`;
  return scheduleJson<KenmeiMangaSourcesResponse>({ url, method: "GET" });
}

/**
 * GET /api/v1/manga_source_chapters?manga_source_ids[]={sourceId}&query=
 * Returns all chapters for the given source (optionally filtered by query string).
 */
export async function getMangaSourceChapters(
  mangaSourceId: number,
  query = "",
): Promise<KenmeiSourceChaptersResponse> {
  assertMustBeAuthenticated();
  const url = `${BASE_URL}/api/v1/manga_source_chapters?manga_source_ids%5B%5D=${mangaSourceId}&query=${encodeURIComponent(query)}`;
  return scheduleJson<KenmeiSourceChaptersResponse>({ url, method: "GET" });
}
