import {
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
  SourceManga,
  TagSection,
} from "@paperback/types";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import { URLBuilder } from "../utils/url-builder/base";
import { ThunderInterceptor } from "./ThunderInterceptor";

const baseUrl = "https://en-thunderscans.com";

type ThunderImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class ThunderExtension implements ThunderImplementation {
  requestManager = new ThunderInterceptor("main");

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    Application.registerSearchFilter({
      id: "sortBy",
      type: "dropdown",
      options: [
        { id: "relevance", value: "Relevance" },
        { id: "latest", value: "Latest" },
        { id: "oldest", value: "Oldest" },
      ],
      value: "relevance",
      title: "Sort By Filter",
    });
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
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "new_manga_section",
        title: "New Manga",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "genres",
        title: "Genres",
        type: DiscoverSectionType.genres,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: MangaFire.Metadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      // case "featured_section":
      //   return this.getFeaturedSectionItems(section, metadata);
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

  async getSearchResults(
    query: SearchQuery,
    metadata: { page?: number } | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    // Example URL: https://en-thunderscans.com/?s=search_term
    const searchUrl = new URLBuilder(baseUrl)
      .addQuery("s", query.title)
      .build();

    const request = {
      url: searchUrl,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const searchResults: SearchResultItem[] = [];

    $(".listupd .bs").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".bsx a");
      const title = unit.find(".tt").text().trim();
      const image = unit.find(".limit img").attr("src") || "";
      const mangaId = infoLink.attr("href");

      if (title && mangaId) {
        searchResults.push({
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          metadata: undefined,
        });
      }
    });

    // Check if there's a next page
    const hasNextPage = !!$(".panel-page-number .page-blue").next().length;

    return {
      items: searchResults,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    // Example URL: https://en-thunderscans.com/comics/the-joseon-prince-went-to-america-and-didnt-return/
    const request = {
      url: `${mangaId}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    // Extract basic manga details
    const title = $(".entry-title").text().trim();
    const altTitles = $(".alternative .desktop-titles")
      .text()
      .split("|")
      .map((t) => t.trim())
      .filter(Boolean);
    const image = $(".thumb img").attr("src") || "";
    const description = $(".entry-content").text().trim();
    const statusText = $(".imptdt")
      .filter((_, el) => $(el).find("h1").text().includes("Status"))
      .find("i")
      .text()
      .trim()
      .toLowerCase();

    const status: "ONGOING" | "COMPLETED" | "UNKNOWN" =
      statusText.includes("ongoing") || statusText.includes("mass released")
        ? "ONGOING"
        : statusText.includes("completed")
          ? "COMPLETED"
          : "UNKNOWN";

    // Extract tags
    const tags: TagSection[] = [];
    const genres: string[] = [];
    let rating = 1;

    // Parse genres
    $(".genres-container .mgen a").each((_, element) => {
      genres.push($(element).text().trim());
    });

    // Get rating if available
    const ratingText = $(".numscore").first().text();
    if (ratingText) {
      rating = parseFloat(ratingText) / 2; // Convert from 10 scale to 5 scale
    }

    if (genres.length > 0) {
      tags.push({
        id: "genres",
        title: "Genres",
        tags: genres.map((genre) => ({
          id: genre.toLowerCase(),
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
        status: status,
        tagGroups: tags,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const request = {
      url: `${sourceManga.mangaId}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const chapters: Chapter[] = [];

    $("#chapterlist li").each((_, element) => {
      const li = $(element);
      const link = li.find("a");
      const href = link.attr("href");

      // Skip locked chapters
      if (link.attr("data-bs-target") === "#lockedChapterModal") {
        return;
      }

      if (!href) {
        return;
      }

      const chapterNum = li.attr("data-num");
      const title = link.find(".chapternum").text().trim();

      chapters.push({
        chapterId: href,
        title: title,
        sourceManga: sourceManga,
        chapNum: chapterNum ? parseFloat(chapterNum) : 0,
        volume: undefined,
        langCode: "GB",
      });
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    try {
      const request = {
        url: `${chapter.chapterId}`,
        method: "GET",
      };

      const $ = await this.fetchCheerio(request);

      const pages: string[] = [];
      $("#readerarea img").each((_, img) => {
        const src = $(img).attr("src");
        if (!src) return;

        // Extract image URL and push to pages array
        pages.push(src);
      });

      return {
        id: chapter.chapterId,
        mangaId: chapter.sourceManga.mangaId,
        pages: pages,
      };
    } catch (error) {
      const errorDetails =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Create detailed error context
      const errorContext = {
        error: errorDetails,
        stack: errorStack,
        source: "MangaNeloExtension.getChapterDetails",
        chapterId: chapter.chapterId,
        mangaId: chapter.sourceManga.mangaId,
        requestUrl: `${chapter.chapterId}`,
        timestamp: new Date().toISOString(),
      };

      console.error(
        "Chapter details fetch failed:",
        JSON.stringify(errorContext, null, 2),
      );

      throw new Error(
        `Failed to fetch chapter details. ChapterId: ${chapter.chapterId}, Error: ${errorDetails}`,
      );
    }
  }

  async getUpdatedSectionItems(
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

    $(".latest-updates .bs").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".bsx a");
      const title = unit.find(".tt").text().trim();
      const image = unit.find(".limit img").attr("src") || "";
      const mangaId = infoLink.attr("href");

      // Get latest chapter from the first entry in chapter list
      const latestChapter = unit.find(".chapter-list .adds").first();
      const chapterText = latestChapter.find(".epxs").text().trim();
      const subtitle = chapterText || "";

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

    // Check if there's a next page
    const hasNextPage = !!$(".panel-page-number .page-blue").next().length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getPopularSectionItems(
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

    $(".pop-list-desktop > .bs").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".bsx a");
      const title = unit.find(".tt").text().trim();
      const image = unit.find(".limit img").attr("src") || "";
      const mangaId = infoLink.attr("href");
      const rating = unit.find(".numscore").first().text().trim();

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            image: image,
            title: title,
            subtitle: `Rating: ${rating}`,
            type: "simpleCarouselItem",
          }),
        );
      }
    });

    // Check if there's a next page by looking for the "Load More" button
    const hasNextPage = !!$("#load-more").length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getNewMangaSectionItems(
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

    $(".bs.styletere").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".bsx a");
      const title = unit.find(".tt").text().trim();
      const image = unit.find(".limit img").attr("src") || "";
      const mangaId = infoLink.attr("href");
      const status = unit.find(".status i").text().trim();

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            image: image,
            title: title,
            subtitle: status,
            type: "simpleCarouselItem",
          }),
        );
      }
    });

    // Check if there's a next page
    const hasNextPage = !!$(".panel-page-number .page-blue").next().length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  checkCloudflareStatus(status: number): void {
    if (status == 503 || status == 403) {
      throw new CloudflareError({ url: baseUrl, method: "GET" });
    }
  }

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const [response, data] = await Application.scheduleRequest(request);
    this.checkCloudflareStatus(response.status);
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

export const Thunder = new ThunderExtension();
