import { ContentRating, type MangaInfo, type SearchResultItem, type SourceManga, type TagSection } from "@paperback/types";
import * as cheerio from "cheerio";
import type { LOFCGComicSeries } from "../models/main";

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

    const $coverLink = $el.find(".cover a[data-id]");
    const numericId = $coverLink.attr("data-id");
    const name = $el.find(".title.color-primary a").text().trim();
    if (!numericId || !name) return;

    const rawSrc = $el.find(".cover img").attr("data-src") ?? "";
    // data-src is already a full URL (https://s3.amazonaws.com/...)
    const cover = rawSrc && !rawSrc.includes("no-cover") ? rawSrc.split("?")[0] : null;

    const publisher = $el.find(".copy-really-small span").first().text().trim();
    const issueCount = parseInt($el.find(".details.count-issues").text().trim(), 10) || 0;

    const hrefSlug = $coverLink.attr("href") ?? "";
    // Use the URL path as the ID so getMangaDetails can build the correct URL
    const id = hrefSlug ? hrefSlug.replace(/^\//, "") : `comics/series/${numericId}`;
    const url = `${BASE_URL}/${id}`;

    results.push({ id, name, url, cover, publisher, issueCount });
  });

  return results;
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
  const cover = $("meta[property='og:image']").attr("content")
    ?? $(".cover-art img").first().attr("src")
    ?? undefined;

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
