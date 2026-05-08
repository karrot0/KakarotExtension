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
import { BuddyMetadata } from "./Mangabuddy";
import { BuddyInterceptor } from "./MangabuddyInterceptor";

const baseUrl = "https://mangabuddy.com";

type BuddyImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  CloudflareBypassRequestProviding &
  DiscoverSectionProviding;

export class MangabuddyExtension implements BuddyImplementation {
  requestManager = new BuddyInterceptor("main");
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
      const mangaId = link.attr("href")?.substring(1) || "";
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
    // Expected mangaId: jun-and-wang-xin
    // URL format: https://mangabuddy.com/jun-and-wang-xin
    const request = {
      url: `${baseUrl}/${mangaId}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    const title = $("h1").text().trim();
    const altTitles = $("h2").text().trim().split(" • ");
    const image =
      $(".img-cover img").attr("data-src") ||
      $(".img-cover img").attr("src") ||
      "";
    const description = $("p.content").text().trim();
    let rating = 1;
    const ratingText = $(".rate-view .rating").text().trim();
    if (ratingText) {
      rating = parseFloat(ratingText);
    }

    let status = "UNKNOWN";
    const statusText = $("p strong:contains('Status')")
      .next("a")
      .text()
      .toLowerCase();
    if (statusText.includes("ongoing")) {
      status = "ONGOING";
    } else if (statusText.includes("completed")) {
      status = "COMPLETED";
    }

    const tags: TagSection[] = [];
    const genres: string[] = [];
    $("p strong:contains('Genres')")
      .parent()
      .find("a")
      .each((_, element) => {
        const genre = $(element).text().trim().replace(/,\s*$/, "");
        if (genre) {
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
      mangaId: mangaId,
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
    // Expected mangaId: my-furry-harem-is-after-me

    const request = {
      url: `${baseUrl}/api/manga/${sourceManga.mangaId}/chapters?source=detail`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const chapters: Chapter[] = [];

    
    $(".chapter-list li").each((_, element) => {
      const li = $(element);
      const link = li.find("a");
      const chapterUrl = link.attr("href") || "";

      const chapterMatch = chapterUrl.match(/chapter-(\d+(\.\d+)?)/i);
      const chapterNumber =
        chapterMatch && !isNaN(Number(chapterMatch[1]))
          ? Number(chapterMatch[1])
          : null;

      const parts = chapterUrl.split("/").filter(Boolean);
      const chapterId = parts.length > 0 ? parts[parts.length - 1] : "0";
      

      const chapterTitle = link.find(".chapter-title").text().trim();

      const dateText = link.find("time.chapter-update").text().trim();

      chapters.push({
        chapterId: chapterId,
        title: chapterTitle,
        sourceManga,
        chapNum: chapterNumber,
        publishDate: dateText
          ? new Date(convertToISO8601(dateText))
          : undefined,
        volume: undefined,
        langCode: "🇬🇧",
      });
    });

    for (let i=0;i<chapters.length;i++){
      if (chapters[i].chapNum != null) continue;
      let prevIdx=i-1; while(prevIdx>=0 && chapters[prevIdx].chapNum==null) prevIdx--;
      const prevNum = prevIdx>=0?chapters[prevIdx].chapNum:null;
      let nextIdx=i+1; while(nextIdx<chapters.length && chapters[nextIdx].chapNum==null) nextIdx++;
      const nextNum = nextIdx<chapters.length?chapters[nextIdx].chapNum:null;
      const runStart=i; let runEnd=i; while(runEnd+1<chapters.length && chapters[runEnd+1].chapNum==null) runEnd++; const runCount = runEnd-runStart+1;
      if (prevNum!=null && nextNum!=null && prevNum>nextNum){
        const gap = prevNum - nextNum;
        const step = Math.max(gap/(runCount+1), 0.001);
        for (let j=0;j<runCount;j++){
          const assigned = prevNum - (j+1)*step;
          chapters[runStart+j].chapNum = Number(assigned.toFixed(2));
        }
      } else if (prevNum!=null){
        for (let j=0;j<runCount;j++) chapters[runStart+j].chapNum = Number((prevNum - (j+1)*0.001).toFixed(2));
      } else if (nextNum!=null){
        for (let j=0;j<runCount;j++) chapters[runStart+j].chapNum = Number((nextNum + (runCount - j)*0.001).toFixed(2));
      } else {
        for (let j=0;j<runCount;j++) chapters[runStart+j].chapNum = Number((runCount - j).toFixed(2));
      }
      i = runEnd;
    }

    return chapters;
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
    return `${baseUrl}/${mangaId}`;
  }

  async getUpdatedSectionItems(
    _section: DiscoverSection,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

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
      const mangaId = link.attr("href")?.substring(1) || "";
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
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const request = {
      url: `${baseUrl}/home`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".top-item").each((_, element) => {
      const unit = $(element);
      const title = unit.find(".meta .title a").text().trim();
      const image =
        unit.find("img").first().attr("data-src") ||
        unit.find("img").first().attr("src") ||
        "";
      const mangaId = unit.find(".thumb a").attr("href")?.substring(1) || "";

      const latestChapter = unit.find(".chap-item a").text().trim();
      const chapterMatch = latestChapter.match(/Chapter (\d+)/i);
      const supertitle = chapterMatch ? `Ch. ${chapterMatch[1]}` : "";

      if (title && mangaId) {
        items.push({
          type: "featuredCarouselItem",
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          supertitle: supertitle,
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
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

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
      const mangaId = link.attr("href")?.substring(1) || "";
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

function convertToISO8601(dateText: string): string {
  const now = new Date();

  if (!dateText?.trim()) return now.toISOString();

  if (/^yesterday$/i.test(dateText)) {
    now.setDate(now.getDate() - 1);
    return now.toISOString();
  }

  const relativeMatch = dateText.match(
    /(\d+)\s+(second|minute|hour|day)s?\s+ago/i,
  );
  if (relativeMatch) {
    const [_, value, unit] = relativeMatch;
    switch (unit.toLowerCase()) {
      case "second":
        now.setSeconds(now.getSeconds() - +value);
        break;
      case "minute":
        now.setMinutes(now.getMinutes() - +value);
        break;
      case "hour":
        now.setHours(now.getHours() - +value);
        break;
      case "day":
        now.setDate(now.getDate() - +value);
        break;
    }
    return now.toISOString();
  }

  const parsedDate = new Date(dateText);
  return isNaN(parsedDate.getTime())
    ? now.toISOString()
    : parsedDate.toISOString();
}

export const Mangabuddy = new MangabuddyExtension();
