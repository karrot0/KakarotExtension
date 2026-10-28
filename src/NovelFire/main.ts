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

// Accepts "/book/slug", "/novel/slug/chapter-1" or a full URL on any mirror domain
// and returns just "slug" or "slug/chapter-1".
function toId(href: string): string {
  const match = href.match(/\/(?:book|novel)\/([^?#]+)/);
  return (match?.[1] ?? href).replace(/^\/+|\/+$/g, "");
}

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
      const mangaId = toId(url);
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
    const chapters: Chapter[] = [];
    let page = 1;

    while (true) {
      const request = {
        url: new URLBuilder(baseUrl)
          .addPath("book")
          .addPath(mangaId)
          .addPath("chapters")
          .addQuery("page", String(page))
          .build(),
        method: "GET",
      };

      const $ = await this.fetchCheerio(request);
      const items = $(".chapter-list li");
      if (items.length === 0) break;

      items.each((_, el) => {
        const li = $(el);
        const a = li.find("a");
        const url = String(a.attr("href")) || "";
        const title = String(a.attr("title")) || a.text().trim();
        const chapterNo =
          parseFloat(String(a.find(".chapter-no").text()).trim()) || undefined;
        const createdAt = String(a.find("time").attr("datetime"));
        const chapterId = (url.split("/book/")[1] || url).split(/[?#]/)[0] ?? url;
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

      const hasNextPage = !!$(".pagination .page-item.active + .page-item").length;
      if (!hasNextPage) break;
      page++;
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<NovelChapter> {
    let url = new URLBuilder(baseUrl)
      .addPath("book")
      .addPath(chapter.chapterId)
      .build();

    const trail: string[] = [];

    // The site may answer with a redirect page (meta refresh / JS) pointing to a mirror
    // domain that has the real text, so follow up to 3 hops.
    for (let hop = 0; hop < 3; hop++) {
      const page = await this.fetchPage({ url, method: "GET" });
      const content = this.extractChapterText(page.$);

      if (content !== "") {
        const html = `<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>${content}</body></html>`;
        return {
          mangaId: chapter.sourceManga.mangaId,
          id: chapter.chapterId,
          type: "html",
          html,
        };
      }

    const $ = await this.fetchCheerio(request);

    // Strip ads, scripts and site chrome that can end up inside the content node
    $(".nf-ads, .ads, .adsbygoogle, script, style, iframe, ins, noscript").remove();

    // The content container has changed names over time, so try a few
    const selectors = ["#content", "#chapter-container", ".chapter-content", "#chapter-content", ".chapter-body"];
    let content = "";
    for (const selector of selectors) {
      const node = $(selector).first();
      if (node.length === 0) continue;
      const inner = (node.html() ?? "").trim();
      if (node.text().trim().length > 0 && inner.length > 0) {
        content = inner;
        break;
      }
    }

    // Last resort: collect every non-empty paragraph on the page
    if (content === "") {
      content = $("p")
        .map((_, el) => ($(el).text().trim() ? $.html(el) : ""))
        .toArray()
        .join("");
    }

    content = content.replace(/&nbsp;/g, " ").trim();

    // Throw instead of returning an empty page so the reader shows an error, not a blank screen
    if (content === "") {
      throw new Error(
        `NovelFire: no chapter text found at ${request.url}. The site layout may have changed or the request was blocked.`,
      );
    }

    const html = `<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>${content}</body></html>`;

  extractChapterText($: CheerioAPI): string {
    $(".nf-ads, .ads, .adsbygoogle, script, style, iframe, ins, noscript").remove();

    for (const selector of ["#content", ".chapter-content", "#chapter-content", ".chapter-body"]) {
      const node = $(selector).first();
      if (node.length === 0 || node.text().trim() === "") continue;
      return (node.html() ?? "").replace(/&nbsp;/g, " ").trim();
    }
    return "";
  }

  findRedirectTarget($: CheerioAPI, html: string, currentUrl: string): string | undefined {
    const refresh = $("meta[http-equiv]")
      .filter((_, el) => ($(el).attr("http-equiv") ?? "").toLowerCase() === "refresh")
      .attr("content");
    const fromMeta = refresh?.match(/url\s*=\s*['"]?([^'";\s]+)/i)?.[1];
    const fromScript = html.match(
      /(?:window\.|document\.|top\.)?location(?:\.href)?\s*(?:=|\.replace\(|\.assign\()\s*['"]([^'"]+)['"]/,
    )?.[1];

    const target = fromMeta ?? fromScript;
    if (!target || target.startsWith("#") || target.startsWith("javascript:")) return undefined;
    if (/^https?:\/\//i.test(target)) return target;

    const origin = currentUrl.match(/^(https?:\/\/[^/]+)/i)?.[1] ?? baseUrl;
    return target.startsWith("/") ? `${origin}${target}` : `${origin}/${target}`;
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

      const mangaId = toId(url);

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

      const mangaId = toId(url);

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

      const mangaId = toId(url);

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

  async fetchPage(request: Request): Promise<{
    $: CheerioAPI;
    html: string;
    finalUrl: string;
    status: number;
  }> {
    const [response, data] = await Application.scheduleRequest(request);
    this.checkCloudflareStatus(response.status);
    const html = Application.arrayBufferToUTF8String(data);
    const dom = htmlparser2.parseDocument(html);
    return {
      $: cheerio.load(dom),
      html,
      finalUrl: response.url || request.url,
      status: response.status,
    };
  }

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const [response, data] = await Application.scheduleRequest(request);
    this.checkCloudflareStatus(response.status);
    const htmlStr = Application.arrayBufferToUTF8String(data);
    const dom = htmlparser2.parseDocument(htmlStr);
    return cheerio.load(dom);
  }
}

export const NovelFire = new NovelFireExtension();
