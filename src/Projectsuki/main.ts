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
  TagSection,
} from "@paperback/types";

import { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";
import * as htmlparser2 from "htmlparser2";

import { ProjectsukiInterceptor } from "./interceptors";
import { ProjectsukiMetadata } from "./model";

const baseUrl = "https://projectsuki.com";

type ProjectsukiImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class ProjectsukiExtension implements ProjectsukiImplementation {
  requestManager = new ProjectsukiInterceptor("main");
  globalRateLimiter = new BasicRateLimiter("rateLimiter", {
    numberOfRequests: 10,
    bufferInterval: 1,
    ignoreImages: true,
  });

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.globalRateLimiter.registerInterceptor();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "popular_section",
        title: "Popular",
        type: DiscoverSectionType.featured,
      },
      {
        id: "updated_section",
        title: "Recently Updated",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: ProjectsukiMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "popular_section":
        return this.getPopularSectionItems(section, metadata);
      case "updated_section":
        return this.getUpdatedSectionItems(section, metadata);
      default:
        return { items: [] };
    }
  }

  async getSearchFilters(): Promise<SearchFilter[]> {
    const filters: SearchFilter[] = [];

    return filters;
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    return [];
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: ProjectsukiMetadata | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = new Set(metadata?.collectedIds ?? []);

    const request = {
      url: `${baseUrl}/search?q=${encodeURIComponent(query.title ?? "")}&page=${page}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: SearchResultItem[] = [];

    $(".browse").each((_, el) => {
      const titleAnchor = $(el).find(".details h4 a").first();
      const href = titleAnchor.attr("href") ?? "";
      const idMatch = href.match(/\/book\/(\d+)/);
      const mangaId = idMatch ? idMatch[1] : undefined;
      if (!mangaId || collectedIds.has(mangaId)) return;
      collectedIds.add(mangaId);

      const title = titleAnchor.text().trim();
      let imageUrl = $(el).find(".mr-2 img").first().attr("src") ?? "";
      if (imageUrl && imageUrl.startsWith("/")) {
        imageUrl = baseUrl.replace(/\/+$/g, "") + imageUrl;
      }

      items.push({
        mangaId,
        title,
        imageUrl,
        subtitle: undefined,
        metadata: undefined,
      });
    });

    const hasNextPage = $("a")
      .toArray()
      .some((link) => {
        const anchor = $(link);
        const href = anchor.attr("href") ?? "";
        return (
          anchor.text().trim().toLowerCase() === "next" &&
          href.includes("/search") &&
          href.includes(`page=${page + 1}`)
        );
      });

    return {
      items,
      metadata: hasNextPage ? { page: page + 1, collectedIds: [...collectedIds] } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `https://projectsuki.com/book/${mangaId}`;
    const request: Request = { url, method: "GET" };
    const $ = await this.fetchCheerio(request);

    // title and alternative titles
    const primaryTitle = $("h2[itemprop=title]").first().text().trim() || "";
    const altTitles: string[] = [];
    $(".row.py-1").each((_, el) => {
      const label = $(el).find(".col-4").first().text().trim();
      if (label.startsWith("Alternative titles")) {
        const text = $(el).find(".col-8").text().trim();
        if (text) {
          altTitles.push(...text.split(",").map((s) => s.trim()).filter(Boolean));
        }
      }
    });

    // thumbnail
    let thumbnailUrl = $(".img-thumbnail").first().attr("src") || "";
    if (thumbnailUrl && thumbnailUrl.startsWith("/")) {
      thumbnailUrl = baseUrl.replace(/\/+$/g, "") + thumbnailUrl;
    }

    // synopsis
    const synopsis = $(".description").text().trim();

    // status
    let statusText = "";
    $(".row.py-1").each((_, el) => {
      const label = $(el).find(".col-4").first().text().trim();
      if (label.startsWith("Status")) {
        statusText = $(el).find(".col-8").text().trim();
      }
    });
    let status: "ONGOING" | "COMPLETED" | "UNKNOWN" = "UNKNOWN";
    if (/completed/i.test(statusText)) status = "COMPLETED";
    else if (/ongoing/i.test(statusText)) status = "ONGOING";

    // genres
    const genres: string[] = [];
    $(".row.py-1").each((_, el) => {
      const label = $(el).find(".col-4").first().text().trim();
      if (label.startsWith("Genre")) {
        $(el)
          .find(".col-8 a")
          .each((_, g) => {
            genres.push($(g).text().trim());
          });
      }
    });
    const tagGroups: TagSection[] = [];
    if (genres.length) {
      const tags = genres.map((g, i) => {
      let id = g.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!id) id = `genre${i}`; // fallback to ensure non-empty alphanumeric id
      return { id, title: g };
      });
      tagGroups.push({
      id: "genres",
      title: "Genres",
      tags,
      });
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle,
        secondaryTitles: altTitles,
        thumbnailUrl,
        synopsis,
        rating: 0,
        contentRating: ContentRating.EVERYONE,
        status,
        tagGroups,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const url = `https://projectsuki.com/book/${mangaId}`;

    const request: Request = { url, method: "GET" };
    const $ = await this.fetchCheerio(request);

    const chapters: Chapter[] = [];
    const seen = new Set<string>();

    $('a[href*="/read/"]').each((_, el) => {
      const anchor = $(el);
      const href = anchor.attr("href") || "";
      const match = href.match(/\/read\/\d+\/(\d+)/);
      const chapterId = match ? match[1] : undefined;
      if (!chapterId || seen.has(chapterId)) return;

      const row = anchor.closest("tr");
      if (!row.length) return; // skip stray "read now" buttons outside the list
      seen.add(chapterId);

      const title = anchor.text().trim();
      // try to specifically capture the chapter number (e.g. "Ch.134", "Chapter 134") first
      let chapNum = 0;
      const chapMatch = title.match(/(?:Ch(?:apter)?\.?\s*)(\d+(?:\.\d+)?)/i);
      if (chapMatch) {
        chapNum = parseFloat(chapMatch[1]);
      } else {
        const numMatch = title.match(/(\d+(?:\.\d+)?)/);
        chapNum = numMatch ? parseFloat(numMatch[1]) : 0;
      }

      // publish date is in last column span title as dd-mm-yyyy
      let publishDate: Date | undefined;
      const dateSpan = row.find("span[itemscope][itemtype*=dateCreated]").first();
      const dateTitle = dateSpan.attr("title") || dateSpan.text().trim();
      if (dateTitle) {
        const parts = dateTitle.split("-");
        if (parts.length === 3) {
          // convert to ISO yyyy-mm-dd
          publishDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          publishDate = new Date(dateTitle);
        }
      }

      const lang = row.find("td").eq(1).text().trim();
      const langCode = lang ? lang.substring(0, 2).toLowerCase() : "en";

      // add a chapter order based on the chapter number and volume in the title (if present)
      let volume = 0;
      const volumeMatch = title.match(/Vol\.(\d+)/i);
      if (volumeMatch) {
        volume = parseInt(volumeMatch[1], 10);
      }

      chapters.push({
        chapterId,
        title,
        sourceManga,
        chapNum,
        publishDate,
        volume,
        langCode,
        version: "1",
      });
    });

    chapters.reverse();
    chapters.sort((a, b) => {
      if ((a.volume ?? 0) !== (b.volume ?? 0)) {
        return (a.volume ?? 0) - (b.volume ?? 0);
      }
      return a.chapNum - b.chapNum;
    });

    // sortingIndex is the app's ordering key; ascending index = newest last.
    chapters.forEach((chapter, i) => (chapter.sortingIndex = i));

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const bookId = chapter.sourceManga.mangaId;
    const chapterId = chapter.chapterId;

    const $ = await this.fetchCheerio({
      url: `${baseUrl}/read/${bookId}/${chapterId}/1`,
      method: "GET",
    });
    const firstImg = $('img[src*="/images/gallery/"]').first().attr("src") ?? "";
    const hashMatch = firstImg.match(/\/images\/gallery\/\d+\/([a-f0-9]+)\//i);
    if (!hashMatch) {
      throw new Error(`Projectsuki: no page images found for chapter ${chapterId}`);
    }
    const hash = hashMatch[1];
    const pageUrl = (n: number) =>
      `${baseUrl}/images/gallery/${bookId}/${hash}/${n.toString().padStart(3, "0")}`;
    const exists = async (n: number): Promise<boolean> => {
      const [res] = await Application.scheduleRequest({ url: pageUrl(n), method: "HEAD" });
      return res.status === 200;
    };

    const BATCH = 10;
    const MAX = 500;
    const pages: string[] = [pageUrl(1)];
    for (let start = 2; start <= MAX; start += BATCH) {
      const nums: number[] = [];
      for (let n = start; n < start + BATCH && n <= MAX; n++) nums.push(n);
      const oks = await Promise.all(nums.map(exists));
      const missing = oks.indexOf(false);
      const upTo = missing === -1 ? oks.length : missing;
      for (let i = 0; i < upTo; i++) pages.push(pageUrl(nums[i]));
      if (missing !== -1) break;
    }

    return {
      mangaId: bookId,
      id: chapterId,
      pages,
    };
  }

  private async getPopularSectionItems(
    section: DiscoverSection,
    metadata: ProjectsukiMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const request = {
      url: baseUrl,
      method: "GET",
    }

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];
    const page = metadata?.page ?? 1;
    const collectedIds: string[] = metadata?.collectedIds ?? [];

    $(".trending").each((_, el) => {
      const anchor = $(el).find("a").first();
      const href = anchor.attr("href") ?? "";
      const idMatch = href.match(/\/book\/(\d+)/);
      const mangaId = idMatch ? idMatch[1] : undefined;
      if (!mangaId || collectedIds.includes(mangaId)) return;
      collectedIds.push(mangaId);

      const img = $(el).find("img").first();
      const imageUrl = img.attr("src") ?? "";
      const title = anchor.text().trim() || img.attr("alt")?.trim() || "";

      items.push({
        type: "featuredCarouselItem",
        mangaId,
        imageUrl: imageUrl,
        title: title,
        metadata: undefined,
      });
    });

    const hasNextPage = items.length > 0;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  private async getUpdatedSectionItems(
    section: DiscoverSection,
    metadata: ProjectsukiMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const request = {
      url: baseUrl,
      method: "GET",
    }

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];
    const page = metadata?.page ?? 1;
    const collectedIds: string[] = metadata?.collectedIds ?? [];

    $(".item").each((_, el) => {
      const anchor = $(el).find(".mr-2 a").first();
      const href = anchor.attr("href") ?? "";
      const idMatch = href.match(/(\d+)/);
      const mangaId = idMatch ? idMatch[1] : undefined;
      if (!mangaId || collectedIds.includes(mangaId)) return;
      collectedIds.push(mangaId);

      const img = anchor.find("img").first();
      const imageUrl = img.attr("src") ?? "";

      const titleAnchor = $(el).find(".title a").first();
      const title =
      (titleAnchor.text().trim() ||
        titleAnchor.attr("title") ||
        img.attr("title") ||
        "").trim();

      const chapterAnchor = $(el).find(".pages a").first();
      const subtitle = chapterAnchor.text().trim() || undefined;

      items.push({
        type: "chapterUpdatesCarouselItem",
        mangaId,
        chapterId: chapterAnchor.attr("href")?.match(/\/book\/\d+\/chapter\/(\d+)/)?.[1] ?? "",
        imageUrl: imageUrl,
        title: title,
        subtitle: subtitle,
        metadata: undefined,
      });
    });

    const hasNextPage = items.length > 0;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/comic/${mangaId}`;
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
    if (/<title>Just a moment|cf-browser-verification/i.test(htmlStr)) {
      throw new CloudflareError({ url: request.url, method: request.method });
    }
    const dom = htmlparser2.parseDocument(htmlStr);
    return cheerio.load(dom);
  }
}

export const Projectsuki = new ProjectsukiExtension();
