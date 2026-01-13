import {
  BasicRateLimiter,
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
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import * as htmlparser2 from "htmlparser2";
import { URLBuilder } from "../utils/url-builder/base";
import { ElftoonInterceptor } from "./interceptors";
import { ElftoonMetadata } from "./model";
import { error } from "console";

const baseUrl = "https://elftoon.com/";

type ElftoonImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  CloudflareBypassRequestProviding &
  DiscoverSectionProviding;

export class ElftoonExtension implements ElftoonImplementation {
  requestManager = new ElftoonInterceptor("main");
  cookieStorageInterceptor = new CookieStorageInterceptor({
    storage: "stateManager",
  });
  globalRateLimiter = new BasicRateLimiter("rateLimiter", {
    numberOfRequests: 4,
    bufferInterval: 1,
    ignoreImages: true,
  });
  // Add a small delay between paginated search requests to avoid CF/rate limits
  private readonly searchPageDelayMs = 700; // base delay in ms (converted to seconds for Application.sleep)

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
    this.globalRateLimiter.registerInterceptor();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "trending_section",
        title: "Trending",
        type: DiscoverSectionType.featured,
      },
      {
        id: "latest_updates_section",
        title: "Latest Updates",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular_section",
        title: "Popular",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getSearchFilters(): Promise<never[]> {
    return [];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: ElftoonMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "trending_section":
        return this.getTrendingSectionItems(metadata);
      case "latest_updates_section":
        return this.getLatestUpdatesSectionItems(metadata);
      case "popular_section":
        return this.getPopularSectionItems(metadata);
      default:
        return { items: [] };
    }
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: ElftoonMetadata | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.searchCollectedIds ?? [];
    const titleQuery = (query.title || "").trim();

    if (!titleQuery) {
      const listUrl = new URLBuilder(baseUrl)
        .addPath("manga")
        .addQuery("page", page.toString())
        .addQuery("order", "update")
        .build();
      const request = { url: listUrl, method: "GET" };
      const $ = await this.fetchCheerio(request);

      const items: SearchResultItem[] = [];
      const bsElems = $(".bs");
      bsElems.each((_, element) => {
        const unit = $(element);
        const titleLink = unit.find(".bsx a").first();
        const title = unit.find(".tt").text().trim();
        const href = titleLink.attr("href") || "";
        const mangaId = href
          .replace(baseUrl, "")
          .replace("manga/", "")
          .replace(/\/$/, "");

        const imgElem = unit.find(".limit img").first();
        let image = imgElem.attr("src") || imgElem.attr("data-src") || "";
        if (image && !image.startsWith("http")) {
          image = image.startsWith("/")
            ? `${baseUrl}${image.slice(1)}`
            : `${baseUrl}${image}`;
        }

        const latestChapter = unit.find(".epxs").first().text().trim();

        if (title && mangaId && !collectedIds.includes(mangaId)) {
          collectedIds.push(mangaId);
          items.push({
            mangaId,
            imageUrl: image,
            title,
            subtitle: latestChapter || undefined,
            metadata: undefined,
          });
        }
      });

      const hasNextPage = $(".pagination a.next, .hpage .r").length > 0;

      return {
        items,
        metadata: hasNextPage
          ? { page: page + 1, searchCollectedIds: collectedIds }
          : undefined,
      };
    }

    // Elftoon (Madara) uses path-style pagination: /page/{n}/?s=...&post_type=wp-manga
    const searchBuilder = new URLBuilder(baseUrl);
    if (page > 1) {
      searchBuilder.addPath("page").addPath(page.toString());
    }
    const searchUrl = searchBuilder
      .addQuery("s", titleQuery)
      .addQuery("post_type", "wp-manga")
      .build();

    const request = { url: searchUrl, method: "GET" };

    const $ = await this.fetchCheerio(request);
    const searchResults: SearchResultItem[] = [];
    const bsElems = $(".bs");
    bsElems.each((_, element) => {
      const unit = $(element);
      const titleLink = unit.find(".bsx a").first();
      const title = unit.find(".tt").text().trim();
      const href = titleLink.attr("href") || "";
      const mangaId = href
        .replace(baseUrl, "")
        .replace("manga/", "")
        .replace(/\/$/, "");

      const imgElem = unit.find(".limit img").first();
      let image = imgElem.attr("src") || imgElem.attr("data-src") || "";
      if (image && !image.startsWith("http")) {
        image = image.startsWith("/")
          ? `${baseUrl}${image.slice(1)}`
          : `${baseUrl}${image}`;
      }

      const latestChapter = unit.find(".epxs").first().text().trim();

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        searchResults.push({
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          subtitle: latestChapter || undefined,
          metadata: undefined,
        });
      }
    });

    if (searchResults.length === 0) {
      $(".c-tabs-item__content, .row.c-tabs-item, .utao.styletwo").each(
        (_, element) => {
          const unit = $(element);

          let titleLink = unit.find(".post-title a").first();
          if (!titleLink.length) {
            titleLink = unit.find("h3 a, h4 a, .luf h4, .tt a").first();
          }

          const title = titleLink.text().trim();
          const href = titleLink.attr("href") || "";

          if (href.includes("/manga/")) {
            const mangaId = href
              .replace(baseUrl, "")
              .replace("manga/", "")
              .replace(/\/$/, "");

            const imgElem = unit
              .find(".tab-thumb img, .c-image-content img, .imgu img, img")
              .first();
            let image = imgElem.attr("src") || imgElem.attr("data-src") || "";
            if (image && !image.startsWith("http")) {
              image = image.startsWith("/")
                ? `${baseUrl}${image.slice(1)}`
                : `${baseUrl}${image}`;
            }

            if (title && mangaId && !collectedIds.includes(mangaId)) {
              collectedIds.push(mangaId);
              searchResults.push({
                mangaId: mangaId,
                imageUrl: image,
                title: title,
                subtitle: undefined,
                metadata: undefined,
              });
            }
          }
        },
      );
    }

    // Detect next page via pagination markup
    const hasNextPage = $(".pagination a.next, .hpage .r").length > 0;

    return {
      items: searchResults,
      metadata: hasNextPage
        ? { page: page + 1, searchCollectedIds: collectedIds }
        : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = {
      url: new URLBuilder(baseUrl).addPath("manga").addPath(mangaId).build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    let title = $(".entry-title").first().text().trim();
    if (!title) {
      title = $("h1.entry-title").first().text().trim();
    }
    if (!title) {
      title = $("title").text().split(" - ")[0].trim();
    }

    const altTitles: string[] = [];
    $(".alternative").each((_, el) => {
      const text = $(el).text().trim();
      if (text) altTitles.push(text);
    });

    let image = "";
    const imageElem = $(".main-info .info-left .thumb img").first();
    image = imageElem.attr("src") || imageElem.attr("data-src") || "";
    if (image && !image.startsWith("http")) {
      image = image.startsWith("/")
        ? `${baseUrl}${image.slice(1)}`
        : `${baseUrl}${image}`;
    }

    const description = $(".entry-content p, .entry-content-single p")
      .map((_, el) => $(el).text().trim())
      .get()
      .join("\n")
      .trim();

    const authors: string[] = [];
    $(".tsinfo .imptdt").each((_, element) => {
      const text = $(element).text();
      if (text.includes("Posted By")) {
        const author = $(element).find("i").text().trim();
        if (author && author !== "hyyh gth") {
          authors.push(author);
        }
      }
    });

    let status = "Unknown";
    $(".tsinfo .imptdt").each((_, element) => {
      const text = $(element).text();
      if (text.includes("Status")) {
        status = $(element).find("i").text().trim() || "Unknown";
      }
    });

    const tags: TagSection[] = [];
    const genres: string[] = [];
    $(".wd-full .mgen a").each((_, element) => {
      const genre = $(element).text().trim();
      if (genre) genres.push(genre);
    });

    if (genres.length > 0) {
      tags.push({
        id: "genres",
        title: "Genres",
        tags: genres.map((genre) => ({
          id: genre.toLowerCase().replace(/\s+/g, "-"),
          title: genre,
        })),
      });
    }
    let rating = 0;
    const ratingValue = $(".rating .num").text().trim();
    if (ratingValue) {
      rating = parseFloat(ratingValue) || 0;
    }

    return {
      mangaId: mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: altTitles,
        thumbnailUrl: image,
        synopsis: description,
        rating: rating / 10,
        contentRating: ContentRating.MATURE,
        status: status,
        tagGroups: tags,
        shareUrl: new URLBuilder(baseUrl)
          .addPath("manga")
          .addPath(mangaId)
          .build(),
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;

    const pageRequest = {
      url: new URLBuilder(baseUrl).addPath("manga").addPath(mangaId).build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(pageRequest);
    const chapters: Chapter[] = [];
    $(".eplister ul li").each((_, element) => {
      const chapterElement = $(element);
      const chapterLink = chapterElement.find(".eph-num a").first();
      const href = chapterLink.attr("href") || "";

      const chapterNumText = chapterElement.find(".chapternum").text().trim();
      const chapterTitle = chapterNumText || chapterLink.text().trim();

      const chapterId =
        href
          .replace(baseUrl, "")
          .replace(/\/$/, "") || "";

      // Extract chapter number from the URL slug
      const chapterMatch = chapterId.match(/-chapter-(\d+)$/);
      const finalChapterId = chapterMatch ? `chapter-${chapterMatch[1]}` : chapterId;

      let chapNum = 0;
      const dataNum = chapterElement.attr("data-num");
      if (dataNum) {
        chapNum = parseFloat(dataNum);
      } else {
        const match = chapterTitle.match(/chapter[.\s-]*(\d+(?:\.\d+)?)/i);
        if (match) {
          chapNum = parseFloat(match[1]);
        }
      }

      const dateText = chapterElement.find(".chapterdate").text().trim();
      let publishDate: Date | undefined;
      if (dateText) {
        publishDate = new Date(dateText);
        if (isNaN(publishDate.getTime())) {
          const now = new Date();
          if (dateText.includes("ago")) {
            if (dateText.includes("minute")) {
              const minutes = parseInt(dateText.match(/\d+/)?.[0] || "0");
              publishDate = new Date(now.getTime() - minutes * 60000);
            } else if (dateText.includes("hour")) {
              const hours = parseInt(dateText.match(/\d+/)?.[0] || "0");
              publishDate = new Date(now.getTime() - hours * 3600000);
            } else if (dateText.includes("day")) {
              const days = parseInt(dateText.match(/\d+/)?.[0] || "0");
              publishDate = new Date(now.getTime() - days * 86400000);
            } else if (dateText.includes("week")) {
              const weeks = parseInt(dateText.match(/\d+/)?.[0] || "0");
              publishDate = new Date(now.getTime() - weeks * 604800000);
            }
          }
        }
      }

      if (chapterId && href) {
        chapters.push({
          chapterId: finalChapterId,
          sourceManga: sourceManga,
          title: chapterTitle,
          volume: 0,
          chapNum: chapNum,
          publishDate: publishDate,
          langCode: "🇬🇧",
        });
      }
    });

    return chapters.reverse();
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterUrl = new URLBuilder(baseUrl)
      .addPath(`${chapter.sourceManga.mangaId}-${chapter.chapterId}`)
      .build();

    const request = {
      url: chapterUrl,
      method: "GET",
    };

    const [, htmlData] = await Application.scheduleRequest(request);
    const htmlStr = Application.arrayBufferToUTF8String(htmlData);
    const pages: string[] = [];

    const readerScriptRegex = /ts_reader\.run\((\{[\s\S]*?\})\);<\/script>/;
    const readerMatch = htmlStr.match(readerScriptRegex);
    if (readerMatch) {
      try {
      const readerData = JSON.parse(readerMatch[1]) as {
        sources?: Array<{ source?: string; images?: string[] }>;
      };

      readerData.sources?.forEach(source => {
        source.images?.forEach(imageUrl => {
        if (
          typeof imageUrl === "string" &&
          imageUrl.startsWith("http") &&
          !imageUrl.includes("readerarea.svg")
        ) {
          pages.push(imageUrl);
        }
        });
      });
      } catch {
      throw new Error("Failed to parse chapter image data");
      }
    }

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages: [...new Set(pages)],
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}manga/${mangaId}`;
  }

  private generateChapterId(mangaId: string, chapterText: string): string {
    const cleanedChapterText = chapterText
      .toLowerCase()
      .replace(/[^a-z0-9\s.-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "");

    return cleanedChapterText;
  }

  private async getTrendingSectionItems(
    metadata: ElftoonMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: baseUrl,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    // Parse homepage slider/featured section
    $(".swiper-slide .mainslider").each((_, element) => {
      const unit = $(element);
      const titleLink = unit.find(".sliderinfolimit .name").first();
      const title = titleLink.text().trim();
      const href = titleLink.closest("a").attr("href") || "";
      const mangaId = href
        .replace(baseUrl, "")
        .replace("manga/", "")
        .replace(/\/$/, "");

      const imgElem = unit.find(".slidtrithumb img").first();
      let image = imgElem.attr("src") || imgElem.attr("data-src") || "";
      if (image && !image.startsWith("http")) {
        image = image.startsWith("/")
          ? `${baseUrl}${image.slice(1)}`
          : `${baseUrl}${image}`;
      }

      const latestChapter = unit.find(".slidlc").first().text().trim();

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push({
          type: "featuredCarouselItem",
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          supertitle: latestChapter || undefined,
          metadata: undefined,
        });
      }
    });

    return {
      items: items,
      metadata: undefined,
    };
  }

  private async getLatestUpdatesSectionItems(
    metadata: ElftoonMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    return this.getMangaListItems(
      metadata,
      "update",
      "chapterUpdatesCarouselItem",
    );
  }

  private async getPopularSectionItems(
    metadata: ElftoonMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    return this.getMangaListItems(metadata, "popular", "simpleCarouselItem");
  }

  private async getMangaListItems(
    metadata: ElftoonMetadata | undefined,
    orderType: "update" | "popular",
    itemType: "chapterUpdatesCarouselItem" | "simpleCarouselItem",
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("manga")
        .addQuery("page", page.toString())
        .addQuery("order", orderType)
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".bs").each((_, element) => {
      const unit = $(element);
      const titleLink = unit.find(".bsx a").first();
      const title = unit.find(".tt").text().trim();
      const href = titleLink.attr("href") || "";
      const mangaId = href
        .replace(baseUrl, "")
        .replace("manga/", "")
        .replace(/\/$/, "");

      const imgElem = unit.find(".limit img").first();
      let image = imgElem.attr("src") || imgElem.attr("data-src") || "";
      if (image && !image.startsWith("http")) {
        image = image.startsWith("/")
          ? `${baseUrl}${image.slice(1)}`
          : `${baseUrl}${image}`;
      }

      const latestChapter = unit.find(".epxs").first().text().trim();

      let chapterId = "";
      if (itemType === "chapterUpdatesCarouselItem" && latestChapter) {
        chapterId = this.generateChapterId(mangaId, latestChapter);
      }

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);

        if (itemType === "chapterUpdatesCarouselItem" && chapterId) {
          items.push({
            type: "chapterUpdatesCarouselItem",
            mangaId: mangaId,
            chapterId: chapterId,
            imageUrl: image,
            title: title,
            subtitle: latestChapter || undefined,
            metadata: undefined,
          });
        } else {
          items.push({
            type: "simpleCarouselItem",
            mangaId: mangaId,
            imageUrl: image,
            title: title,
            subtitle: latestChapter || undefined,
            metadata: undefined,
          });
        }

        collectedIds.push(mangaId);
      }
    });

    const hasNextPage = $(".hpage .r").length > 0;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    for (const cookie of cookies) {
      this.cookieStorageInterceptor.deleteCookie(cookie);
    }

    for (const cookie of cookies) {
      this.cookieStorageInterceptor.setCookie(cookie);
    }
  }

  async checkCloudflareStatus(status: number): Promise<void> {
    console.log(this.cookieStorageInterceptor.cookies);
    switch (status) {
      case 503:
      case 403:
        console.log(`Cloudflare protection detected. Status: ${status}`);
        throw new CloudflareError(
          {
            url: baseUrl,
            method: "GET",
            headers: {
              referer: baseUrl,
              origin: baseUrl,
            },
          },
          "Cloudflare bypass required, please complete the challenge.",
        );
      case 404:
        throw new Error("Content not found");
    }
  }

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const [response, data] = await Application.scheduleRequest(request);
    await this.checkCloudflareStatus(response.status);
    const htmlStr = Application.arrayBufferToUTF8String(data);
    const dom = htmlparser2.parseDocument(htmlStr);
    return cheerio.load(dom);
  }
}

export const Elftoon = new ElftoonExtension();
