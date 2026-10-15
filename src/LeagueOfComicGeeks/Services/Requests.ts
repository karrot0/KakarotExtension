import type { CookieStorageInterceptor } from "@paperback/types";
import * as cheerio from "cheerio";
import type { LOFCGGetComicsParams, LOFCGSeriesStatus } from "../Implementations/Shared/models/main";
import { parseSeriesIssues } from "../Implementations/Shared/parser/comic";
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
const POST_RATING_URL = `${BASE_URL}/comic/post_rating`;

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

/**
 * Logs in by submitting the site's own login form: load /login, copy every
 * field the form carries (hidden security token included), fill in the
 * username and password, and post it back from the same cookie session.
 * Success is confirmed by asking the site who is logged in
 * (get_comics returns configurator.my_user_id, which is 0 when logged out).
 */
export async function login(
  username: string,
  password: string,
  cookieStore?: CookieStorageInterceptor,
): Promise<Session> {
  const logPrefix = "[lofcg:login]";
  console.log(`${logPrefix} starts`);

  // A stale session can make the site skip the login form, so start clean.
  clearSiteCookies(cookieStore);

  const [pageResponse, pageData] = await Application.scheduleRequest({
    url: LOGIN_URL,
    method: "GET",
    headers: baseHeaders(),
  });
  if (pageResponse.status !== 200) {
    throw new Error(`Could not open the login page (status ${pageResponse.status}).`);
  }
  const loginPage = Application.arrayBufferToUTF8String(pageData);
  const form = readLoginForm(loginPage);
  form.fields[form.usernameField] = username;
  form.fields[form.passwordField] = password;

  const [response, data] = await Application.scheduleRequest({
    url: form.action,
    method: "POST",
    headers: {
      ...baseHeaders(),
      "content-type": "application/x-www-form-urlencoded",
      referer: LOGIN_URL,
      origin: BASE_URL,
    },
    body: buildFormBody(form.fields),
  });

  const replyText = Application.arrayBufferToUTF8String(data);
  const siteError = readLoginError(replyText);
  if (siteError) throw new Error(siteError);
  if (response.status >= 400) {
    throw new Error(`Login request failed with status ${response.status}.`);
  }

  // Ask the site whether we are logged in now.
  const check = await getComics({ list: LIST_IDS.RELEASES, list_option: "thumbs", view: "list", per_page: 1 });
  if (!check.myUserId) {
    throw new Error("Invalid username or password.");
  }

  keepLoginCookies(cookieStore);

  let resolvedUsername = username;
  const profileMatch = replyText.match(/href=["']\/profile\/([^/"'?#]+)/i);
  if (profileMatch?.[1] && !username.includes("@")) resolvedUsername = decodeURIComponent(profileMatch[1]);

  console.log(`${logPrefix} complete - user: ${resolvedUsername}`);
  return { username: resolvedUsername, userId: String(check.myUserId) };
}

interface LoginFormData {
  action: string;
  fields: Record<string, string>;
  usernameField: string;
  passwordField: string;
}

function readLoginForm(html: string): LoginFormData {
  const $ = cheerio.load(html);
  let $form = $("form").filter((_i, el) => $(el).find("input[type='password']").length > 0).first();
  if ($form.length === 0) $form = $("form[action*='login']").first();

  const fields: Record<string, string> = {};
  let usernameField = "username";
  let passwordField = "password";

  $form.find("input[name], select[name], textarea[name]").each((_i, el) => {
    const $el = $(el);
    const name = $el.attr("name") ?? "";
    const type = ($el.attr("type") ?? "text").toLowerCase();
    if (!name || type === "submit" || type === "button" || type === "image") return;

    if (type === "password") {
      passwordField = name;
      return;
    }
    if (type === "checkbox" || type === "radio") {
      // Tick "remember me" so the site issues a lasting login cookie.
      if (/remember|keep|persist/i.test(name)) fields[name] = $el.attr("value") ?? "1";
      else if ($el.is("[checked]")) fields[name] = $el.attr("value") ?? "on";
      return;
    }
    if (type !== "hidden" && /user|login|email|name/i.test(name)) {
      usernameField = name;
      return;
    }
    fields[name] = $el.attr("value") ?? $el.find("option[selected]").attr("value") ?? "";
  });

  // Some sites only put the security token in a meta tag.
  const metaToken = $("meta[name='csrf-token']").attr("content");
  if (metaToken && !Object.keys(fields).some((k) => /csrf|token/i.test(k))) {
    fields[$("meta[name='csrf-param']").attr("content") ?? "csrf_token"] = metaToken;
  }

  const rawAction = $form.attr("action")?.trim();
  const action = !rawAction
    ? LOGIN_URL
    : rawAction.startsWith("http")
      ? rawAction
      : `${BASE_URL}${rawAction.startsWith("/") ? "" : "/"}${rawAction}`;

  return { action, fields, usernameField, passwordField };
}

/** Reads an error the site put in its reply, as JSON ({type, text}) or an alert box. */
function readLoginError(reply: string): string | undefined {
  try {
    const json = JSON.parse(reply) as { type?: string; text?: string; message?: string };
    if (json.type === "error" || json.type === "danger") {
      return cheerio.load(`<p>${json.text ?? json.message ?? "Login failed."}</p>`)("p").text().trim();
    }
    return undefined;
  } catch {
    const $ = cheerio.load(reply);
    const alert = $(".alert-error, .alert-danger, .form-error, .error-message").first().text().trim();
    return alert || undefined;
  }
}

const SITE_URL = `${BASE_URL}/`;
const LOGIN_COOKIE_DAYS = 30;

/**
 * Paperback only saves cookies that have an expiry date, so a login held in a
 * session cookie is lost when the app restarts while the plugin still thinks
 * it is logged in. Give the site's cookies an expiry so the login survives.
 */
function keepLoginCookies(cookieStore?: CookieStorageInterceptor): void {
  if (!cookieStore) return;
  const expires = new Date(Date.now() + LOGIN_COOKIE_DAYS * 24 * 60 * 60 * 1000);
  for (const cookie of cookieStore.cookiesForUrl(SITE_URL)) {
    if (!cookie.expires) cookieStore.setCookie({ ...cookie, expires });
  }
}

function clearSiteCookies(cookieStore?: CookieStorageInterceptor): void {
  if (!cookieStore) return;
  for (const cookie of [...cookieStore.cookiesForUrl(SITE_URL)]) {
    cookieStore.deleteCookie(cookie);
  }
}

export async function logout(cookieStore?: CookieStorageInterceptor): Promise<void> {
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
  clearSiteCookies(cookieStore);
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

/** Numeric series id from "comics/series/106930/slug"; undefined for issue ids. */
export function seriesNumericId(mangaId: string): string | undefined {
  return mangaId.match(/^comics\/series\/(\d+)/)?.[1];
}

/** Numeric issue id from "comic/2313016/slug"; undefined for series ids. */
export function issueNumericId(mangaId: string): string | undefined {
  return mangaId.match(/^comic\/(\d+)/)?.[1];
}

/**
 * Every regular issue in a series, with the logged-in user's pull, collection,
 * read, wish list and rating state for each (the same request the series page makes).
 */
export async function getSeriesStatus(seriesId: string): Promise<LOFCGSeriesStatus> {
  const logPrefix = `[lofcg:getSeriesStatus] seriesId=${seriesId}`;
  console.log(`${logPrefix} starts`);

  const query = [
    "list=search",
    "view=thumbs",
    `format${encodeURIComponent("[]")}=1`,
    `series_id=${encodeURIComponent(seriesId)}`,
    "character=0",
    "order=date-desc",
  ].join("&");

  const [response, data] = await Application.scheduleRequest({
    url: `${GET_COMICS_URL}?${query}`,
    method: "GET",
    headers: baseHeaders(),
  });
  if (response.status !== 200) {
    throw new Error(`Could not load the series issues (status ${response.status}).`);
  }

  let json: { list?: string; statbar?: string; series?: { title?: string } };
  try {
    json = JSON.parse(Application.arrayBufferToUTF8String(data)) as typeof json;
  } catch {
    throw new Error("Could not read the series issues from League of Comic Geeks.");
  }

  const status = parseSeriesIssues(json, seriesId);
  console.log(`${logPrefix} complete: ${status.issues.length} issues, pulled=${status.pulled}`);
  return status;
}

/** Adds (add = true) or removes one issue from a list. */
export async function setIssueOnList(issueId: string, listId: number, add: boolean): Promise<void> {
  await modifyList(issueId, listId, add ? 1 : 0);
}

/** Rates one issue, 1 to 5; 0 clears the rating. */
export async function rateIssue(issueId: string, score: number): Promise<void> {
  const logPrefix = `[lofcg:rateIssue] issueId=${issueId} score=${score}`;
  console.log(`${logPrefix} starts`);
  session.assertMustBeAuthenticated();

  const [response, data] = await Application.scheduleRequest({
    url: POST_RATING_URL,
    method: "POST",
    headers: { ...baseHeaders(), "content-type": "application/x-www-form-urlencoded" },
    body: buildFormBody({ comic_id: issueId, score: Math.max(0, Math.min(5, Math.round(score))) }),
  });
  if (response.status !== 200) {
    throw new Error(`Rating failed with status ${response.status}`);
  }
  assertSuccess(Application.arrayBufferToUTF8String(data), "Rating");
  console.log(`${logPrefix} complete`);
}

/**
 * Whole-series list actions (my_list_bulk):
 * subscribe/unsubscribe (pull list), add/remove (collection, wish list),
 * addall/remove (read list), addnotowned (wish list: issues you don't own).
 */
export async function seriesListAction(seriesId: string, listId: number, action: string): Promise<void> {
  await seriesBulkAction(seriesId, listId, action);
}

function assertSuccess(responseText: string, what: string): void {
  let parsed: { type?: string; text?: string };
  try {
    parsed = JSON.parse(responseText) as { type?: string; text?: string };
  } catch {
    throw new Error(`${what}: unexpected response from League of Comic Geeks.`);
  }
  if (parsed.type !== "success") {
    throw new Error(`${what} failed: ${parsed.text ?? responseText}`);
  }
}
