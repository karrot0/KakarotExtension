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
import { NeloInterceptor } from "./ManganeloInterceptor";

const baseUrl = "https://m.manganelo.com";

type MangaNeloImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class MangaNeloExtension implements MangaNeloImplementation {
  requestManager = new NeloInterceptor("main");

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
      default:
        return { items: [] };
    }
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: { page?: number } | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    // Example URL: https://m.manganelo.com/advanced_search?s=all&page=1&keyw=it_starts_with_a_kingpin_account
    const searchUrl = new URLBuilder(baseUrl)
      .addPath("advanced_search")
      .addQuery("s", "all")
      .addQuery("page", page.toString())
      .addQuery("keyw", query.title)
      .build();

    const request = {
      url: searchUrl,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const searchResults: SearchResultItem[] = [];

    $(".content-genres-item").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".genres-item-name");
      const title = infoLink.text().trim();
      const image = unit.find(".genres-item-img img").attr("src") || "";
      const mangaId =
        infoLink.attr("href")?.replace(/.*?manga-([^/]+).*/, "$1") || "";

      searchResults.push({
        mangaId: mangaId,
        imageUrl: image,
        title: title,
        subtitle: undefined,
        metadata: undefined,
      });
    });

    // Check if there's a next page
    const hasNextPage = !!$(".panel-page-number .page-blue").next().length;

    return {
      items: searchResults,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    // Example URL: https://m.manganelo.com/manga-af123456
    const request = {
      url: `${mangaId}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    // Extract basic manga details
    const title = $(".story-info-right h1").text().trim();
    const altTitles = $(".variations-tableInfo .table-value h2")
      .first()
      .text()
      .trim()
      .split(";")
      .map((t) => t.trim());
    const image = $(".info-image img").attr("src") || "";
    const description = $("#panel-story-info-description")
      .text()
      .replace("Description :", "")
      .trim();
    const statusText = $(".variations-tableInfo .table-value")
      .filter((_, el) => $(el).prev(".table-label").text().includes("Status"))
      .text()
      .trim()
      .toLowerCase();

    const status: "ONGOING" | "COMPLETED" | "UNKNOWN" =
      statusText.includes("ongoing") || statusText.includes("ong")
        ? "ONGOING"
        : statusText.includes("completed") || statusText.includes("comp")
          ? "COMPLETED"
          : "UNKNOWN";

    // Extract tags
    const tags: TagSection[] = [];
    const genres: string[] = [];
    let rating = 1;

    // Parse genres from the table
    $(".variations-tableInfo .table-value")
      .filter((_, el) => $(el).prev(".table-label").text().includes("Genres"))
      .find("a")
      .each((_, element) => {
        genres.push($(element).text().trim());
      });

    // Get rating if available
    const ratingElement = $("#rate_row_cmd");
    const ratingMatch = ratingElement
      .text()
      .match(/rate\s*:\s*([\d.]+)\s*\/\s*5/i);

    if (ratingMatch && ratingMatch[1]) {
      rating = parseFloat(ratingMatch[1]);
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

    $(".a-h").each((_, element) => {
      const li = $(element);
      const link = li.find("a.chapter-name");
      const href = link.attr("href") || "";
      const chapterId = href.replace("https://chapmanganelo.com", "");
      const title = link.attr("title")?.trim() || link.text().trim();
      const chapterNumber = parseFloat(
        li.attr("id")?.replace("num-", "") || "0",
      );

      chapters.push({
        chapterId: chapterId,
        title: title,
        sourceManga: sourceManga,
        chapNum: chapterNumber,
        //creationDate: date ? new Date(date) : new Date(),
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

      const [, buffer] = await Application.scheduleRequest(request);
      const result = await Application.executeInWebView({
        source: {
          html: Application.arrayBufferToUTF8String(buffer),
          baseUrl: baseUrl,
          loadCSS: false,
          loadImages: false,
        },
        inject: `
          const images = Array.from(document.querySelectorAll('.container-chapter-reader img.reader-content'));
          const imgSrcArray = images.map(img => img.src);
          return imgSrcArray;
        `,
        storage: { cookies: [] },
      });
      const pages: string[] = result.result as string[];
      return {
        mangaId: chapter.sourceManga.mangaId,
        id: chapter.chapterId,
        pages,
      };
    } catch (error) {
      console.error(
        `Failed to fetch chapter details for chapterId: ${chapter.chapterId}`,
        error,
      );
      throw new Error(
        `Failed to fetch chapter details for chapterId: ${chapter.chapterId}`,
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
      url: new URLBuilder(baseUrl)
        .addPath("advanced_search")
        .addQuery("s", "all")
        .addQuery("page", page.toString())
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".content-genres-item").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".genres-item-name");
      const title = infoLink.text().trim();
      const image = unit.find(".genres-item-img img").attr("src") || "";
      // Example URL: https://m.manganelo.com/manga-af123456
      const mangaId = infoLink.attr("href");

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            image: image,
            title: title,
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
      url: new URLBuilder(baseUrl)
        .addPath("advanced_search")
        .addQuery("s", "all")
        .addQuery("orby", "topview")
        .addQuery("page", page.toString())
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".content-genres-item").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".genres-item-name");
      const title = infoLink.text().trim();
      const image = unit.find(".genres-item-img img").attr("src") || "";
      // Example URL: https://m.manganelo.com/manga-af123456
      const mangaId = infoLink.attr("href");

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            image: image,
            title: title,
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
  type: "simpleCarouselItem";
}): DiscoverSectionItem {
  return {
    type: options.type,
    mangaId: options.id,
    imageUrl: options.image,
    title: options.title,
    subtitle: undefined,
    metadata: undefined,
  };
}

export const Manganelo = new MangaNeloExtension();
