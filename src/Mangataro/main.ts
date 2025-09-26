import {
  BasicRateLimiter,
  Chapter,
  ChapterDetails,
  ChapterProviding,
  CloudflareError,
  ContentRating,
  DiscoverSection,
  DiscoverSectionItem,
  DiscoverSectionProviding,
  DiscoverSectionType,
  Extension,
  MangaProviding,
  PagedResults,
  Request,
  SearchFilter,
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SortingOption,
  SourceManga,
} from "@paperback/types";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import * as htmlparser2 from "htmlparser2";
import { URLBuilder } from "../utils/url-builder/base";
import { Interceptor } from "./interceptors";

import { 
  metadata,
  SearchAPIResponse,
  LatestChaptersResponse,
  PopularItem
} from "./model";

const baseUrl = "https://mangataro.org";

type MangataroImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class MangataroExtension implements MangataroImplementation {
  requestManager = new Interceptor("main");
  globalRateLimiter = new BasicRateLimiter("rateLimiter", {
    numberOfRequests: 10,  // Reduced from 10 to be more conservative
    bufferInterval: 1,    // Increased from 1 to 2 seconds
    ignoreImages: true,
  });

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.globalRateLimiter.registerInterceptor();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "popular_updates_section",
        title: "Popular Updates",
        type: DiscoverSectionType.featured,
      },
      {
        id: "trending_section",
        title: "Trending",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "recently_updated_section",
        title: "Recently Updated",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: metadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "popular_updates_section":
        return this.getPopularSectionItems(section, metadata);
      case "trending_section":
        return this.getTrendingSectionItems(section, metadata);
      case "recently_updated_section":
        return this.getRecentlyUpdatedSectionItems(section, metadata);
      default:
        return { items: [] };
    }
  }

  async getSearchFilters(): Promise<SearchFilter[]> {
    const request = { url: `${baseUrl}/browse`, method: "GET" };
    const $ = await this.fetchCheerio(request);

    const filters: SearchFilter[] = [];

    // Tags
    const tagOptions: { id: string; title: string; value: string }[] = [];
    const tagSeen = new Set<string>();
    $('#genre-list .genre-btn').each((_, el) => {
      const text = $(el).text().trim();
      const dataValue = $(el).attr('data-value');
      if (text && dataValue) {
        const tagName = text.split(' ')[0]; // Remove count if present
        const id = dataValue; // Use data-value as id
        const key = `${id}-${tagName}`;
        if (!tagSeen.has(key)) {
          tagSeen.add(key);
          tagOptions.push({ id, title: tagName, value: tagName });
        }
      }
    });
    if (tagOptions.length > 0) {
      filters.push({
        id: 'tags',
        title: 'Tags',
        type: 'multiselect',
        value: {},
        allowExclusion: false,
        allowEmptySelection: true,
        maximum: 10,
        options: tagOptions,
      });
    }

    // Type
    const typeOptions: { id: string; title: string; value: string }[] = [];
    const typeSeen = new Set<string>();
    $('h3:contains("Type")').next().find('button').each((_, el) => {
      const text = $(el).text().trim();
      const typeName = text.split(' ')[0];
      const id = typeName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const key = `${id}-${typeName}`;
      if (!typeSeen.has(key)) {
        typeSeen.add(key);
        typeOptions.push({ id, title: typeName, value: typeName });
      }
    });
    if (typeOptions.length > 0) {
      filters.push({
        id: 'type',
        title: 'Type',
        type: 'dropdown',
        value: '',
        options: typeOptions,
      });
    }

    // Status
    const statusOptions: { id: string; title: string; value: string }[] = [];
    const statusSeen = new Set<string>();
    $('h3:contains("Status")').next().find('button').each((_, el) => {
      const text = $(el).text().trim();
      const statusName = text.split(' ')[0];
      const id = statusName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const key = `${id}-${statusName}`;
      if (!statusSeen.has(key)) {
        statusSeen.add(key);
        statusOptions.push({ id, title: statusName, value: statusName });
      }
    });
    if (statusOptions.length > 0) {
      filters.push({
        id: 'status',
        title: 'Status',
        type: 'dropdown',
        value: '',
        options: statusOptions,
      });
    }

    // Release Year (at the bottom)
    const releaseYearOptions: { id: string; title: string; value: string }[] = [];
    const yearSeen = new Set<string>();
    $('h3:contains("Release Year")').next().find('button').each((_, el) => {
      const text = $(el).text().trim();
      const id = text.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const key = `${id}-${text}`;
      if (!yearSeen.has(key)) {
        yearSeen.add(key);
        releaseYearOptions.push({ id, title: text, value: text });
      }
    });
    if (releaseYearOptions.length > 0) {
      filters.push({
        id: 'releaseYear',
        title: 'Release Year',
        type: 'dropdown',
        value: '',
        options: releaseYearOptions,
      });
    }

    return filters;
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: metadata | undefined,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    try {
      const page = metadata?.page ?? 0;

      // Extract filter values
      const getFilterValue = (id: string) => query.filters?.find((filter) => filter.id === id)?.value;
      
      const genres = getFilterValue("tags") as Record<string, "included" | "excluded"> | undefined;
      const types = getFilterValue("type") as string | undefined;
      const statuses = getFilterValue("status") as string | undefined;
      const years = getFilterValue("releaseYear") as string | undefined;
      // Process genres - extract included genre IDs
      const genreIds: string[] = [];
      if (genres && typeof genres === "object") {
        Object.entries(genres).forEach(([id, value]) => {
          if (value === "included") {
            genreIds.push(id);
          }
        });
      }
      
      // Process other filters
      const typeValue = types && types !== "all" ? types : undefined;
      const statusValue = statuses && statuses !== "all" ? statuses : undefined;
      const yearValue = years && years !== "all" ? years : undefined;
      
      // Use sortingOption parameter like MangaFire
      const sort = sortingOption?.id || "post_desc";
      
      const request: Request = {
        url: `${baseUrl}/wp-json/manga/v1/load`,
        method: "POST",
        headers: {
          "accept": "*/*",
          "content-type": "application/json",
          origin: baseUrl,
          referer: `${baseUrl}/browse`,
        },
        body: JSON.stringify({
          page: page + 1,
          search: query.title || "",
          years: JSON.stringify(yearValue ? [yearValue] : []),
          genres: JSON.stringify(genreIds),
          types: JSON.stringify(typeValue ? [typeValue] : []),
          statuses: JSON.stringify(statusValue ? [statusValue] : []),
          sort,
          genreMatchMode: "any",
        }),
      };
      // Add a small delay to prevent rapid-fire requests
      await Application.sleep(0.2);  // 200ms delay
      
      const data = await this.fetchJson<SearchAPIResponse>(request);
      const searchItems = Array.isArray(data) ? data : data?.data || [];
      const items: SearchResultItem[] = [];
      
      for (const hit of searchItems || []) {
        try {
          if (!hit || typeof hit !== 'object') continue;
          if (!hit.url || !hit.title) continue; // Skip invalid items
          const mangaId = hit.url.replace(/^https?:\/\/mangataro\.org\/manga\//, "").split("/")[0];
          const imgSrc = hit.cover || hit.thumbnail || "";
          const imageUrl = imgSrc.startsWith("http") ? imgSrc : `${baseUrl}${imgSrc}`;
          const subtitle = hit.score ? `⭐ ${hit.score}` : undefined;
          items.push({
            mangaId,
            imageUrl,
            title: String(hit.title),
            subtitle,
            metadata: undefined,
          });
        } catch (itemError) {
          console.error("Error processing search item:", itemError, hit);
          continue; // Skip this item but continue processing others
        }
      }

      return {
        items,
        metadata: items.length > 0 ? { page: page + 1 } : undefined,
      };
    } catch (error) {
      console.error("Error in getSearchResults:", error);
      // Return empty results on error to prevent crashes
      return { items: [] };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const apiUrl = new URLBuilder(baseUrl).addPath("title").addPath(mangaId).build();
    const request = { url: apiUrl, method: "GET" };

    const $ = await this.fetchCheerio(request);

    // Title
    const title = $("h1.text-3xl.font-bold").first().text().trim();

    // Alt titles (split by '/')
    const altTitlesRaw = $("p.text-sm.text-neutral-400").first().text().trim();
    const altTitles = altTitlesRaw.split(" / ").map(t => t.trim()).filter(Boolean);

    // Description
    const description = $("#description-content-tab").text().trim();

    // Image
    const imageUrl = $(".rounded-xl img").first().attr("src") ?? "";

    // Status
    let status: "ONGOING" | "COMPLETED" | "UNKNOWN" = "UNKNOWN";
    $(".flex.items-center.gap-1.capitalize").each((_, el) => {
      const txt = $(el).text().toLowerCase();
      if (txt.includes("ongoing")) status = "ONGOING";
      else if (txt.includes("completed")) status = "COMPLETED";
    });

    // Tags
    const tags = [
      {
        id: "tags",
        title: "Tags",
        tags: $(".flex.flex-wrap.justify-center.md\\:justify-start.gap-1\\.5.sm\\:gap-2 a")
          .map((_, el) => {
            const rawId = $(el).attr("href")?.split("/").pop() ?? "";
            const id = rawId.replace(/[^a-zA-Z0-9]/g, ""); // ensure alphanumerical
            const title = $(el).text().trim();
            if (!title) return null; // Skip if title is empty
            return {
              id,
              title,
            };
          })
          .get()
          .filter(tag => tag !== null), // Filter out nulls
      },
    ];

    return {
      mangaId: mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: altTitles,
        thumbnailUrl: imageUrl,
        synopsis: description,
        rating: 1, // API doesn't provide rating
        contentRating: ContentRating.EVERYONE,
        status,
        tagGroups: tags,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const request = {
      url: `${baseUrl}/title/${mangaId}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const chapters: Chapter[] = [];

    // Parse chapters from #tab-chapters .chapter-list a
    $('#tab-chapters .chapter-list a').each((_, el) => {
      const link = $(el);
      const href = link.attr('href') || '';
      const match = href.match(/read\/([^/]+)\/(ch\d+-\d+)/);
      if (match) {
        const chapterId = match[2];
        const chapNumMatch = chapterId.match(/ch(\d+)-/);
        const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0;
        const nameRaw = link.find('p').first().text().trim();
        const name = (!nameRaw || nameRaw === "No title available" || nameRaw === "N/A") ? `Ch. ${chapNum}` : nameRaw;
        const timeStr = link.find('span:contains("ago")').text().trim();
        const publishDate = this.parseRelativeTime(timeStr);
        chapters.push({
          chapterId,
          sourceManga,
          title: name,
          volume: 0,
          chapNum,
          publishDate,
          langCode: "🇬🇧", // Could parse from title attribute if needed
        });
      }
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const mangaId = chapter.sourceManga.mangaId;
    const request = {
      url: `${baseUrl}/read/${mangaId}/${chapter.chapterId}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const pages: string[] = [];

    $('.comic-image-container img').each((_, el) => {
      const img = $(el);
      const src = img.attr('data-src') || img.attr('src') || '';
      if (src) {
        const imageUrl = src.startsWith("http") ? src : `${baseUrl}${src}`;
        pages.push(imageUrl);
      }
    });

    return {
      id: chapter.chapterId,
      mangaId,
      pages,
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/title/${mangaId}`;
  }

  async getTrendingSectionItems(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    section: DiscoverSection,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const request = {
      url: `${baseUrl}/home`,
      method: "GET",
    }

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    // Parse data-initial JSON from the highscore slider element
    const dataInitial = $("#highscore-manga-slider").attr("data-initial");
    if (dataInitial) {
      const trendingItems: PopularItem[] = JSON.parse(dataInitial) as PopularItem[];
      for (const item of trendingItems) {
        const mangaId = item.permalink.replace(/^https?:\/\/mangataro\.org\/manga\//, "").split("/")[0];
        const imageUrl = item.cover.startsWith("http") ? item.cover : `${baseUrl}${item.cover}`;
        items.push({
          type: "prominentCarouselItem",
          mangaId,
          imageUrl,
          title: item.title,
          subtitle: undefined,
          metadata: undefined,
        });
      }
    }

    return {
      items,
    };
  }

  async getPopularSectionItems(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    section: DiscoverSection,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metadata: metadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const request = {
      url: `${baseUrl}/home`,
      method: "GET",
    }

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    // Parse data-initial JSON from the slider element
    const dataInitial = $("#unified-manga-slider").attr("data-initial");
    if (dataInitial) {
      const popularItems: PopularItem[] = JSON.parse(dataInitial) as PopularItem[];
      for (const item of popularItems) {
        const mangaId = item.permalink.replace(/^https?:\/\/mangataro\.org\/manga\//, "").split("/")[0];
        const imageUrl = item.cover.startsWith("http") ? item.cover : `${baseUrl}${item.cover}`;
        items.push({
          type: "featuredCarouselItem",
          mangaId,
          imageUrl,
          title: item.title,
          supertitle: item.manga_type,
          metadata: undefined,
        });
      }
    }

    return {
      items,
    };
  }

  async getRecentlyUpdatedSectionItems(
    section: DiscoverSection,
    metadata: metadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    // Mangataro latest updates requires POST with page query param
    const page = metadata?.page ?? 1; // API is 1-indexed
    const collectedIds: string[] = metadata?.collectedIds ?? [];

    const request: Request = {
      url: `${baseUrl}/wp-json/manga/v1/latest-chapters?page=${page}`,
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        origin: baseUrl,
        referer: `${baseUrl}/home`,
      },
      // The endpoint accepts a POST with empty body
      body: "",
    };

    const data = await this.fetchJson<LatestChaptersResponse>(request);
    const items: DiscoverSectionItem[] = [];

    for (const entry of data.data || []) {
      // Extract mangaId from permalink, e.g. "https://mangataro.org/read/unordinary/ch369-473827" -> "unordinary"
      let mangaId = "";
      let chapterId = "";
      if (entry.permalink) {
        const match = entry.permalink.match(/read\/([^/]+)\/(ch[^-]+-\d+)/);
        mangaId = match ? match[1] : entry.manga_id;
        // Fix: Use entry.chapter instead of entry.chapter_id, and handle possible undefined
        chapterId = match ? match[2] : (typeof entry.chapter === "string" ? entry.chapter : "");
      } else {
        mangaId = entry.manga_id;
        chapterId = typeof entry.chapter === "string" ? entry.chapter : "";
      }
      if (collectedIds.includes(mangaId)) continue;
      collectedIds.push(mangaId);

      const imageUrl = entry.cover?.startsWith("http") ? entry.cover : `${baseUrl}${entry.cover ?? ""}`;
      items.push({
        type: "chapterUpdatesCarouselItem",
        mangaId,
        chapterId, // <-- added property
        imageUrl,
        title: entry.title,
        subtitle: entry.chapter || entry.time || undefined,
        metadata: undefined,
      });
    }

    return {
      items,
      metadata: items.length > 0 ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    const request = { url: `${baseUrl}/browse`, method: "GET" };
    const $ = await this.fetchCheerio(request);

    const sortOptions: SortingOption[] = [];
    const seen = new Set<string>();
    $('h3:contains("Sort By")').next().find('button').each((_, el) => {
      const text = $(el).text().trim();
      const id = text.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const key = `${id}-${text}`;
      if (!seen.has(key)) {
        seen.add(key);
        sortOptions.push({ id, label: text });
      }
    });

    return sortOptions;
  }

  checkCloudflareStatus(status: number): void {
    if (status == 503 || status == 403) {
      throw new CloudflareError({ url: baseUrl, method: "GET" });
    }
  }

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const [response, data] = await Application.scheduleRequest(request);
    this.checkCloudflareStatus(response.status);
    const htmlStr = Application.arrayBufferToUTF8String(data);
    const dom = htmlparser2.parseDocument(htmlStr);
    return cheerio.load(dom);
  }

  async fetchJson<T = unknown>(request: Request): Promise<T> {
    const [response, data] = await Application.scheduleRequest(request);
    this.checkCloudflareStatus(response.status);
    const jsonStr = Application.arrayBufferToUTF8String(data);
    return JSON.parse(jsonStr) as T;
  }

  private parseRelativeTime(timeStr: string): Date | undefined {
    const now = Date.now();
    const match = timeStr.trim().match(/^(\d+)([mhdwMy])\s+ago$/);
    if (!match) return undefined;
    const value = parseInt(match[1]);
    const unit = match[2];
    let ms = 0;
    switch (unit) {
      case 'm': ms = value * 60 * 1000; break; // minutes
      case 'h': ms = value * 60 * 60 * 1000; break; // hours
      case 'd': ms = value * 24 * 60 * 60 * 1000; break; // days
      case 'w': ms = value * 7 * 24 * 60 * 60 * 1000; break; // weeks
      case 'M': ms = value * 30 * 24 * 60 * 60 * 1000; break; // months approx
      case 'y': ms = value * 365 * 24 * 60 * 60 * 1000; break; // years approx
    }
    return new Date(now - ms);
  }
}

export const Mangataro = new MangataroExtension();