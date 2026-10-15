import { ContentRating, type MangaInfo, type SearchResultItem, type SourceManga, type TagSection } from "@paperback/types";
import * as cheerio from "cheerio";
import type { LOFCGComicSeries, LOFCGIssueEntry, LOFCGSeriesStatus } from "../models/main";

const BASE_URL = "https://leagueofcomicgeeks.com";

// Tag IDs must be alphanumeric or contain only ._-@()[]%?#+=/&: — no spaces.
function tagId(value: string): string {
  return value.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._\-@()[\]%?#+=/&:]/g, "");
}

export function parseSeriesHtml(html: string): LOFCGComicSeries[] {
  const $ = cheerio.load(html);
  const results: LOFCGComicSeries[] = [];

  // The API returns an <ul> with <li> items. Each item contains:
  // .cover a[data-id] — series ID and href slug
  // .cover img[data-src] — full cover URL (lazy-loaded)
  // .title.color-primary a — series title
  // .copy-really-small span:first-child — publisher
  // .details.count-issues — issue count
  $("li").each((_i, el) => {
    const $el = $(el);

    const $coverLink = $el.find(".cover a").first();
    const hrefMatch = ($coverLink.attr("href") ?? "").match(/\/comics\/series\/(\d+)/);
    const numericId = $coverLink.attr("data-id") ?? hrefMatch?.[1];
    const name = ($el.find(".title.color-primary a").text() || $el.find(".title.color-primary").text()).trim();
    if (!numericId || !name) return;

    const rawSrc = $el.find(".cover img").attr("data-src") ?? "";
    // data-src is already a full URL (https://s3.amazonaws.com/...)
    const cover = rawSrc && !rawSrc.includes("no-cover") ? rawSrc.split("?")[0] : null;

    const publisher = (
      $el.find(".publisher.color-offset").first().text() ||
      $el.find(".copy-really-small span").first().text()
    ).trim();
    const issueCount = parseInt($el.find(".details.count-issues").text().trim(), 10) || 0;

    const hrefSlug = $coverLink.attr("href") ?? "";
    // Use the URL path as the ID so getMangaDetails can build the correct URL
    const id = hrefSlug ? hrefSlug.replace(/^\//, "") : `comics/series/${numericId}`;
    const url = `${BASE_URL}/${id}`;

    results.push({ id, name, url, cover, publisher, issueCount });
  });

  return results;
}

/**
 * Parses the issue list markup returned by get_comics with view=list
 * (new releases, issue searches). Each <li> holds .comic-cover-art img,
 * .title.color-primary, .comic-details ("Publisher · date · price") and a
 * link to /comic/{id}/{slug}.
 */
export function parseIssueListHtml(html: string): LOFCGComicSeries[] {
  const $ = cheerio.load(html);
  const results: LOFCGComicSeries[] = [];
  const seen = new Set<string>();

  $("li").each((_i, el) => {
    const $el = $(el);

    const href =
      $el.find(".comic-description a[href^='/comic/']").first().attr("href") ??
      $el.find(".title a[href^='/comic/']").first().attr("href") ??
      $el.find("a[href^='/comic/']").first().attr("href") ??
      "";
    const match = href.match(/^\/comic\/(\d+)/);
    if (!match || seen.has(match[1])) return;

    const name = (
      $el.find(".title.color-primary a").first().text() ||
      $el.find(".title.color-primary").first().text()
    ).trim();
    if (!name) return;

    const img = $el.find(".comic-cover-art img, .cover img").first();
    const rawSrc = img.attr("data-src") ?? img.attr("src") ?? "";
    const cover =
      rawSrc && !rawSrc.startsWith("data:") && !rawSrc.includes("no-cover")
        ? absolute(rawSrc.split("?")[0].replace("/medium/", "/large/"))
        : null;

    const publisher = ($el.find(".comic-details").first().text().split("·")[0] ?? "").trim();

    seen.add(match[1]);
    const id = href.replace(/^\//, "").split("?")[0];
    results.push({ id, name, url: `${BASE_URL}/${id}`, cover, publisher, issueCount: 0 });
  });

  return results;
}

function absolute(url: string): string {
  return url.startsWith("/") ? `${BASE_URL}${url}` : url;
}

export function parseAjaxSeriesHtml(html: string): LOFCGComicSeries[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const results: LOFCGComicSeries[] = [];

  // The ajax response contains anchor tags with hrefs like /comics/series/{id}/{slug}.
  // Each series appears twice (once with image, once as plain text), so deduplicate by ID.
  $("a[href*='/comics/series/']").each((_i, el) => {
    const $a = $(el);
    const href = $a.attr("href") ?? "";
    const match = href.match(/\/comics\/series\/(\d+)\//);
    if (!match) return;
    const numericId = match[1];
    if (!numericId || seen.has(numericId)) return;
    seen.add(numericId);
    // Use the URL path as the ID so getMangaDetails can build the correct URL
    const id = href.replace(/^\//, "");

    const img = $a.find("img");
    const rawSrc = img.attr("data-src") ?? img.attr("src") ?? "";
    const cover = rawSrc && !rawSrc.startsWith("data:") && !rawSrc.includes("no-cover")
      ? rawSrc.split("?")[0]
      : null;

    const name = (img.attr("alt") || $a.text()).trim();
    if (!name) return;

    const $li = $a.closest("li");
    const publisher = $li.find(".publisher").first().text().trim()
      || $li.find("span").not($a.find("span")).first().text().trim();

    results.push({ id, name, url: `${BASE_URL}/${id}`, cover, publisher, issueCount: 0 });
  });

  return results;
}

export function seriestoSearchResultItem(series: LOFCGComicSeries): SearchResultItem {
  return {
    mangaId: series.id,
    title: series.name,
    imageUrl: series.cover ?? "https://leagueofcomicgeeks.com/assets/images/no-cover-lg.jpg",
    subtitle: series.publisher || undefined,
  };
}

export function seriesToSourceManga(series: LOFCGComicSeries): SourceManga {
  const tags: TagSection[] = [];
  if (series.publisher) {
    tags.push({
      id: "publisher",
      title: "Publisher",
      tags: [{ id: tagId(series.publisher), title: series.publisher }],
    });
  }

  const mangaInfo: MangaInfo = {
    primaryTitle: series.name,
    secondaryTitles: [],
    thumbnailUrl: series.cover ?? "https://leagueofcomicgeeks.com/assets/images/no-cover-lg.jpg",
    synopsis: "",
    rating: undefined,
    contentRating: ContentRating.EVERYONE,
    status: undefined,
    author: undefined,
    artist: undefined,
    tagGroups: tags,
  };

  return { mangaId: series.id, mangaInfo };
}

export function parseSeriesPageDetails(html: string, mangaId: string): SourceManga {
  const $ = cheerio.load(html);

  // Title: og:title first, then h1, then <title> tag
  const title = $("meta[property='og:title']").attr("content")?.replace(/ [|] League.*$/i, "").trim()
    || $("h1").first().text().trim()
    || $("title").text().replace(/ [|] League.*$/i, "").trim();

  // Cover: og:image first, then .cover-art img (individual comic pages)
  // og:image can be the site's "cover coming soon" placeholder even when the
  // page shows real issue covers, so skip placeholders and use the first real one.
  const isRealCover = (url?: string): url is string =>
    !!url && !url.startsWith("data:") && !/no-cover|cover-coming-soon/i.test(url);
  const candidates = [
    $("meta[property='og:image']").attr("content"),
    $(".cover-art img").first().attr("data-src"),
    $(".cover-art img").first().attr("src"),
    ...$(".comic-cover-art img, .cover img")
      .toArray()
      .map((el) => $(el).attr("data-src") ?? $(el).attr("src")),
  ];
  const found = candidates.find(isRealCover);
  const cover = found ? absolute(found.split("?")[0].replace("/medium/", "/large/")) : undefined;

  // Description: og:description or any .description / .about paragraph
  const description = $("meta[property='og:description'], meta[name='description']").first().attr("content")?.trim()
    || $(".description p, .about p, .series-description p").first().text().trim()
    || undefined;

  // Publisher: link whose href matches /comics/{slug} (the publisher directory pattern)
  const $pubLink = $("a[href^='/comics/']").filter((_i, el) =>
    /^\/comics\/[a-z0-9-]+$/.test($(el).attr("href") ?? "")
  ).first();
  const publisher = $pubLink.text().trim() || undefined;

  // Year from the "YYYY - PRESENT" / "YYYY - YYYY" text near publisher
  const pageText = $("body").text();
  const yearMatch = pageText.match(/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2}|Present)\b/i);
  const yearText = yearMatch ? `${yearMatch[1]} - ${yearMatch[2]}` : undefined;

  const genres: string[] = [];
  $(".genre-tag a, .genres a, .tags a").each((_i, el) => {
    const g = $(el).text().trim();
    if (g) genres.push(g);
  });

  const tags: TagSection[] = [];
  if (publisher) {
    tags.push({ id: "publisher", title: "Publisher", tags: [{ id: tagId(publisher), title: publisher }] });
  }
  if (yearText) {
    tags.push({ id: "year", title: "Years", tags: [{ id: tagId(yearText), title: yearText }] });
  }
  if (genres.length > 0) {
    tags.push({ id: "genres", title: "Genres", tags: genres.map((g) => ({ id: tagId(g), title: g })) });
  }

  return {
    mangaId,
    mangaInfo: {
      primaryTitle: title,
      secondaryTitles: [],
      thumbnailUrl: cover ?? "https://leagueofcomicgeeks.com/assets/images/no-cover-lg.jpg",
      synopsis: description ?? "",
      rating: undefined,
      contentRating: ContentRating.EVERYONE,
      status: undefined,
      author: undefined,
      artist: undefined,
      tagGroups: tags,
    },
  };
}

/** Issue number from a title like "Batman #12" or "Saga #54.1"; null when there is none. */
export function parseIssueNumber(title: string): number | null {
  const matches = [...title.matchAll(/#\s*(-?\d+(?:\.\d+)?)/g)];
  const last = matches[matches.length - 1];
  return last ? parseFloat(last[1]) : null;
}

const OFF_NUMBERING = /\b(annual|special|one[- ]shot|giant[- ]size|king[- ]size|preview|director'?s cut|facsimile|free comic book day|fcbd)\b/i;

/**
 * Parses get_comics?list=search&series_id=... (the request the series page
 * makes). Each issue <li> carries four .comic-controller buttons in the order
 * pull, collection, read, want; "active" marks the ones the user has set.
 */
export function parseSeriesIssues(
  json: { list?: string; statbar?: string; series?: { title?: string } },
  seriesId: string,
): LOFCGSeriesStatus {
  const $ = cheerio.load(json.list ?? "");
  const issues: LOFCGIssueEntry[] = [];
  const seen = new Set<string>();

  let $items = $("#comic-list-issues li");
  if ($items.length === 0) $items = $("li");

  $items.each((_i, el) => {
    const $el = $(el);
    const href =
      $el.find("a[href^='/comic/']").first().attr("href") ?? $el.find("a").first().attr("href") ?? "";
    const idMatch = href.match(/\/comic\/(\d+)/);
    if (!idMatch || seen.has(idMatch[1])) return;
    seen.add(idMatch[1]);

    const title = $el.find(".title").first().text().replace(/\s+/g, " ").trim();
    const controllers = $el.find(".comic-controller").toArray();
    const active = (index: number) => {
      const c = controllers[index];
      return !!c && ($(c).attr("class") ?? "").split(/\s+/).includes("active");
    };

    const rateEl = $el.find("[data-rateit-value]").first();
    const rating = Number($el.attr("data-rating") ?? rateEl.attr("data-rateit-value") ?? 0) || 0;

    const img = $el.find("img").first();
    const rawSrc = img.attr("data-src") ?? img.attr("src") ?? "";

    issues.push({
      issueId: idMatch[1],
      title,
      number: parseIssueNumber(title),
      offNumbering: OFF_NUMBERING.test(title),
      cover: rawSrc && !rawSrc.startsWith("data:") && !rawSrc.includes("no-cover") ? rawSrc : null,
      releaseDate: $el.find(".date").first().attr("data-date") ?? "",
      pull: active(0),
      collected: active(1),
      read: active(2),
      wanted: active(3),
      rating: Math.max(0, Math.min(5, Math.round(rating))),
    });
  });

  // Oldest first, so issue lists read in order.
  issues.sort((a, b) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER));

  // The series is on the pull list when the stat bar offers to remove it.
  const statbar = cheerio.load(json.statbar ?? "");
  const pulled = statbar(".btn-remove").length > 0;

  return { seriesId, title: json.series?.title ?? "", pulled, issues };
}

/**
 * Finds the issue a reading source's chapter number refers to. Prefers the
 * regular numbering over annuals and specials, which often repeat numbers.
 */
export function findIssueForChapter(issues: LOFCGIssueEntry[], chapterNum: number): LOFCGIssueEntry | undefined {
  const sameNumber = issues.filter((i) => i.number !== null && Math.abs(i.number - chapterNum) < 0.001);
  return sameNumber.find((i) => !i.offNumbering) ?? sameNumber[0];
}
