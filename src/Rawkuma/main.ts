import {
  Chapter,
  ChapterDetails,
  ChapterProviding,
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
  Metadata,
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SortingOption,
  SourceManga,
  TagSection,
} from "@paperback/types";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import { Interceptor } from "./interceptors";

const baseUrl = "https://rawkuma.net";

type RawkumaImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class RawkumaExtension implements RawkumaImplementation {
  cookieStorageInterceptor = new CookieStorageInterceptor({
    storage: "stateManager",
  });
  requestManager = new Interceptor("main");

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
        id: "popular_today_section",
        title: "Popular Today",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "latest_updates_section",
        title: "Latest Updates",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "top_series_section",
        title: "Top Series",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "popular_section":
        return this.getPopularSectionItems(section);
      case "popular_today_section":
        return this.getPopularTodayItems(section);
      case "latest_updates_section":
        return this.getLatestUpdates(section);
      case "top_series_section":
        return this.getTopSeriesItems(section);
      default:
        return { items: [] };
    }
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    return [
      { id: "popular", label: "Popular" },
      { id: "rating", label: "Rating" },
      { id: "updated", label: "Updated" },
      { id: "bookmarked", label: "Bookmarked" },
      { id: "title", label: "Title" },
    ];
  }

  async getSearchResults(
    query: SearchQuery<Metadata>,
    metadata: Metadata | undefined,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const collectedIds: string[] = [];
    const page: number = 1;
    const searchTerm = query.title ?? "";

    const $lib = await this.fetchCheerio({
      url: `${baseUrl}/library/`,
      method: "GET",
    });
    let nonce = "";
    $lib("script").each((_, el) => {
      const text = $lib(el).html() || "";
      const match = text.match(/"nonce"\s*:\s*"([^"]+)"/);
      if (match) {
        nonce = match[1];
        return false;
      }
    });

    const params: Record<string, string> = {
      nonce,
      inclusion: "OR",
      exclusion: "OR",
      page: String(page),
      genre: "[]",
      genre_exclude: "[]",
      author: "[]",
      artist: "[]",
      project: "0",
      type: "[]",
      status: "[]",
      order: "desc",
      orderby: sortingOption?.id ?? "popular",
      query: searchTerm,
    };
    const body = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const $ = await this.fetchCheerio({
      url: `${baseUrl}/wp-admin/admin-ajax.php?action=advanced_search`,
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: baseUrl,
        referer: `${baseUrl}/library/?search_term=${encodeURIComponent(searchTerm)}`,
      },
      body,
    });

    const results: SearchResultItem[] = [];
    const seenIds = new Set<string>();

    $("a[href*='/manga/']").each((_, element) => {
      const anchor = $(element);
      if (!anchor.hasClass("text-base")) return;

      const mangaUrl = anchor.attr("href") || "";
      const mangaIdMatch = mangaUrl.match(/\/manga\/([^/]+)\/?/);
      const mangaId = mangaIdMatch ? mangaIdMatch[1] : "";
      if (!mangaId || seenIds.has(mangaId)) return;
      seenIds.add(mangaId);

      const title = anchor.text().trim();
      const container = anchor.closest("div");
      const image =
        container.find("img.wp-post-image").first().attr("src") ||
        container
          .parents("div")
          .find("img.wp-post-image")
          .first()
          .attr("src") ||
        "";

      if (!title || !mangaId) return;
      if (collectedIds.includes(mangaId)) return;
      collectedIds.push(mangaId);
      results.push({
        mangaId,
        imageUrl: image,
        title,
        subtitle: undefined,
        metadata: undefined,
      });
    });

    const hasNextPage =
      $(`button[onclick*="'page', '${page + 1}'"]`).length > 0;

    return {
      items: results,
      metadata:
        results.length > 0 && hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = { url: `${baseUrl}/manga/${mangaId}`, method: "GET" };

    const $ = await this.fetchCheerio(request);

    const title = $('h1[itemprop="name"]').first().text().trim();
    const rawImage = $('div[itemprop="image"] img').first().attr("src") || "";
    const image = rawImage.startsWith("/")
      ? `https://rawkuma.net${rawImage}`
      : rawImage;

    const description = $('div[itemprop="description"][data-show="true"]')
      .first()
      .text()
      .trim();

    const status = "ONGOING";

    let rating = 0;
    const ratingValue = $(
      '[itemprop="aggregateRating"] [itemprop="ratingValue"]',
    ).attr("content");
    if (ratingValue) {
      const parsed = parseFloat(ratingValue);
      if (!isNaN(parsed)) rating = parsed;
    } else {
      const visibleRating = $(
        '[itemprop="aggregateRating"] .font-bold, .rating-prc span.font-bold, .rating-prc',
      )
        .first()
        .text()
        .trim();
      if (visibleRating.endsWith("%")) {
        let pct = parseFloat(visibleRating.replace("%", ""));
        if (!isNaN(pct)) {
          if (pct > 100) pct = pct / 100;
          else pct = pct / 10;
          rating = Math.round(pct * 100) / 100;
        }
      } else {
        const parsedVis = parseFloat(visibleRating);
        if (!isNaN(parsedVis)) rating = parsedVis;
      }
    }

    const tags: TagSection[] = [];
    const genres = $('a[itemprop="genre"]')
      .map((_, el) => $(el).text().trim())
      .get();

    let publisher = "";
    const serializationHeading = $("h4")
      .filter((_, el) => {
        return (
          $(el).text().trim().toLowerCase().includes("serialization") ||
          $(el).text().trim().toLowerCase().includes("publisher")
        );
      })
      .first();
    if (serializationHeading && serializationHeading.length) {
      publisher = serializationHeading.next().text().trim();
    }

    if (genres.length > 0) {
      tags.push({
        id: "genres",
        title: "Genres",
        tags: genres.map((genre) => ({
          id: genre.toLowerCase().replace(/[^a-z0-9]/g, ""),
          title: genre,
        })),
      });
    }

    return {
      mangaId: mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl: image,
        author: publisher,
        synopsis: description,
        rating: rating,
        contentRating: ContentRating.EVERYONE,
        status: status,
        tagGroups: tags,
        shareUrl: `${baseUrl}/manga/${mangaId}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaRequest = {
      url: `${baseUrl}/manga/${sourceManga.mangaId}`,
      method: "GET",
    };
    const $manga = await this.fetchCheerio(mangaRequest);

    const hxGet =
      $manga("[hx-get*='chapter_list']").first().attr("hx-get") || "";
    const mangaIdMatch = hxGet.match(/manga_id=(\d+)/);
    if (!mangaIdMatch) return [];
    const mangaDbId = mangaIdMatch[1];

    const request = {
      url: `${baseUrl}/wp-admin/admin-ajax.php?manga_id=${mangaDbId}&action=chapter_list`,
      method: "GET",
      headers: {
        "hx-request": "true",
        "hx-target": "chapter-list",
        "hx-trigger": "chapter-list",
        referer: `${baseUrl}/manga/${sourceManga.mangaId}/`,
      },
    };
    const $ = await this.fetchCheerio(request);

    const chapters: Chapter[] = [];

    for (const element of $("div[data-chapter-number]").toArray()) {
      const el = $(element);
      const href = el.find("a").first().attr("href") || "";
      if (!href) continue;

      const title = el.find("div.flex.flex-row span").first().text().trim();
      const chapNum = parseFloat(el.attr("data-chapter-number") || "0");
      const dateAttr = el.find("time").attr("datetime") || "";

      const chapterId = href.replace(/\/$/, "").split("/").pop() ?? "";

      chapters.push({
        chapterId,
        title,
        sourceManga,
        chapNum,
        publishDate: dateAttr ? new Date(dateAttr) : new Date(),
        langCode: "🇯🇵",
      });
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    try {
      const request = {
        url: `${baseUrl}/manga/${chapter.sourceManga.mangaId}/${chapter.chapterId}`,
        method: "GET",
      };

      const $ = await this.fetchCheerio(request);
      const pages: string[] = [];

      $("section[data-image-data] img").each((_, element) => {
        const image = $(element).attr("src") || "";
        if (!image || image.includes("preloader.gif")) {
          return;
        }
        pages.push(image.trim());
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

  async getPopularSectionItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const collectedIds: string[] = [];

    const request = {
      url: `${baseUrl}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    const slides = $(".swiper-slide").toArray();
    if (slides.length > 0) {
      for (const element of slides) {
        const slide = $(element);

        const titleAnchor = slide.find("a").first();
        const mangaUrl = titleAnchor.attr("href") || "";
        let mangaId = "";
        const mangaIdMatch = mangaUrl.match(/\/manga\/([^/]+)\/?/);
        if (mangaIdMatch) mangaId = mangaIdMatch[1];

        let title = titleAnchor
          .find("span.font-semibold")
          .first()
          .text()
          .trim();
        if (!title) title = titleAnchor.text().trim();

        const imageEl = slide.find("img").first();
        const image = imageEl.attr("src") || "";

        const chapterEl = slide.find("div.text-lg.font-semibold").first();
        const subtitle = chapterEl.text().replace("Chapter:", "").trim();

        const genres = [];
        slide.find('a[rel="tag"]').each((_, g) => {
          const genre = $(g).text().trim();
          if (genre) genres.push(genre);
        });

        if (title && mangaId && !collectedIds.includes(mangaId)) {
          collectedIds.push(mangaId);
          items.push({
            type: "featuredCarouselItem",
            mangaId: mangaId,
            imageUrl: image,
            title: title,
            supertitle: `Chapter: ${subtitle}`,
            metadata: undefined,
          });
        }
      }
    }

    return {
      items: items,
    };
  }

  async getPopularTodayItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const collectedIds: string[] = [];

    const request = {
      url: `${baseUrl}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    const slides = $(".swiper-slide.manga-swipe").toArray();
    if (slides.length > 0) {
      for (const element of slides) {
        const slide = $(element);
        const titleAnchor = slide.find("a").first();
        const mangaUrl = titleAnchor.attr("href") || "";
        let mangaId = "";
        const mangaIdMatch = mangaUrl.match(/\/manga\/([^/]+)\/?/);
        if (mangaIdMatch) mangaId = mangaIdMatch[1];
        const title = slide.find(".title h4").first().text().trim();
        const image = slide.find("img.cover-image").attr("src") || "";
        const rating = slide
          .find(".details p.inline-block")
          .first()
          .text()
          .trim();
        const subtitle = rating ? `Rating: ${rating}` : "";
        if (title && mangaId && !collectedIds.includes(mangaId)) {
          collectedIds.push(mangaId);
          items.push({
            type: "prominentCarouselItem",
            mangaId: mangaId,
            imageUrl: image,
            title: title,
            subtitle: subtitle,
            metadata: undefined,
          });
        }
      }
    }

    return {
      items: items,
    };
  }

  async getLatestUpdates(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const collectedIds: string[] = [];

    const request = {
      url: `${baseUrl}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    const slides = $(".swiper-slide.manga-swipe").toArray();
    if (slides.length > 0) {
      for (const element of slides) {
        const slide = $(element);
        const titleAnchor = slide.find("a").first();
        const mangaUrl = titleAnchor.attr("href") || "";
        let mangaId = "";
        const mangaIdMatch = mangaUrl.match(/\/manga\/([^/]+)\/?/);
        if (mangaIdMatch) mangaId = mangaIdMatch[1];
        const title = slide.find(".title h4").first().text().trim();
        const image = slide.find("img.cover-image").attr("src") || "";
        const rating = slide
          .find(".details p.inline-block")
          .first()
          .text()
          .trim();
        const subtitle = rating ? `Rating: ${rating}` : "";
        if (title && mangaId && !collectedIds.includes(mangaId)) {
          collectedIds.push(mangaId);
          items.push({
            type: "prominentCarouselItem",
            mangaId: mangaId,
            imageUrl: image,
            title: title,
            subtitle: subtitle,
            metadata: undefined,
          });
        }
      }
    }

    return {
      items: items,
    };
  }

  async getTopSeriesItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const collectedIds: string[] = [];

    const request = {
      url: `${baseUrl}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    const slides = $(".swiper-slide.manga-swipe").toArray();
    if (slides.length > 0) {
      for (const element of slides) {
        const slide = $(element);
        const titleAnchor = slide.find("a").first();
        const mangaUrl = titleAnchor.attr("href") || "";
        let mangaId = "";
        const mangaIdMatch = mangaUrl.match(/\/manga\/([^/]+)\/?/);
        if (mangaIdMatch) mangaId = mangaIdMatch[1];
        const title = slide.find(".title h4").first().text().trim();
        const image = slide.find("img.cover-image").attr("src") || "";
        const rating = slide
          .find(".details p.inline-block")
          .first()
          .text()
          .trim();
        const subtitle = rating ? `Rating: ${rating}` : "";
        if (title && mangaId && !collectedIds.includes(mangaId)) {
          collectedIds.push(mangaId);
          items.push({
            type: "prominentCarouselItem",
            mangaId: mangaId,
            imageUrl: image,
            title: title,
            subtitle: subtitle,
            metadata: undefined,
          });
        }
      }
    }

    return {
      items: items,
    };
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

export const Rawkuma = new RawkumaExtension();
