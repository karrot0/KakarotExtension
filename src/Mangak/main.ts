import {
  AdvancedSearchForm,
  BasicRateLimiter,
  Metadata,
  Chapter,
  ChapterDetails,
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
  PagedResults,
  Request,
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SourceManga,
  TagSection,
} from "@paperback/types";
import { MangabuddySearchForm, type BuddySearchMetadata } from "./forms/SearchForm";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import * as htmlparser2 from "htmlparser2";
import { URLBuilder } from "../utils/url-builder/base";
import { MangakMetadata } from "./Mangak";
import { MangakInterceptor } from "./MangakInterceptor";

const baseUrl = "https://mangak.io";

type BuddyImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  CloudflareBypassRequestProviding &
  DiscoverSectionProviding;

export class MangakExtension implements BuddyImplementation {
  requestManager = new MangakInterceptor("main");
  globalRateLimiter = new BasicRateLimiter("rateLimiter", {
    numberOfRequests: 5,
    bufferInterval: 1,
    ignoreImages: true,
  });
  cookieStorageInterceptor = new CookieStorageInterceptor({
    storage: "stateManager",
  });

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.globalRateLimiter.registerInterceptor();
    this.requestManager?.registerInterceptor();
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
        id: "new_manga_section",
        title: "New Manga",
        type: DiscoverSectionType.simpleCarousel,
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
      case "new_manga_section":
        return this.getNewMangaSectionItems(section);
      default:
        return { items: [] };
    }
  }

  async getAdvancedSearchForm(query: SearchQuery<Metadata>): Promise<AdvancedSearchForm> {
    const meta = (query.metadata as { searchMeta?: BuddySearchMetadata } | undefined)?.searchMeta;
    return new MangabuddySearchForm(meta);
  }

  async getSearchResults(
    query: SearchQuery<Metadata>,
    metadata: { page?: number } | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;

    const searchMeta = (query.metadata as { searchMeta?: BuddySearchMetadata } | undefined)?.searchMeta;

    const searchUrl = new URLBuilder(baseUrl)
      .addPath("search")
      .addQuery("q", query.title)
      .addQuery("page", page.toString());

    const genreIncluded = searchMeta?.genreIncluded ?? [];
    const genreExcluded = new Set(searchMeta?.genreExcluded ?? []);
    const status = searchMeta?.status ?? "all";
    const orderby = searchMeta?.orderby ?? "views";

    for (const id of genreIncluded) {
      searchUrl.addQuery("genre[]", id);
    }

    if (status && status !== "all") {
      searchUrl.addQuery("status", status);
    }

    searchUrl.addQuery("sort", orderby);

    const request = { url: searchUrl.build(), method: "GET" };

    const $ = await this.fetchCheerio(request);
    const searchResults: SearchResultItem[] = [];

    $(".list.manga-list .book-detailed-item").each((_, element) => {
      const item = $(element);
      const link = item.find(".meta .title h3 a");
      const title = link.text().trim();
      const image =
        item.find(".thumb img").attr("data-src") ||
        item.find(".thumb img").attr("src") ||
        "";
      const mangaId = normalizeMangaId(link.attr("href"));
      const latestChapter = item.find(".thumb .latest-chapter").text().trim();
      const chapterMatch = latestChapter.match(/Chapter (\d+)/i);
      const subtitle = chapterMatch ? `Ch. ${chapterMatch[1]}` : undefined;

      if (genreExcluded.size > 0) {
        const itemGenres: string[] = [];
        item.find(".meta .genres span").each((_, el) => {
          const genre = $(el).text().trim();
          if (genre) itemGenres.push(genre.toLowerCase().replace(/\s+/g, "-"));
        });
        if (itemGenres.some((g) => genreExcluded.has(g))) return;
      }

      if (title && mangaId) {
        searchResults.push({
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          subtitle: subtitle,
        });
      }
    });

    const hasNextPage = !!$(".paginator .btn.link").not(".active").length;

    return {
      items: searchResults,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    // Expected mangaId: eternally-regressing-knight
    // URL format: https://mangak.io/eternally-regressing-knight
    const normalizedMangaId = normalizeMangaId(mangaId);
    const request = {
      url: `https://mangak.io/${normalizedMangaId}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    const detailRoot = $("h1").first().closest("div.flex-1");

    const title = detailRoot.find("h1").first().text().trim() || $("h1").first().text().trim();

    const image =
      $("img[alt='" + title.replace(/'/g, "\\'") + "']").first().attr("src") ||
      $("img[alt='" + title.replace(/'/g, "\\'") + "']").first().attr("data-src") ||
      $("meta[property='og:image']").attr("content") ||
      "";

    const summaryText =
      detailRoot.find("p.line-clamp-3").first().text().trim() ||
      detailRoot.find("div.max-w p").first().text().trim() ||
      $("meta[property='og:description']").attr("content") ||
      "";

    const altTitles = summaryText
      .split(/\s*\/\s*|\s*•\s*/)
      .map((text) => text.trim())
      .filter((text) => text.length > 0 && text.toLowerCase() !== title.toLowerCase());

    const description = summaryText;

    let rating = 1;
    const ratingText =
      detailRoot.find(".tabular-nums").first().text().trim() ||
      detailRoot.text().match(/★\s*(\d+(?:\.\d+)?)/)?.[1] ||
      "";
    if (ratingText) {
      rating = parseFloat(ratingText);
    }

    let status = "UNKNOWN";
    const statusText = detailRoot.find(".status-pill").first().text().trim().toLowerCase();
    if (statusText.includes("ongoing")) {
      status = "ONGOING";
    } else if (statusText.includes("completed")) {
      status = "COMPLETED";
    }

    const tags: TagSection[] = [];
    const genres: string[] = [];
    detailRoot.find("a[href^='/genres/']").each((_, element) => {
      const genre = $(element).text().trim().replace(/,\s*$/, "");
      if (genre && !genres.includes(genre)) {
        genres.push(genre);
      }
    });

    if (genres.length > 0) {
      tags.push({
        id: "genres",
        title: "Genres",
        tags: genres.map((genre) => ({
          id: genre
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, ""),
          title: genre,
        })),
      });
    }

    return {
      mangaId: normalizedMangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: altTitles,
        thumbnailUrl: image,
        synopsis: description,
        rating: rating,
        contentRating: ContentRating.EVERYONE,
        status: status as "ONGOING" | "COMPLETED" | "UNKNOWN",
        tagGroups: tags,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const $ = await this.fetchCheerio({
      url: `${baseUrl}/${sourceManga.mangaId}`,
      method: "GET",
    });

    const nextDataText = $("#__NEXT_DATA__").html() || "{}";
    let internalId: string;
    try {
      const nextData = JSON.parse(nextDataText);
      internalId = nextData?.props?.pageProps?.initialManga?.id;
      if (!internalId) throw new Error("missing id");
    } catch {
      throw new Error(`Could not extract internal manga ID for ${sourceManga.mangaId}`);
    }

    const [response, data] = await Application.scheduleRequest({
      url: `https://api.mangak.io/titles/${internalId}/chapters`,
      method: "GET",
    });
    this.checkCloudflareStatus(response.status);

    const json = JSON.parse(Application.arrayBufferToUTF8String(data));
    if (!json.success || !Array.isArray(json.data?.chapters)) return [];

    return json.data.chapters.map((ch: {
      slug: string;
      name: string;
      updated_at: string;
      chapter_number: number;
    }, index: number): Chapter => {
      const nameMatch = ch.name?.match(/(\d+(?:\.\d+)?)/);
      const chapNum = nameMatch ? Number(nameMatch[1]) : (ch.chapter_number ?? index + 1);
      return {
        chapterId: ch.slug,
        title: ch.name ?? "",
        sourceManga,
        chapNum,
        publishDate: ch.updated_at ? new Date(ch.updated_at) : undefined,
        volume: undefined,
        langCode: "🇬🇧",
      };
    });
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterUrl = `${baseUrl}/${chapter.sourceManga.mangaId}/${chapter.chapterId}`;
    console.log(`Parsing chapter ${chapterUrl}`);

    try {
      const request: Request = { url: chapterUrl, method: "GET" };
      const $ = await this.fetchCheerio(request);

      const pages: string[] = [];

      const scriptContent = $('script:contains("var chapImages")').html() || "";
      const match = scriptContent.match(/var\s+chapImages\s*=\s*'([^']+)'/);

      if (match) {
        pages.push(...match[1].split(","));
      } else {
        console.error("Chapter images not found in script");
      }

      return {
        mangaId: chapter.sourceManga.mangaId,
        id: chapter.chapterId,
        pages: pages,
      };
    } catch (error) {
      console.error("Error fetching chapter details:", error);
      throw error;
    }
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/${normalizeMangaId(mangaId)}`;
  }

  async getUpdatedSectionItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = 1;
    const collectedIds: string[] = [];

    const request = {
      url: `${baseUrl}/latest?page=${page}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".list.manga-list .book-detailed-item").each((_, element) => {
      const unit = $(element);
      const link = unit.find(".meta .title h3 a");
      const title = link.text().trim();
      const image =
        unit.find(".thumb img").attr("data-src") ||
        unit.find(".thumb img").attr("src") ||
        "";
      const mangaId = normalizeMangaId(link.attr("href"));
      const latestChapter = unit.find(".thumb .latest-chapter").text().trim();
      const chapterMatch = latestChapter.match(/Chapter (\d+)/i);
      const subtitle = chapterMatch ? `Ch. ${chapterMatch[1]}` : undefined;
      const chapterId = unit.find(".chapter-link").attr("data-id") || "0";

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push({
          type: "chapterUpdatesCarouselItem",
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          subtitle: subtitle,
          chapterId: chapterId,
          metadata: undefined,
        });
      }
    });

    const hasNextPage = !!$(".paginator .btn.link").not(".active").length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getPopularSectionItems(
    /* eslint-disable @typescript-eslint/no-unused-vars */
    section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = 1;
    const collectedIds: string[] = [];
    

    const request = {
      url: `${baseUrl}/top/day`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    const elements = $(".top-item").length ? $(".top-item") : $("article.group, .group");

    elements.each((_, element) => {
      const unit = $(element);

      const image =
        unit.find("img").first().attr("data-src") ||
        unit.find("img").first().attr("src") ||
        "";

      const hrefAnchor =
        unit.find("a[aria-label]").first().attr("href") ||
        unit.find("a[title]").first().attr("href") ||
        unit.find("a").first().attr("href") ||
        "";

      const mangaId = normalizeMangaId(hrefAnchor);

      const title =
        (unit.find("a[title]").first().attr("title") as string) ||
        unit.find(".meta .title a").text().trim() ||
        unit.find("a > span").first().text().trim() ||
        (unit.find("img").first().attr("alt") || "").toString();

      const latestChapter =
        unit.find('a[href*="/chapter"]').first().text().trim() ||
        unit.find('a[href*="/notice"]').first().text().trim() ||
        unit.find('.thumb .latest-chapter').text().trim() ||
        "";

      const views =
        unit.find('span[title="Views"] .tabular-nums').first().text().trim() ||
        unit.find('span[title="Views"] span').last().text().trim() ||
        "";

      const chapterMatch = latestChapter.match(/Chapter\s*([0-9]+(?:\.[0-9]+)?)/i);
      const supertitle = views || (chapterMatch ? `Ch. ${chapterMatch[1]}` : (latestChapter || ""));

      if (title && mangaId) {
        items.push({
          type: "featuredCarouselItem",
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          supertitle: supertitle || undefined,
          metadata: undefined,
        });
      }
    });

    return {
      items: items,
      metadata: undefined,
    };
  }

  async getNewMangaSectionItems(
    section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = 1;
    const collectedIds: string[] = [];

    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("search")
        .addQuery("status", "all")
        .addQuery("sort", "created_at")
        .addQuery("q", "")
        .addQuery("page", page.toString())
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".list.manga-list .book-detailed-item").each((_, element) => {
      const item = $(element);
      const link = item.find(".meta .title h3 a");
      const title = link.text().trim();
      const image =
        item.find(".thumb img").attr("data-src") ||
        item.find(".thumb img").attr("src") ||
        "";
      const mangaId = normalizeMangaId(link.attr("href"));
      const latestChapter = item.find(".thumb .latest-chapter").text().trim();
      const chapterMatch = latestChapter.match(/Chapter (\d+)/i);
      const subtitle = chapterMatch ? `Ch. ${chapterMatch[1]}` : undefined;

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            image: image,
            title: title,
            subtitle: subtitle,
            type: "simpleCarouselItem",
          }),
        );
      }
    });

    const hasNextPage = !!$(".paginator .btn.link").not(".active").length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    for (const cookie of this.cookieStorageInterceptor.cookies) {
      this.cookieStorageInterceptor.deleteCookie(cookie);
    }
    for (const cookie of cookies) {
      if (cookie.expires && cookie.expires.getTime() <= Date.now()) {
        continue;
      }
      this.cookieStorageInterceptor.setCookie(cookie);
    }
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
}

function createDiscoverSectionItem(options: {
  id: string;
  image: string;
  title: string;
  subtitle?: string;
  type: "simpleCarouselItem";
}): DiscoverSectionItem {
  return {
    type: options.type,
    mangaId: options.id,
    imageUrl: options.image,
    title: options.title,
    subtitle: options.subtitle,
    metadata: undefined,
  };
}

function normalizeMangaId(hrefOrId: string | undefined): string {
  if (!hrefOrId) return "";

  try {
    const parsedUrl = new URL(hrefOrId, baseUrl);
    return parsedUrl.pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    return hrefOrId
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/^\/+|\/+$/g, "");
  }
}


export const Mangak = new MangakExtension();
