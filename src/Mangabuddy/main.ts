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
  SearchFilter,
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

  private async getGenresList(): Promise<{ id: string; value: string }[]> {
    try {
      const request = {
        url: `${baseUrl}/home`,
        method: "GET",
      };

      const $ = await this.fetchCheerio(request);
      const genres: { id: string; value: string }[] = [];

      $(".genres__wrapper li a").each((_, element) => {
        const genre = $(element).text().trim();
        const href = $(element).attr("href") || "";
        const slug = href.split("/genres/").pop() || "";

        if (
          genre &&
          slug &&
          !slug.includes("/status/") &&
          !slug.includes("/top/") &&
          !genre.match(/^(DAY|MONTH|Completed|Ongoing)$/) &&
          !slug.includes("/special/")
        ) {
          genres.push({
            id: slug,
            value: genre,
          });
        }
      });

      if (genres.length === 0) {
        const staticGenres = [
          "Action",
          "Adaptation",
          "Adult",
          "Adventure",
          "Animal",
          "Anthology",
          "Cartoon",
          "Comedy",
          "Comic",
          "Cooking",
          "Demons",
          "Doujinshi",
          "Drama",
          "Ecchi",
          "Fantasy",
          "Full Color",
          "Game",
          "Gender bender",
          "Ghosts",
          "Harem",
          "Historical",
          "Horror",
          "Isekai",
          "Josei",
          "Long strip",
          "Mafia",
          "Magic",
          "Manga",
          "Manhua",
          "Manhwa",
          "Martial arts",
          "Mature",
          "Mecha",
          "Medical",
          "Military",
          "Monster",
          "Monster girls",
          "Monsters",
          "Music",
          "Mystery",
          "Office",
          "Office workers",
          "One shot",
          "Police",
          "Psychological",
          "Reincarnation",
          "Romance",
          "School life",
          "Sci fi",
          "Science fiction",
          "Seinen",
          "Shoujo",
          "Shoujo ai",
          "Shounen",
          "Shounen ai",
          "Slice of life",
          "Smut",
          "Soft Yaoi",
          "Sports",
          "Super Power",
          "Superhero",
          "Supernatural",
          "Thriller",
          "Time travel",
          "Tragedy",
          "Vampire",
          "Vampires",
          "Video games",
          "Villainess",
          "Web comic",
          "Webtoons",
          "Yaoi",
          "Yuri",
          "Zombies",
        ];

        staticGenres.forEach((genre) => {
          const slug = genre.toLowerCase().replace(/\s+/g, "-");
          genres.push({
            id: slug,
            value: genre,
          });
        });
      }

      // Sort genres alphabetically by value (genre name)
      return genres.sort((a, b) => a.value.localeCompare(b.value));
    } catch (error) {
      console.error("Failed to get genre list:", error);
      return [];
    }
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: BuddyMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "popular_section":
        return this.getPopularSectionItems(section, metadata);
      case "updated_section":
        return this.getUpdatedSectionItems(section, metadata);
      case "new_manga_section":
        return this.getNewMangaSectionItems(section, metadata);
      default:
        return { items: [] };
    }
  }

  async getSearchFilters(): Promise<SearchFilter[]> {
    const filters: SearchFilter[] = [];

    const genresList = await this.getGenresList();

    filters.push({
      id: "genres",
      type: "multiselect",
      options: genresList,
      allowExclusion: true,
      value: {},
      title: "Genre Filter",
      allowEmptySelection: false,
      maximum: undefined,
    });

    filters.push({
      id: "status",
      type: "dropdown",
      options: [
        { id: "all", value: "All" },
        { id: "ongoing", value: "Ongoing" },
        { id: "completed", value: "Completed" },
      ],
      value: "all",
      title: "Status Filter",
    });

    filters.push({
      id: "orderby",
      type: "dropdown",
      options: [
        { id: "views", value: "Views" },
        { id: "updated", value: "Updated" },
        { id: "created", value: "Created" },
        { id: "name", value: "Name A-Z" },
        { id: "rating", value: "Rating" },
      ],
      value: "views",
      title: "Sort By",
    });

    return filters;
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: { page?: number } | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;

    // Search = https://mangabuddy.com/search?q=amari
    // Filter = https://mangabuddy.com/search?genre%5B%5D=action&genre%5B%5D=adaptation&status=all&sort=views&q=amari
    const searchUrl = new URLBuilder(baseUrl)
      .addPath("search")
      .addQuery("q", query.title)
      .addQuery("page", page.toString());

    const getFilterValue = (id: string) =>
      query.filters.find((filter) => filter.id == id)?.value;

    const genres = getFilterValue("genres") as
      | Record<string, "included" | "excluded">
      | undefined;
    const status = getFilterValue("status");
    const orderby = (getFilterValue("orderby") as string) || "views";

    if (genres && typeof genres === "object") {
      Object.keys(genres)
        .sort()
        .forEach((id) => {
          const value = genres[id];
          if (value === "included") {
            searchUrl.addQuery("genre[]", id);
          }
        });
    }

    if (status && status != "all") {
      searchUrl.addQuery("status", status);
    }

    if (orderby) {
      searchUrl.addQuery("sort", orderby);
    }

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
      const genres: string[] = [];
      item.find(".meta .genres span").each((_, el) => {
        const genre = $(el).text().trim();
        if (genre) genres.push(genre.toLowerCase().replace(/\s+/g, "-"));
      });

      // exclude mangas with genre that are excluded
      if (genres.length > 0 && typeof query.filters.find((filter) => filter.id == "genres")?.value === "object") {
        const filterGenres = query.filters.find((filter) => filter.id == "genres")?.value as Record<string, "included" | "excluded">;
        const hasExcluded = genres.some((genre) => filterGenres[genre] === "excluded");
        if (hasExcluded) {
          return;
        }
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
      url: `${baseUrl}/${sourceManga.mangaId}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const chapters: Chapter[] = [];

    $(".chapter-list li").each((_, element) => {
      const li = $(element);
      const link = li.find("a");
      const chapterUrl = link.attr("href") || "";

      const chapterMatch = chapterUrl.match(/chapter-(\d+(\.\d+)?)/i);
      const chapterNumber = chapterMatch ? parseFloat(chapterMatch[1]) : 0;

      const chapterId = chapterMatch ? chapterMatch[1] : "0";

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

    return chapters.sort((a, b) => b.chapNum - a.chapNum);
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterUrl = `${baseUrl}/${chapter.sourceManga.mangaId}/chapter-${chapter.chapterId}`;
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
    section: DiscoverSection,
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
