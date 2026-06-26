import {
  AdvancedSearchForm,
  Chapter,
  ChapterDetails,
  ChapterProviding,
  Cookie,
  CookieStorageInterceptor,
  CloudflareBypassRequestProviding,
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
import { ReadComicsOnlineInterceptor } from "./interceptors";
import { Metadata } from "./model";
import { ReadComicsOnlineSearchForm } from "./forms";

const baseUrl = "https://readcomicsonline.ru";

type ReadComicsOnlineImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  CloudflareBypassRequestProviding &
  DiscoverSectionProviding;

export class ReadComicsOnlineExtension
  implements ReadComicsOnlineImplementation
{
  requestManager = new ReadComicsOnlineInterceptor("main");
  cookieStorageInterceptor = new CookieStorageInterceptor({storage: "stateManager"});

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "popular_section",
        title: "Popular",
        type: DiscoverSectionType.featured,
      },
      {
        id: "hot_comic_updates_section",
        title: "Hot Comic updates",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "latest_comic_updates_section",
        title: "Latest Comic Updates",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: Metadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "popular_section":
        return this.getPopularSectionItems(section, metadata);
      case "hot_comic_updates_section":
        return this.getHotComicsSectionItems(section, metadata);
      case "latest_comic_updates_section":
        return this.getLatestComicsSectionItems(section, metadata);
      default:
        return { items: [] };
    }
  }

  async getAdvancedSearchForm(
    query: SearchQuery<Metadata>,
  ): Promise<AdvancedSearchForm> {
    return new ReadComicsOnlineSearchForm(query.metadata?.searchMeta);
  }

  async getSearchResults(
    query: SearchQuery<Metadata>,
    metadata: Metadata | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const searchMeta = query.metadata?.searchMeta;
    const hasFilters = !!(searchMeta && (searchMeta.status || searchMeta.types || searchMeta.categories));

    if (!(query.title ?? "").trim() && !hasFilters) {
      return { items: [] };
    }

    return this.getAdvancedSearchResults(
      (query.title ?? "").trim(),
      searchMeta ?? { status: "", types: "", categories: "" },
      metadata?.page ?? 1,
      metadata?.csrfToken,
    );
  }

  // All searches go through POST /advanced-search. The `name` field handles
  // free-text search; status_id / type_id / category handle filters.
  // On page 1 we GET the page to extract a fresh CSRF token; on subsequent
  // pages we reuse the token passed through metadata to avoid a redundant GET.
  private async getAdvancedSearchResults(
    title: string,
    searchMeta: NonNullable<Metadata["searchMeta"]>,
    page: number,
    cachedToken?: string,
  ): Promise<PagedResults<SearchResultItem>> {
    let token = cachedToken ?? "";

    if (!token) {
      const [, tokenData] = await Application.scheduleRequest({
        url: `${baseUrl}/advanced-search`,
        method: "GET",
      });
      const $tokenPage = cheerio.load(Application.arrayBufferToUTF8String(tokenData));
      token = $tokenPage('input[name="_token"]').val() as string ?? "";
    }

    const body = [
      `name=${encodeURIComponent(title ?? "")}`,
      `status_id=${encodeURIComponent(searchMeta.status)}`,
      `type_id=${encodeURIComponent(searchMeta.types)}`,
      `category=${encodeURIComponent(searchMeta.categories)}`,
      `_token=${encodeURIComponent(token)}`,
    ].join("&");

    const searchUrl = page > 1
      ? `${baseUrl}/advanced-search?page=${page}`
      : `${baseUrl}/advanced-search`;

    const [, data] = await Application.scheduleRequest({
      url: searchUrl,
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const $ = cheerio.load(Application.arrayBufferToUTF8String(data));
    const items: SearchResultItem[] = [];

    // Results are thumbnail grid cards: <a class="group"> containing .rc-cover
    $("a:has(.rc-cover)").each((_, element) => {
      const unit = $(element);
      const href = unit.attr("href") ?? "";
      const mangaId = href
        .replace(/^https?:\/\/readcomicsonline\.ru\/comic\//, "")
        .trim();

      const img = unit.find(".rc-cover img");
      const imageUrl = img.attr("src") ?? "";
      const title = unit.find("p").text().trim() || (img.attr("alt") ?? "");

      if (title && mangaId) {
        items.push({ mangaId, title, imageUrl });
      }
    });

    const hasNextPage = !!$("a[rel='next']").length;
    const nextToken = $('input[name="_token"]').val() as string | undefined;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1, csrfToken: nextToken ?? token } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = { url: `${baseUrl}/comic/${mangaId}`, method: "GET" };

    const $ = await this.fetchCheerio(request);

    const title = $("h1").first().text().trim();
    const image = $(".grid > div:first-child img").first().attr("src") ?? "";
    const description = $(".bg-ink-900 p.text-sm.leading-relaxed").first().text().trim();
    const author = $('dl a[href*="/comic-list/author/"]').first().text().trim();

    const statusText = $("span.rounded-full").first().text().toLowerCase();
    const status = statusText.includes("ongoing")
      ? "ONGOING"
      : statusText.includes("complete")
        ? "COMPLETED"
        : "UNKNOWN";

    const tags: TagSection[] = [];

    const typeChips: string[] = [];
    $(".rc-chip").each((_, element) => {
      const text = $(element).text().trim();
      if (!text.includes("👁")) {
        typeChips.push(text);
      }
    });
    if (typeChips.length > 0) {
      tags.push({
        id: "type",
        title: "Type",
        tags: typeChips.map((t) => ({
          id: t.toLowerCase().replace(/[^a-z0-9]/g, ""),
          title: t,
        })),
      });
    }

    const categories: string[] = [];
    $('dl a[href*="/comic-list/category/"]').each((_, element) => {
      categories.push($(element).text().trim());
    });
    if (categories.length > 0) {
      tags.push({
        id: "categories",
        title: "Categories",
        tags: categories.map((c) => ({
          id: c.toLowerCase().replace(/[^a-z0-9]/g, ""),
          title: c,
        })),
      });
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl: image,
        synopsis: description,
        author,
        rating: 0,
        contentRating: ContentRating.EVERYONE,
        status,
        tagGroups: tags,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const request = {
      url: `${baseUrl}/comic/${sourceManga.mangaId}`,
      method: "GET",
    };
    const $ = await this.fetchCheerio(request);
    const chapters: Chapter[] = [];

    // Find the Chapters section by its heading, then collect all chapter links inside it.
    const chaptersSection = $("h2.rc-heading:contains('Chapters')").closest("section");
    chaptersSection.find("a").each((_, element) => {
      const link = $(element);
      const href = link.attr("href") ?? "";

      const chapterId = href
        .replace(/^https?:\/\/readcomicsonline\.ru\/comic\/[^/]+/, "")
        .trim();

      // e.g. "#162" or "#Annual 2022"
      const chapterTitle = link.find("span.text-brand-400").text().trim();

      // e.g. "31 May 2022"
      const dateText = link.find("span.text-xs").text().trim();
      const [day, month, year] = dateText.split(" ").map((item, index) => {
        if (index === 1) {
          const monthName = item.replace(".", "");
          return new Date(Date.parse(`${monthName} 1, 2000`)).getMonth() + 1;
        }
        return parseInt(item);
      });
      const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      let chapNum = 0;
      const regularMatch = chapterTitle.match(/#(\d+(?:\.\d+)?)/);
      if (regularMatch) {
        chapNum = parseFloat(regularMatch[1]);
      } else {
        const annualMatch = chapterTitle.match(/#(?:-\s*)?Annual\s+(\d+)/i);
        if (annualMatch) {
          chapNum = parseFloat(annualMatch[1]);
        }
      }

      chapters.push({
        chapterId,
        title: chapterTitle,
        sourceManga,
        chapNum,
        publishDate: new Date(isoDate),
        volume: 0,
        langCode: "🇬🇧",
      });
    });

    return chapters.sort((a, b) => {
      return (a.publishDate?.getTime() ?? 0) - (b.publishDate?.getTime() ?? 0);
    });
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    try {
      const request = {
        url: `${baseUrl}/comic/${chapter.sourceManga.mangaId}${chapter.chapterId}`,
        method: "GET",
      };

      const $ = await this.fetchCheerio(request);

      const pages: string[] = [];

      // All pages are rendered at once in #reader-all with plain src attributes.
      $("#reader-all img").each((_, element) => {
        const src = $(element).attr("src");
        if (src) {
          pages.push(src.trim());
        }
      });

      return {
        id: chapter.chapterId,
        mangaId: chapter.sourceManga.mangaId,
        pages: pages,
      };
    } catch (error) {
      console.error("Error fetching chapter details:", error);
      return {
        id: chapter.chapterId,
        mangaId: chapter.sourceManga.mangaId,
        pages: [],
      };
    }
  }

  async getHotComicsSectionItems(
    section: DiscoverSection,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: baseUrl,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    // Hot carousel: each a.hot-item is the anchor itself; image and chapter
    // number sit inside it as direct children.
    $("#hot-track a.hot-item").each((_, element) => {
      const unit = $(element);
      const rawMangaId = unit.attr("href") ?? "";
      const mangaId = rawMangaId
        .replace(/^https?:\/\/readcomicsonline\.ru\/comic\//, "")
        .trim();
      const title = unit.find("p.truncate").text().trim();
      const image = unit.find("img").attr("src") ?? "";
      const latestChapter = unit.find(".text-brand-300").text().trim();

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            image,
            title,
            subtitle: latestChapter,
            type: "simpleCarouselItem",
          }),
        );
      }
    });

    return {
      items,
      metadata: undefined,
    };
  }

  async getPopularSectionItems(
    section: DiscoverSection,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: baseUrl,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    // The old chart sidebar is gone. Use the hot items carousel as the
    // featured section instead.
    $("#hot-track a.hot-item").each((_, element) => {
      const unit = $(element);
      const rawMangaId = unit.attr("href") ?? "";
      const mangaId = rawMangaId
        .replace(/^https?:\/\/readcomicsonline\.ru\/comic\//, "")
        .trim();
      const title = unit.find("p.truncate").text().trim();
      const image = unit.find("img").attr("src") ?? "";
      const latestChapter = unit.find(".text-brand-300").text().trim();

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push({
          mangaId,
          imageUrl: image,
          title,
          supertitle: latestChapter || undefined,
          type: "featuredCarouselItem",
        });
      }
    });

    return {
      items,
      metadata: undefined,
    };
  }

  async getLatestComicsSectionItems(
    section: DiscoverSection,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: baseUrl,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".release-card").each((_, element) => {
      const unit = $(element);
      const coverLink = unit.find("a.shrink-0");
      const href = coverLink.attr("href") ?? "";
      const mangaId = href
        .replace(/^https?:\/\/readcomicsonline\.ru\/comic\//, "")
        .trim();

      const title = unit.find("a.line-clamp-2").text().trim();
      const image = coverLink.find("img").attr("src") ?? "";
      // The read button shows the latest chapter number (e.g. "#42").
      const latestChapter = unit.find("a.inline-flex").text().trim();

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            image,
            title,
            subtitle: latestChapter,
            type: "simpleCarouselItem",
          }),
        );
      }
    });

    const hasNextPage = !!$("a[rel='next']").length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/${mangaId}`;
  }

  async cloudflareBypassCompleted(
    _request: globalThis.Request,
    cookies: Cookie[],
    _localStorage: Record<string, string>,
  ): Promise<void> {
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

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const [response, data] = await Application.scheduleRequest(request);
    if (response.status === 404) {
      throw new Error("Content not found");
    }
    return cheerio.load(Application.arrayBufferToUTF8String(data));
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

export const ReadComicsOnline = new ReadComicsOnlineExtension();
