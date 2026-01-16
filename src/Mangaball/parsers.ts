import { DiscoverSectionItem } from "@paperback/types";
import * as cheerio from "cheerio";
import { APIItem } from "./model";

export interface ParseOptions {
    itemType?: "featuredCarouselItem" | "chapterUpdatesCarouselItem";
    extractChapterInfo?: boolean;
    customSubtitleExtractor?: (raw: APIItem) => string;
}

export function parseApiItemsToDiscoverItems(
  apiItems: APIItem[],
  collectedIds?: string[],
  options?: ParseOptions,
): { items: DiscoverSectionItem[]; collectedIds: string[] } {
  const items: DiscoverSectionItem[] = [];
  const seen = new Set<string>(collectedIds || []);
  const { itemType = "featuredCarouselItem", extractChapterInfo = false, customSubtitleExtractor } = options || {};

  for (const raw of apiItems || []) {
    // Extract mangaId using the centralized logic
    // Robust mangaId extraction handling http/https and trailing slashes
    let mangaId = raw.url;
    const idMatch = raw.url.match(/\/title-detail\/([^\/?#]+)/);
    if (idMatch) {
            mangaId = idMatch[1];
    } else {
             // Fallback for unexpected URL formats
             mangaId = raw.url.split("/").filter(Boolean).pop() || raw.url;
    }

    // Explicit safety check: ensure mangaId is not a URL
    if (mangaId.includes("/")) {
       const parts = mangaId.split("/").filter(Boolean);
       mangaId = parts[parts.length - 1];
    }

    if (!mangaId || seen.has(mangaId)) continue;
    seen.add(mangaId);

    const title = String(raw.name || "");
    const cover = String(raw.cover || raw.background || "");

    let supertitle: string | undefined = undefined;
    if (raw.alternateName) {
      const $alt = cheerio.load(String(raw.alternateName) || "");
      const altBadges = $alt(".badge")
        .map((_, el) => $alt(el).text().trim())
        .get();
      if (altBadges.length) supertitle = altBadges.join(" ");
    }

    let description = "";
    if (raw.description) {
      const $desc = cheerio.load(String(raw.description) || "");
      description = (
        $desc("p").first().text().trim() || $desc.root().text().trim()
      ).replace(/\s+/g, " ");
    }

    const tagIds: string[] = [];
    const tagLabels: string[] = [];
    if (raw.tags) {
      const $tags = cheerio.load(String(raw.tags) || "");
      $tags(".badge[data-tag-id]").each((_, el) => {
        const id = $tags(el).attr("data-tag-id") || "";
        const label = $tags(el).text().trim();
        if (id) tagIds.push(id);
        if (label) tagLabels.push(label);
      });
    }

    const authorIds: string[] = [];
    const authorNames: string[] = [];
    if (raw.authors) {
      const $auth = cheerio.load(String(raw.authors) || "");
      $auth("[data-person-id]").each((_, el) => {
        const id = $auth(el).attr("data-person-id") || "";
        const name = $auth(el).text().trim();
        if (id) authorIds.push(id);
        if (name) authorNames.push(name);
      });
    }

    let status = "";
    if (raw.status) {
      const $stat = cheerio.load(String(raw.status) || "");
      status = (
        $stat(".badge").first().text().trim() || $stat.root().text().trim()
      ).replace(/\s+/g, " ");
    }

    // Extract chapter info if needed
    let chapterId = "";
    let subtitle: string | undefined = undefined;
    
    if (extractChapterInfo && raw.last_chapter) {
      try {
        const $lc = cheerio.load(String(raw.last_chapter));
        const anchor = $lc('a').first();
        const href = anchor.attr('href') || anchor.attr('data-href') || "";
        chapterId = deriveIdFromUrl(href || "") || "";
        const txt = anchor.text().trim();
        if (txt) subtitle = txt;
      } catch {
        chapterId = "";
        subtitle = undefined;
      }
    }
    
    // Use custom subtitle extractor if provided (overrides chapter subtitle)
    if (customSubtitleExtractor) {
      const customSubtitle = customSubtitleExtractor(raw);
      if (customSubtitle !== undefined) subtitle = customSubtitle;
    }
    
    // If no subtitle and not extracting chapter info, use updated_at
    if (!subtitle && !extractChapterInfo) {
      subtitle = String(raw.updated_at || "");
    }

    const baseItem = {
      mangaId,
      imageUrl: cover,
      title,
      supertitle,
      subtitle,
      additionalInfo: {
        description,
        tags: tagLabels,
        tagIds,
        authors: authorNames,
        authorIds,
        status,
        originalId: raw._id,
        originalUrl: raw.url,
      },
    };

    // Create the appropriate item type
    if (itemType === "chapterUpdatesCarouselItem") {
      items.push({
        type: "chapterUpdatesCarouselItem",
        chapterId,
        ...baseItem,
      } as DiscoverSectionItem);
    } else {
      items.push({
        type: "featuredCarouselItem",
        ...baseItem,
      } as DiscoverSectionItem);
    }
  }

  return { items, collectedIds: Array.from(seen) };
}

// Helper function to extract ID from URL (needed for chapter extraction)
function deriveIdFromUrl(url: string): string {
  if (!url) return "";
  // Extract the last segment and remove trailing slash
  const segments = url.split("/").filter(Boolean);
  return segments.pop()?.split(/[?#]/)[0] || "";
}
