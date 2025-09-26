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
  Form,
  MangaProviding,
  PagedResults,
  PBCanvas,
  Request,
  SearchFilter,
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SourceManga,
  TagSection,
} from "@paperback/types";
import * as cheerio from "cheerio";
import * as htmlparser2 from "htmlparser2";
import { URLBuilder } from "../utils/url-builder/base";
import { NovelFireInterceptor } from "./interceptors";
import { NovelFireMetadata } from "./model";
import type { CheerioAPI, Cheerio } from "cheerio";

const baseUrl = "https://novelfire.net";
const apiUrl = "https://novels-83gm.onrender.com";

type NovelFireImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class NovelFireExtension implements NovelFireImplementation {
  requestManager = new NovelFireInterceptor("main");
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
      {
        id: "new_section",
        title: "New Novels",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: NovelFireMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "popular_section":
        return this.getPopularSectionItems(section, metadata);
      case "updated_section":
        return this.getUpdatedSectionItems(section, metadata);
      case "new_section":
        return this.getNewSectionItems(section, metadata);
      default:
        return { items: [] };
    }
  }

  async getSearchFilters(): Promise<SearchFilter[]> {
    return [];
  }

  async getSearchResults(
    query: SearchQuery,
    _metadata: NovelFireMetadata | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    if (!query.title || query.title.trim() === "") {
      // Show popular section if no query
      const section = {
        id: "popular_section",
        title: "Popular",
        type: DiscoverSectionType.featured,
      };
      const results = await this.getPopularSectionItems(section, undefined);
      // Only map items with required properties
      const items = results.items
        .filter(item => "mangaId" in item && "title" in item && "imageUrl" in item)
        .map(item => ({
          mangaId: (item as any).mangaId,
          title: (item as any).title,
          imageUrl: (item as any).imageUrl,
          subtitle: (item as any).supertitle || (item as any).subtitle,
          metadata: (item as any).metadata,
        }));
      return { items };
    }
    const searchUrl = `${baseUrl}/ajax/searchLive?inputContent=${encodeURIComponent(query.title)}`;
    const request = {
      url: searchUrl,
      method: "GET",
    };
    const [, data] = await Application.scheduleRequest(request);
    const jsonString = Application.arrayBufferToUTF8String(data);
    const result = JSON.parse(jsonString) as { html: string };
    const $ = cheerio.load(result.html);
    const items: SearchResultItem[] = [];
    $(".novel-item").each((_, el) => {
      const novel = $(el);
      const a = novel.find("a");
      const url = String(a.attr("href")) || "";
      const title = String(novel.find(".novel-title").text()).trim();
      const coverUrl = String(novel.find("img").attr("src")) || "";
      const mangaId = url.split("/book/")[1] || url;
      if (title && mangaId) {
        items.push({
          mangaId,
          title,
          imageUrl: coverUrl,
          subtitle: undefined,
          metadata: undefined,
        });
      }
    });
    return { items };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = {
      url: new URLBuilder(baseUrl).addPath("book").addPath(mangaId).build(),
      method: "GET",
    };
    const $ = (await this.fetchCheerio(request));
    const title = String($(".novel-title").text()).trim();
    const coverUrl = String($(".novel-header img").attr("src")) || "";
    const genres: string[] = [];
    $(".categories .property-item").each((_, el) => {
      genres.push(String($(el).text()).trim());
    });
    const tags: string[] = [];
    $(".tag").each((_, el) => {
      tags.push(String($(el).text()).trim());
    });
    const rating = parseFloat(String($(".rating").text()).trim()) || 1;
    const author = String($(".property-item").first().text()).trim();
    const status = String($(".completed").text()).trim() || "UNKNOWN";
    const description = String($(".content.expand-wrapper").text()).trim();

    const tagGroups: TagSection[] = [];
    if (genres.length > 0) {
      tagGroups.push({
        id: "genres",
        title: "Genres",
        tags: genres.map((genre) => ({
          id: genre.toLowerCase().replace(/\s+/g, "-"),
          title: genre,
        })),
      });
    }
    if (tags.length > 0) {
      tagGroups.push({
        id: "tags",
        title: "Tags",
        tags: tags.map((tag) => ({
          id: tag.toLowerCase().replace(/\s+/g, "-"),
          title: tag,
        })),
      });
    }

    return {
      mangaId: mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl: coverUrl,
        synopsis: description,
        rating: rating,
        contentRating: ContentRating.EVERYONE,
        status: status as "ONGOING" | "COMPLETED" | "UNKNOWN",
        tagGroups: tagGroups,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("book")
        .addPath(mangaId)
        .addPath("chapters")
        .build(),
      method: "GET",
    };

    const $ = (await this.fetchCheerio(request));
    const chapters: Chapter[] = [];
    $(".chapter-list li").each((_, el) => {
      const li = $(el);
      const a = li.find("a");
      const url = String(a.attr("href")) || "";
      const title = String(a.attr("title")) || a.text().trim();
      const chapterNo =
        parseFloat(String(a.find(".chapter-no").text()).trim()) || undefined;
      const createdAt = String(a.find("time").attr("datetime"));
      const chapterId = url.split("/book/")[1] || url;
      chapters.push({
        chapterId: chapterId,
        title: title,
        sourceManga,
        chapNum: chapterNo ?? 0,
        publishDate: createdAt ? new Date(createdAt) : undefined,
        volume: 0,
        langCode: "en",
        version: "1",
      });
    });
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("book")
        .addPath(chapter.chapterId)
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const contentDiv = $("#content");
    // Remove ads
    contentDiv.find(".nf-ads, .adcash, iframe").remove();
    // Remove custom tags
    contentDiv.find("*").each((_, el) => {
      if ($(el).prop("tagName")?.startsWith("AZ")) {
        $(el).remove();
      }
    });
    const textContent = contentDiv.html() || "";

    // Generate images from text via API
    const apiRequest = {
      url: apiUrl + "/create_images",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: textContent }),
    };
    const [, data] = await Application.scheduleRequest(apiRequest);
    const jsonString = Application.arrayBufferToUTF8String(data);
    const dataObj = JSON.parse(jsonString) as { status: string; data?: { images: string[] }; error?: string };
    if (dataObj.status !== "success") {
      throw new Error(dataObj.error || "Failed to generate images");
    }
    const imageUrls = dataObj.data!.images.map((url: string) => apiUrl + url);

    return {
      mangaId: chapter.sourceManga.mangaId,
      id: chapter.chapterId,
      pages: imageUrls,
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/book/${mangaId}`;
  }

  private async getPopularSectionItems(
    section: DiscoverSection,
    metadata: NovelFireMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("genre-all")
        .addPath("sort-popular")
        .addPath("status-all")
        .addPath("all-novel")
        .addQuery("page", page.toString())
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".novel-item").each((_, el) => {
      const novel = $(el);
      const a = novel.find("a");
      const url = a.attr("href") || "";
      const title = a.attr("title") || "";
      const coverUrl =
        novel.find("img").attr("data-src") ||
        novel.find("img").attr("src") ||
        "";
      const rating =
        parseFloat(novel.find(".badge._br").text().trim()) || undefined;
      const chapters =
        parseInt(novel.find(".novel-stats").text().replace(/\D/g, "")) ||
        undefined;

      const mangaId = url.split("/book/")[1] || "";

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push({
          type: "featuredCarouselItem",
          mangaId: mangaId,
          imageUrl: coverUrl,
          title: title,
          supertitle: rating ? `⭐ ${rating}` : undefined,
          metadata: undefined,
        });
      }
    });

    const hasNextPage = !!$(".pagination .page-item.active + .page-item")
      .length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  private async getUpdatedSectionItems(
    section: DiscoverSection,
    metadata: NovelFireMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("genre-all")
        .addPath("sort-latest-release")
        .addPath("status-all")
        .addPath("all-novel")
        .addQuery("page", page.toString())
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".novel-item").each((_, el) => {
      const novel = $(el);
      const a = novel.find("a");
      const url = a.attr("href") || "";
      const title = a.attr("title") || "";
      const coverUrl =
        novel.find("img").attr("data-src") ||
        novel.find("img").attr("src") ||
        "";
      const chapters =
        parseInt(novel.find(".novel-stats").text().replace(/\D/g, "")) ||
        undefined;

      const mangaId = url.split("/book/")[1] || "";

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push({
          type: "chapterUpdatesCarouselItem",
          mangaId: mangaId,
          chapterId: "", // No specific chapter
          imageUrl: coverUrl,
          title: title,
          subtitle: chapters ? `${chapters} chapters` : undefined,
          metadata: undefined,
        });
      }
    });

    const hasNextPage = !!$(".pagination .page-item.active + .page-item")
      .length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  private async getNewSectionItems(
    section: DiscoverSection,
    metadata: NovelFireMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("genre-all")
        .addPath("sort-new")
        .addPath("status-all")
        .addPath("all-novel")
        .addQuery("page", page.toString())
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".novel-item").each((_, el) => {
      const novel = $(el);
      const a = novel.find("a");
      const url = a.attr("href") || "";
      const title = a.attr("title") || "";
      const coverUrl =
        novel.find("img").attr("data-src") ||
        novel.find("img").attr("src") ||
        "";
      const rating =
        parseFloat(novel.find(".badge._br").text().trim()) || undefined;

      const mangaId = url.split("/book/")[1] || "";

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push({
          type: "simpleCarouselItem",
          mangaId: mangaId,
          imageUrl: coverUrl,
          title: title,
          subtitle: rating ? `⭐ ${rating}` : undefined,
          metadata: undefined,
        });
      }
    });

    const hasNextPage = !!$(".pagination .page-item.active + .page-item")
      .length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  checkCloudflareStatus(status: number): void {
    if (status == 503 || status == 403) {
      throw new CloudflareError({ url: baseUrl, method: "GET" });
    }
  }

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const [, data] = await Application.scheduleRequest(request);
    this.checkCloudflareStatus((data as any)?.status ?? 200);
    const htmlStr = Application.arrayBufferToUTF8String(data);
    const dom = htmlparser2.parseDocument(htmlStr);
    return cheerio.load(dom);
  }
}

export const NovelFire = new NovelFireExtension();
