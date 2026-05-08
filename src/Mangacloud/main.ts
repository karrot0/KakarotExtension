import {
  AdvancedSearchForm,
  BasicRateLimiter,
  Metadata,
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
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SortingOption,
  SourceManga,
  TagSection,
} from "@paperback/types";
import { MangacloudSearchForm, type MangacloudSearchMetadata } from "./forms/SearchForm";

import { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";
import * as htmlparser2 from "htmlparser2";

import { MangacloudInterceptor } from "./interceptors";
import { MostViewedMangaResponse, ApiResponse, UpdatedMangaResponse, MangaInfo, ChapterInfo, BrowseMangaResponse, SortOptions } from "./model";

const baseUrl = "https://mangacloud.org/";

type MangacloudImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class MangacloudExtension implements MangacloudImplementation {
  requestManager = new MangacloudInterceptor("main");
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
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "popular_section":
        return this.getPopularSectionItems(section);
      case "updated_section":
        return this.getUpdatedSectionItems(section);
      default:
        return { items: [] };
    }
  }

  async getAdvancedSearchForm(query: SearchQuery<Metadata>): Promise<AdvancedSearchForm> {
    const meta = (query.metadata as { searchMeta?: MangacloudSearchMetadata } | undefined)?.searchMeta;
    return new MangacloudSearchForm(meta);
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    return SortOptions.map((s) => ({ id: s.id, value: s.name, label: s.name }));
  }

  async getSearchResults(
    query: SearchQuery<Metadata>,
    metadata: Metadata | undefined,
    sortingOption: SortingOption | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = 1;
    const body: Record<string, unknown> = { page };

    if (query.title && query.title.trim() !== "") {
      body.title = query.title;
    }

    if (sortingOption && sortingOption.id && sortingOption.id !== "") {
      body.sort = sortingOption.id;
    }

    const searchMeta = (query.metadata as { searchMeta?: MangacloudSearchMetadata } | undefined)?.searchMeta;

    const includes: string[] = [
      ...(searchMeta?.genreIncluded ?? []),
      ...(searchMeta?.themeIncluded ?? []),
      ...(searchMeta?.formatIncluded ?? []),
    ];
    const excludes: string[] = [
      ...(searchMeta?.genreExcluded ?? []),
      ...(searchMeta?.themeExcluded ?? []),
      ...(searchMeta?.formatExcluded ?? []),
    ];

    if (searchMeta?.type) body.type = searchMeta.type;
    if (searchMeta?.status) body.status = searchMeta.status;
    if (includes.length > 0) body.includes = includes;
    if (excludes.length > 0) body.excludes = excludes;

    const apiUrl = `https://api.mangacloud.org/comic/browse`;
    const request: Request = {
      url: apiUrl,
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "*/*" },
      body: JSON.stringify(body),
    };

    const [, data] = await Application.scheduleRequest(request);
    const jsonStr = Application.arrayBufferToUTF8String(data);
    const resp = JSON.parse(jsonStr) as ApiResponse<BrowseMangaResponse>;
    const list = resp.data || [];

    const items: SearchResultItem[] = [];
    for (const m of list) {
      const mangaId = m.id;
      if (!mangaId) continue;
      items.push({
        mangaId,
        title: m.title,
        imageUrl: m.cover
          ? `https://pika.mangacloud.org/${mangaId}/${m.cover.id}.${m.cover.f}`
          : "",
        subtitle: undefined,
        metadata: undefined,
      });
    }

    const hasNextPage = list.length > 0;
    return {
      items,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const apiUrl = `https://api.mangacloud.org/comic/${mangaId}`;
    const request: Request = { url: apiUrl, method: "GET" };

    const [, data] = await Application.scheduleRequest(request);
    const jsonStr = Application.arrayBufferToUTF8String(data);
    const resp = JSON.parse(jsonStr) as ApiResponse<MangaInfo>;
    const info = resp.data;

    const tagGroups: TagSection[] = [];
    if (info.tags && info.tags.length > 0) {
      tagGroups.push({
        id: "tags",
        title: "Tags",
        tags: info.tags.map((t) => ({ id: t.id, title: t.name })),
      });
    }

    const genres = info.tags?.filter((t) => t.type === "genre");
    if (genres && genres.length > 0) {
      tagGroups.push({
        id: "genres",
        title: "Genres",
        tags: genres.map((g) => ({ id: g.id, title: g.name })),
      });
    }

    return {
      mangaId: mangaId,
      mangaInfo: {
        primaryTitle: info.title,
        secondaryTitles: info.alt_titles ? [info.alt_titles] : [],
        thumbnailUrl: info.cover
          ? `https://pika.mangacloud.org/${mangaId}/${info.cover.id}.${info.cover.f}`
          : "",
        synopsis: info.description || "",
        rating: 0,
        contentRating: ContentRating.EVERYONE,
        status: (info.status || "UNKNOWN") as
          | "ONGOING"
          | "COMPLETED"
          | "UNKNOWN",
        tagGroups,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const apiUrl = `https://api.mangacloud.org/comic/${mangaId}`;
    const request: Request = { url: apiUrl, method: "GET" };

    const [, data] = await Application.scheduleRequest(request);
    const jsonStr = Application.arrayBufferToUTF8String(data);
    const resp = JSON.parse(jsonStr) as ApiResponse<MangaInfo>;
    const info = resp.data;
    const chapters: Chapter[] = [];

    if (info.chapters && info.chapters.length > 0) {
      for (const ch of info.chapters) {
        chapters.push({
          chapterId: ch.id,
          title: ch.name || `${ch.number}`,
          sourceManga,
          chapNum: ch.number,
          publishDate: ch.created_date ? new Date(ch.created_date) : undefined,
          volume: 0,
          langCode: "en",
          version: "1",
        });
      }
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const apiUrl = `https://api.mangacloud.org/chapter/${chapter.chapterId}`;
    const request: Request = { url: apiUrl, method: "GET" };

    const [, data] = await Application.scheduleRequest(request);
    const jsonStr = Application.arrayBufferToUTF8String(data);
    const resp = JSON.parse(jsonStr) as ApiResponse<ChapterInfo>;
    const info = resp.data;

    const pages: string[] = [];
    if (info.images && info.images.length > 0) {
      for (const img of info.images) {
        pages.push(
          `https://pika.mangacloud.org/${info.comic_id}/${info.id}/${img.id}.${img.f}`
        );
      }
    }

    return {
      mangaId: chapter.sourceManga.mangaId,
      id: chapter.chapterId,
      pages,
    };
  }

  private async getPopularSectionItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = 1;
    const collectedIds: string[] = [];

    let apiUrl = `https://api.mangacloud.org/comic-popular-view/today`;
    if (page > 1) {
      apiUrl += `?page=${page}`;
    }

    const request: Request = {
      url: apiUrl,
      method: "GET",
    };

    const [, data] = await Application.scheduleRequest(request);
    const jsonStr = Application.arrayBufferToUTF8String(data);
    const resp = JSON.parse(jsonStr) as ApiResponse<MostViewedMangaResponse>;
    const list = resp.data?.list || [];

    const items: DiscoverSectionItem[] = [];

    for (const m of list) {
      const mangaId = m.id;
      if (!mangaId || collectedIds.includes(mangaId)) continue;
      collectedIds.push(mangaId);

      let coverUrl = "";
      if (m.cover) {
        coverUrl = `https://pika.mangacloud.org/${m.id}/${m.cover.id}.${m.cover.f}`;
      }

      items.push({
        type: "featuredCarouselItem",
        mangaId,
        imageUrl: coverUrl,
        title: m.title,
        supertitle: m.number !== undefined ? `Chapters: ${m.number}` : undefined,
        metadata: undefined,
      });
    }

    const hasNextPage = list.length > 0;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  private async getUpdatedSectionItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = 1;
    const collectedIds: string[] = [];

    const apiUrl = `https://api.mangacloud.org/comic-updates`;
    const request: Request = {
      url: apiUrl,
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "*/*" },
      body: JSON.stringify({ page }),
    };

    const [, data] = await Application.scheduleRequest(request);
    const jsonStr = Application.arrayBufferToUTF8String(data);
    const resp = JSON.parse(jsonStr) as ApiResponse<UpdatedMangaResponse>;
    const list = resp.data?.list || [];

    const items: DiscoverSectionItem[] = [];

    for (const m of list) {
      const mangaId = m.id;
      if (!mangaId || collectedIds.includes(mangaId)) continue;
      collectedIds.push(mangaId);

      let coverUrl = "";
      if (m.cover) {
        coverUrl = `https://pika.mangacloud.org/${m.id}/${m.cover.id}.${m.cover.f}`;
      }

      items.push({
        type: "chapterUpdatesCarouselItem",
        mangaId,
        chapterId: "",
        imageUrl: coverUrl,
        title: m.title,
        subtitle: m.chapters ? `${m.chapters.length} chapters` : undefined,
        metadata: undefined,
      });
    }

    const hasNextPage = list.length > 0;

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
    const [, data] = await Application.scheduleRequest(request);
    const htmlStr = Application.arrayBufferToUTF8String(data);
    const dom = htmlparser2.parseDocument(htmlStr);
    return cheerio.load(dom);
  }
}

export const Mangacloud = new MangacloudExtension();
