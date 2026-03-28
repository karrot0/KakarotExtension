import * as cheerio from "cheerio";
import type { LOFCGGetComicsParams } from "../Implementations/Shared/models/main";
import { LIST_IDS } from "../Implementations/Shared/models/main";
import type { Session } from "../Implementations/Shared/parser/session";
import { session } from "../Implementations/Shared/parser/main";

const BASE_URL = "https://leagueofcomicgeeks.com";
const GET_COMICS_URL = `${BASE_URL}/comic/get_comics`;
const SEARCH_AJAX_URL = `${BASE_URL}/search/ajax_issues`;
const MY_LIST_MOVE_URL = `${BASE_URL}/comic/my_list_move`;
const MY_LIST_BULK_URL = `${BASE_URL}/comic/my_list_bulk`;
const LOGIN_URL = `${BASE_URL}/login`;
const LOGOUT_URL = `${BASE_URL}/logout`;

function buildQueryString(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

function buildFormBody(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

function baseHeaders(): Record<string, string> {
  return {
    "accept": "application/json, text/html, */*",
    "accept-language": "en-US,en;q=0.9",
    "user-agent": "Mozilla/5.0 (compatible; Paperback)",
  };
}

export async function login(username: string, password: string): Promise<Session> {
  const logPrefix = "[lofcg:login]";
  console.log(`${logPrefix} starts`);

  const body = buildFormBody({ username, password });

  const [response, data] = await Application.scheduleRequest({
    url: LOGIN_URL,
    method: "POST",
    headers: {
      ...baseHeaders(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (response.status !== 200 && response.status !== 302) {
    throw new Error(`Login request failed with status ${response.status}`);
  }

  const html = Application.arrayBufferToUTF8String(data);
  const $ = cheerio.load(html);

  // If the login page form is still present with no user context → credentials were wrong
  const loginError = $(".alert-error, .alert-danger").first().text().trim();
  if (loginError) {
    throw new Error(loginError);
  }

  const stillOnLoginPage =
    $("form[action*='/login']").length > 0 &&
    $("a[href*='/profile/'], .user-nav, .user-menu, [data-userid]").length === 0;
  if (stillOnLoginPage) {
    throw new Error("Invalid username or password.");
  }

  // Extract userId from page if available
  let userId = "";
  const userIdMatch = html.match(/["']user_id["']\s*:\s*["']?(\d+)["']?/i)
    ?? html.match(/data-userid=["'](\d+)["']/i)
    ?? html.match(/\/profile\/[^/]+\/(\d+)/i);
  if (userIdMatch?.[1]) userId = userIdMatch[1];

  // Prefer username from profile link in case server normalises capitalisation
  let resolvedUsername = username;
  const profileHref = $("a[href*='/profile/']").first().attr("href");
  const profileMatch = profileHref?.match(/\/profile\/([^/?#]+)/);
  if (profileMatch?.[1]) resolvedUsername = profileMatch[1];

  console.log(`${logPrefix} complete - user: ${resolvedUsername}`);
  return { username: resolvedUsername, userId };
}

export async function logout(): Promise<void> {
  const logPrefix = "[lofcg:logout]";
  console.log(`${logPrefix} starts`);
  try {
    await Application.scheduleRequest({
      url: LOGOUT_URL,
      method: "GET",
      headers: baseHeaders(),
    });
  } catch (e) {
    console.log(`${logPrefix} request error (ignoring): ${String(e)}`);
  }
  session.clearSession();
  console.log(`${logPrefix} complete`);
}

export async function getComics(
  params: LOFCGGetComicsParams,
): Promise<{ list: string; myUserId: number }> {
  const logPrefix = `[lofcg:getComics] list=${params.list}`;
  console.log(`${logPrefix} starts`);

  const query = buildQueryString({
    list: params.list,
    list_option: params.list_option ?? "series",
    view: params.view ?? (params.list_option === "issue" ? "list" : "thumbs"),
    order: params.order ?? "alpha-asc",
    user_id: params.user_id,
    title: params.title,
    date: params.date,
    date_type: params.date_type,
    page: params.page,
    per_page: params.per_page,
  });

  const url = `${GET_COMICS_URL}?${query}`;
  const [response, data] = await Application.scheduleRequest({
    url,
    method: "GET",
    headers: baseHeaders(),
  });

  if (response.status !== 200) {
    throw new Error(`getComics failed with status ${response.status}`);
  }

  const body = Application.arrayBufferToUTF8String(data);
  let parsed: { list?: string; configurator?: { my_user_id?: number } };
  try {
    parsed = JSON.parse(body) as { list?: string; configurator?: { my_user_id?: number } };
  } catch {
    throw new Error("getComics: unable to parse response JSON");
  }

  const myUserId = parsed.configurator?.my_user_id ?? 0;

  if (!parsed.list) {
    console.log(`${logPrefix} empty list`);
    return { list: "", myUserId };
  }

  console.log(`${logPrefix} complete`);
  return { list: parsed.list, myUserId };
}

export async function searchAjax(query: string): Promise<string> {
  const logPrefix = "[lofcg:searchAjax]";
  console.log(`${logPrefix} starts: ${query}`);

  const qs = buildQueryString({ query });
  const [response, data] = await Application.scheduleRequest({
    url: `${SEARCH_AJAX_URL}?${qs}`,
    method: "GET",
    headers: baseHeaders(),
  });

  if (response.status !== 200) {
    throw new Error(`searchAjax failed with status ${response.status}`);
  }

  console.log(`${logPrefix} complete`);
  return Application.arrayBufferToUTF8String(data);
}

export async function modifyList(
  comicId: string,
  listId: number,
  actionId: 0 | 1,
): Promise<void> {
  // comicId is a URL path like "comics/series/106930/slug" or "comic/2313016/slug"
  // The API expects only the numeric ID
  const numericIdMatch = comicId.match(/\/(\d+)(\/|$)/);
  const numericId = numericIdMatch ? numericIdMatch[1] : comicId;
  const logPrefix = `[lofcg:modifyList] comicId=${numericId} listId=${listId} action=${actionId}`;
  console.log(`${logPrefix} starts`);

  session.assertMustBeAuthenticated();

  const body = buildFormBody({ comic_id: numericId, list_id: listId, action_id: actionId });

  const [response, data] = await Application.scheduleRequest({
    url: MY_LIST_MOVE_URL,
    method: "POST",
    headers: {
      ...baseHeaders(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (response.status !== 200) {
    throw new Error(`modifyList failed with status ${response.status}`);
  }

  const responseText = Application.arrayBufferToUTF8String(data);
  let parsed: { type?: string; text?: string };
  try {
    parsed = JSON.parse(responseText) as { type?: string; text?: string };
  } catch {
    throw new Error(`modifyList unexpected response: ${responseText}`);
  }
  if (parsed.type !== "success") {
    throw new Error(`modifyList failed: ${parsed.text ?? responseText}`);
  }

  console.log(`${logPrefix} complete`);
}

export async function getSeriesPage(mangaId: string): Promise<string> {
  const logPrefix = `[lofcg:getSeriesPage] mangaId=${mangaId}`;
  console.log(`${logPrefix} starts`);

  // mangaId is a URL path like 'comics/series/193593/slug' or 'comic/2313016/slug'
  const url = `${BASE_URL}/${mangaId}`;
  const [response, data] = await Application.scheduleRequest({
    url,
    method: "GET",
    headers: baseHeaders(),
  });

  if (response.status !== 200) {
    throw new Error(`getSeriesPage failed with status ${response.status}`);
  }

  console.log(`${logPrefix} complete`);
  return Application.arrayBufferToUTF8String(data);
}

export async function addToList(mangaId: string, listId: number): Promise<void> {
  const numericId = extractNumericId(mangaId);
  if (isSeries(mangaId)) {
    // Series: my_list_bulk with series_id
    // Pull List uses action=subscribe, all others use action=add
    const action = listId === LIST_IDS.PULL_LIST ? "subscribe" : "add";
    await seriesBulkAction(numericId, listId, action);
  } else {
    // Individual issue: my_list_move with comic_id
    await modifyList(mangaId, listId, 1);
  }
}

export async function removeFromList(mangaId: string, listId: number): Promise<void> {
  const numericId = extractNumericId(mangaId);
  if (isSeries(mangaId)) {
    const action = listId === LIST_IDS.PULL_LIST ? "unsubscribe" : "remove";
    await seriesBulkAction(numericId, listId, action);
  } else {
    await modifyList(mangaId, listId, 0);
  }
}

function isSeries(mangaId: string): boolean {
  return mangaId.startsWith("comics/series/");
}

function extractNumericId(mangaId: string): string {
  const m = mangaId.match(/\/(\d+)(\/|$)/);
  return m ? m[1] : mangaId;
}

async function seriesBulkAction(
  seriesNumericId: string,
  listId: number,
  action: string,
): Promise<void> {
  const logPrefix = `[lofcg:seriesBulkAction] seriesId=${seriesNumericId} listId=${listId} action=${action}`;
  console.log(`${logPrefix} starts`);

  session.assertMustBeAuthenticated();

  // Pull List subscription doesn't need date fields; other lists optionally accept them
  const params: Record<string, string | number> = {
    series_id: seriesNumericId,
    list_id: listId,
    action,
  };
  if (action !== "subscribe" && action !== "unsubscribe") {
    params.date = "";
    params.date_type = "";
  }

  const body = buildFormBody(params);

  const [response, data] = await Application.scheduleRequest({
    url: MY_LIST_BULK_URL,
    method: "POST",
    headers: {
      ...baseHeaders(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (response.status !== 200) {
    throw new Error(`seriesBulkAction failed with status ${response.status}`);
  }

  const responseText = Application.arrayBufferToUTF8String(data);
  let parsed: { type?: string; text?: string };
  try {
    parsed = JSON.parse(responseText) as { type?: string; text?: string };
  } catch {
    throw new Error(`seriesBulkAction unexpected response: ${responseText}`);
  }
  if (parsed.type !== "success") {
    throw new Error(`seriesBulkAction failed: ${parsed.text ?? responseText}`);
  }

  console.log(`${logPrefix} complete`);
}
