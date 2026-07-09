import {
  BasicRateLimiter,
  Chapter,
  ChapterDetails,
  ChapterProviding,
  Cookie,
  CookieStorageInterceptor,
  CloudflareBypassRequestProviding,
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
  SourceManga,
  TagSection,
} from "@paperback/types";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import { ZipComicInterceptor } from "./interceptors";
import { Metadata } from "./model";

const baseUrl = "https://www.zipcomic.com";

type ZipComicImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  CloudflareBypassRequestProviding &
  DiscoverSectionProviding;

function toId(href: string): string {
  return href.replace(/^\//, "").replace(/\/$/, "").trim();
}

function absolute(url: string): string {
  if (!url) return "";
  return url.startsWith("http") ? url : `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

export class ZipComicExtension implements ZipComicImplementation {
  requestManager = new ZipComicInterceptor("main");
  cookieStorageInterceptor = new CookieStorageInterceptor({
    storage: "stateManager",
  });
  imageRateLimiter = new BasicRateLimiter("imageRateLimiter", {
    numberOfRequests: 4,
    bufferInterval: 1,
    ignoreImages: false,
  });

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
    this.imageRateLimiter.registerInterceptor();
    await this.syncWebViewUserAgent();
  }

  private async syncWebViewUserAgent(): Promise<void> {
    try {
      const { result } = await Application.executeInWebView({
        source: {
          html: "<!doctype html><html><head></head><body></body></html>",
          baseUrl: `${baseUrl}/`,
          loadCSS: false,
          loadImages: false,
        },
        inject: "return navigator.userAgent;",
        storage: { cookies: [] },
      });
      if (typeof result === "string" && result.trim()) {
        this.requestManager.setUserAgent(result.trim());
      }
    } catch {
    }
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "latest",
        title: "Latest Updates",
        type: DiscoverSectionType.featured,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    _metadata: Metadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    if (section.id !== "latest") return { items: [] };

    const $ = await this.fetchCheerio({ url: `${baseUrl}/`, method: "GET" });
    const items: DiscoverSectionItem[] = this.parseCards($).map((c) => ({
      type: "featuredCarouselItem",
      mangaId: c.mangaId,
      imageUrl: c.imageUrl,
      title: c.title,
      metadata: undefined,
    }));
    return { items };
  }

  private parseCards(
    $: CheerioAPI,
  ): { mangaId: string; title: string; imageUrl: string }[] {
    const results: { mangaId: string; title: string; imageUrl: string }[] = [];
    const seen = new Set<string>();
    $("img.img-responsive").each((_, element) => {
      const img = $(element);
      const src = img.attr("src") ?? "";
      if (!src.includes("/img/")) return;

      const anchor = img.closest("a");
      const href = anchor.attr("href") ?? "";
      const mangaId = toId(href);
      if (
        !mangaId ||
        mangaId.includes("/") ||
        mangaId.startsWith("genre") ||
        mangaId.includes("-issue-") ||
        seen.has(mangaId)
      ) {
        return;
      }
      seen.add(mangaId);
      results.push({
        mangaId,
        title: img.attr("alt")?.trim() || mangaId,
        imageUrl: absolute(src),
      });
    });
    return results;
  }

  private hasNextPage($: CheerioAPI, page: number): boolean {
    const nextRe = new RegExp(`[?&]p=${page + 1}(?:&|$)`);
    return $(".pagination a")
      .toArray()
      .some((a) => nextRe.test($(a).attr("href") ?? ""));
  }

  async getSearchResults(
    query: SearchQuery<Metadata>,
    metadata: Metadata | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const title = (query.title ?? "").trim();
    const page = metadata?.page ?? 1;
    const $ = await this.fetchCheerio({
      url: `${baseUrl}/search?kwd=${encodeURIComponent(title)}&p=${page}`,
      method: "GET",
    });

    const items: SearchResultItem[] = this.parseCards($).map((c) => ({
      mangaId: c.mangaId,
      title: c.title,
      imageUrl: c.imageUrl,
    }));

    return {
      items,
      metadata: this.hasNextPage($, page) ? { page: page + 1 } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const $ = await this.fetchCheerio({
      url: `${baseUrl}/${mangaId}`,
      method: "GET",
    });

    const title = $("h1").first().text().trim() || mangaId;
    const image = absolute($("img[src*='cover']").first().attr("src") ?? "");

    const info: Record<string, { text: string; links: string[] }> = {};
    $("strong.text-success").each((_, el) => {
      const label = $(el).text().replace(":", "").trim().toLowerCase();
      const container = $(el).parent();
      const text = container
        .text()
        .replace($(el).text(), "")
        .replace(/\s+/g, " ")
        .trim();
      const links = container
        .find("a")
        .toArray()
        .map((a) => $(a).text().trim())
        .filter(Boolean);
      info[label] = { text, links };
    });

    const statusText = (info["status"]?.text ?? "").toLowerCase();
    const status = statusText.includes("ongoing")
      ? "ONGOING"
      : statusText.includes("complete")
        ? "COMPLETED"
        : "UNKNOWN";

    const genres = info["genre"]?.links ?? [];
    const tagGroups: TagSection[] =
      genres.length > 0
        ? [
            {
              id: "genres",
              title: "Genres",
              tags: genres.map((g) => ({
                id: g.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                title: g,
              })),
            },
          ]
        : [];

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl: image,
        synopsis: "",
        author: info["author"]?.text ?? "",
        artist: info["artis"]?.text ?? "",
        rating: 0,
        contentRating: genres.some((g) => /mature/i.test(g))
          ? ContentRating.MATURE
          : ContentRating.EVERYONE,
        status,
        tagGroups,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const $ = await this.fetchCheerio({
      url: `${baseUrl}/${sourceManga.mangaId}`,
      method: "GET",
    });

    const chapters: Chapter[] = [];
    $("table tr").each((_, element) => {
      const row = $(element);
      const link = row.find("a[href*='-issue-']").first();
      const href = link.attr("href") ?? "";
      if (!href) return;

      const chapterId = toId(href);
      const chapterTitle = link.text().replace(/\s+/g, " ").trim();

      const order = parseInt(row.find("td").first().text().trim(), 10) || 0;
      const numMatch =
        chapterTitle.match(/#\s*([\d.]+)/) ||
        chapterTitle.match(/([\d.]+)\s*$/);
      const chapNum = numMatch ? parseFloat(numMatch[1]) : order;

      chapters.push({
        chapterId,
        title: chapterTitle,
        sourceManga,
        chapNum,
        sortingIndex: order,
        volume: 0,
        langCode: "🇬🇧",
      });
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const $ = await this.fetchCheerio({
      url: `${baseUrl}/${chapter.chapterId}`,
      method: "GET",
    });

    const pages: string[] = [];
    $("#images img").each((_, element) => {
      const url = ($(element).attr("src") ?? "").trim();
      if (url) pages.push(url);
    });

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/${mangaId}`;
  }

  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    this.persistCookies(cookies);
  }

  async cloudflareBypassCompleted(
    _request: globalThis.Request,
    cookies: Cookie[],
    _localStorage: Record<string, string>,
  ): Promise<void> {
    this.persistCookies(cookies);
  }

  private persistCookies(cookies: Cookie[]): void {
    for (const cookie of this.cookieStorageInterceptor.cookies) {
      this.cookieStorageInterceptor.deleteCookie(cookie);
    }
    for (const cookie of cookies) {
      if (cookie.expires && cookie.expires.getTime() <= Date.now()) continue;
      this.cookieStorageInterceptor.setCookie(cookie);
    }
  }

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const { status, body } = await this.webViewFetch(
      request.url,
      request.method ?? "GET",
      typeof request.body === "string" ? request.body : undefined,
    );
    this.checkCloudflare(status, body);
    if (status === 404) {
      throw new Error("Content not found");
    }
    return cheerio.load(body);
  }

  private async webViewFetch(
    url: string,
    method: string = "GET",
    body?: string,
  ): Promise<{ status: number; body: string }> {
    const inject = `
      const res = await fetch(${JSON.stringify(url)}, {
        method: ${JSON.stringify(method)},
        headers: ${body ? '{ "content-type": "application/x-www-form-urlencoded" }' : "{}"},
        ${body ? `body: ${JSON.stringify(body)},` : ""}
        credentials: "include",
        redirect: "follow",
      });
      const text = await res.text();
      return JSON.stringify({ status: res.status, body: text });
    `;

    const { result, storage } = await Application.executeInWebView({
      source: {
        html: "<!doctype html><html><head></head><body></body></html>",
        baseUrl: `${baseUrl}/`,
        loadCSS: false,
        loadImages: false,
      },
      inject,
      storage: { cookies: this.webViewCookies() },
    });

    if (storage?.cookies?.length) {
      this.persistCookies(storage.cookies);
    }

    const parsed =
      typeof result === "string"
        ? (JSON.parse(result) as { status: number; body: string })
        : (result as { status: number; body: string });

    return { status: parsed?.status ?? 0, body: parsed?.body ?? "" };
  }

  private webViewCookies(): Cookie[] {
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    return this.cookieStorageInterceptor.cookies.map((c) => ({
      ...c,
      expires: c.expires ?? farFuture,
      created: c.created ?? new Date(Date.now()),
    }));
  }

  private checkCloudflare(status: number, html: string): void {
    if (
      status === 503 ||
      status === 403 ||
      html.includes("Just a moment") ||
      html.includes("challenges.cloudflare.com") ||
      (html.includes("window.performance") && html.includes("crypto.subtle"))
    ) {
      throw new CloudflareError({
        url: baseUrl,
        method: "GET",
        headers: { referer: baseUrl, origin: baseUrl },
      } as Request);
    }
  }
}

export const ZipComic = new ZipComicExtension();
