import {
  type AdvancedSearchForm,
  BasicRateLimiter,
  Chapter,
  ChapterProviding,
  CloudflareBypassRequestProviding,
  CloudflareError,
  ContentRating,
  Cookie,
  CookieStorageInterceptor,
  DiscoverSection,
  DiscoverSectionItem,
  DiscoverSectionProviding,
  DiscoverSectionType,
  Extension,
  MangaProviding,
  NovelChapter,
  Metadata,
  PagedResults,
  Request,
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SortingOption,
  SourceManga,
  TagSection,
} from "@paperback/types";
import * as cheerio from "cheerio";
import * as htmlparser2 from "htmlparser2";
import { URLBuilder } from "../utils/url-builder/base";
import { NovelFireInterceptor } from "./interceptors";
import { type NovelFireMetadata, type NovelFireResult, type NovelFireSearchMeta, SORTS } from "./model";
import { NovelFireSearchForm } from "./forms/SearchForm";
import type { CheerioAPI } from "cheerio";

const baseUrl = "https://novelfire.net";

type NovelFireImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding &
  CloudflareBypassRequestProviding;

export class NovelFireExtension implements NovelFireImplementation {
  requestManager = new NovelFireInterceptor("main");
  globalRateLimiter = new BasicRateLimiter("rateLimiter", {
    numberOfRequests: 10,
    bufferInterval: 1,
    ignoreImages: true,
  });
  cookieStorageInterceptor = new CookieStorageInterceptor({
    storage: "stateManager",
  });

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.globalRateLimiter.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
  }

  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    for (const cookie of this.cookieStorageInterceptor.cookies) {
      this.cookieStorageInterceptor.deleteCookie(cookie);
    }
    for (const cookie of cookies) {
      if (cookie.expires && cookie.expires.getTime() <= Date.now()) continue;
      this.cookieStorageInterceptor.setCookie(cookie);
    }
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
    metadata: Metadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const meta = metadata as NovelFireMetadata | undefined;
    switch (section.id) {
      case "popular_section":
        return this.getPopularSectionItems(section, meta);
      case "updated_section":
        return this.getUpdatedSectionItems(section, meta);
      case "new_section":
        return this.getNewSectionItems(section, meta);
      default:
        return { items: [] };
    }
  }

  async getSortingOptions(_query: SearchQuery<Metadata>): Promise<SortingOption[]> {
    return SORTS.map((s) => ({ id: s.id, label: s.label }));
  }

  async getAdvancedSearchForm(query: SearchQuery<Metadata>): Promise<AdvancedSearchForm> {
    const meta = (query.metadata as { searchMeta?: NovelFireSearchMeta } | undefined)?.searchMeta;
    return new NovelFireSearchForm(meta);
  }

  async getSearchResults(
    query: SearchQuery<Metadata>,
    metadata: Metadata | undefined,
    sortingOption: SortingOption | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const paginationMeta = metadata as { page?: number } | undefined;
    const page = paginationMeta?.page ?? 1;

    if (query.title && query.title.trim() !== "") {
      const searchUrl = `${baseUrl}/ajax/searchLive?keyword=${encodeURIComponent(query.title.trim())}&type=title`;
      const [, data] = await Application.scheduleRequest({ url: searchUrl, method: "GET" });
      const jsonString = Application.arrayBufferToUTF8String(data);
      const result = JSON.parse(jsonString) as NovelFireResult;
      const items: SearchResultItem[] = (result?.data ?? []).map((item) => ({
        mangaId: item.slug,
        title: item.title,
        imageUrl: item.image.startsWith("http") ? item.image : `${baseUrl}/${item.image}`,
        subtitle: `${item.total_chapter} chapters`,
      }));
      return { items };
    }

    const searchMeta = (query.metadata as { searchMeta?: NovelFireSearchMeta } | undefined)?.searchMeta;
    const genre = Object.entries(searchMeta?.genres ?? {}).find(([, s]) => s === "included")?.[0] ?? "genre-all";
    const sort = sortingOption?.id ?? "sort-latest-release";
    const status = searchMeta?.status ?? "status-all";

    const request = {
      url: new URLBuilder(baseUrl)
        .addPath(genre)
        .addPath(sort)
        .addPath(status)
        .addPath("all-novel")
        .addQuery("page", String(page))
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const collectedIds: string[] = [];
    const items: SearchResultItem[] = [];

    $(".novel-item").each((_, el) => {
      const novel = $(el);
      const a = novel.find("a");
      const url = a.attr("href") || "";
      const title = a.attr("title") || a.text().trim();
      const imgurl = novel.find("img").attr("data-src") || novel.find("img").attr("src") || "";
      const coverUrl = imgurl.startsWith("http") ? imgurl : `${baseUrl}${imgurl}`;
      const mangaId = url.split("/book/")[1] || "";
      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push({ mangaId, title, imageUrl: coverUrl, subtitle: undefined });
      }
    });

    const hasNextPage = !!$(".pagination .page-item.active + .page-item").length;

    return {
      items,
      metadata: hasNextPage ? ({ page: page + 1 } satisfies NovelFireMetadata) : undefined,
    };
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
        contentType: "novel",
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

  async getChapterDetails(chapter: Chapter): Promise<NovelChapter> {
    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("book")
        .addPath(chapter.chapterId)
        .build(),
      method: "GET",
    };

    const $ = (await this.fetchCheerio(request));

    $(".nf-ads").remove();

    const content = $("#content").map((_, el) => $(el).html() ?? "").toArray().join("");
    const html = `<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>${content}</body></html>`;

    return {
      mangaId: chapter.sourceManga.mangaId,
      id: chapter.chapterId,
      type: "html",
      html,
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/book/${mangaId}`;
  }

  private async getPopularSectionItems(
    _section: DiscoverSection,
    metadata: NovelFireMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds: string[] = metadata?.collectedIds ?? [];

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
      const imgurl =
        novel.find("img").attr("data-src") ||
        novel.find("img").attr("src") ||
        "";
      const coverUrl = `${baseUrl}${imgurl}`;
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
        });
      }
    });

    const hasNextPage = !!$(".pagination .page-item.active + .page-item").length;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } satisfies NovelFireMetadata : undefined,
    };
  }

  private async getUpdatedSectionItems(
    _section: DiscoverSection,
    metadata: NovelFireMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds: string[] = metadata?.collectedIds ?? [];

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
      const imgurl =
        novel.find("img").attr("data-src") ||
        novel.find("img").attr("src") ||
        "";
      const coverUrl = `${baseUrl}${imgurl}`;
      const chapters =
        parseInt(novel.find(".novel-stats").text().replace(/\D/g, "")) ||
        undefined;

      const mangaId = url.split("/book/")[1] || "";

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push({
          type: "chapterUpdatesCarouselItem",
          mangaId: mangaId,
          chapterId: "",
          imageUrl: coverUrl,
          title: title,
          subtitle: chapters ? `${chapters} chapters` : undefined,
        });
      }
    });

    const hasNextPage = !!$(".pagination .page-item.active + .page-item").length;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } satisfies NovelFireMetadata : undefined,
    };
  }

  private async getNewSectionItems(
    _section: DiscoverSection,
    metadata: NovelFireMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds: string[] = metadata?.collectedIds ?? [];

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
      const imgurl =
        novel.find("img").attr("data-src") ||
        novel.find("img").attr("src") ||
        "";
      const coverUrl = `${baseUrl}${imgurl}`;
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
        });
      }
    });

    const hasNextPage = !!$(".pagination .page-item.active + .page-item").length;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } satisfies NovelFireMetadata : undefined,
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
