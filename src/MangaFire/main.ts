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

const baseUrl = "https://mangafire.to";

type MangaFireImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class MangaFireExtension implements MangaFireImplementation {
  async initialise(): Promise<void> {
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
    const searchUrl = new URLBuilder(baseUrl)
      .addPath("filter")
      .addQuery("keyword", query.title)
      .addQuery("page", page.toString())
      .build();

    const request = {
      url: searchUrl,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const searchResults: SearchResultItem[] = [];

    $(".original.card-lg .unit .inner").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".info > a");
      const title = infoLink.text().trim();
      const image = unit.find("img").attr("src") || "";
      const mangaId = infoLink.attr("href")?.replace("/manga/", "") || "";

      searchResults.push({
        mangaId: mangaId,
        imageUrl: image,
        title: title,
        subtitle: undefined,
        metadata: undefined,
      });
    });

    // Check if there's a next page
    const hasNextPage = !!$(".page-item.active + .page-item .page-link").length;

    return {
      items: searchResults,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = {
      url: new URLBuilder(baseUrl).addPath("manga").addPath(mangaId).build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    // Extract basic manga details
    const title = $(".manga-detail .info h1").text().trim();
    const altTitles = [$(".manga-detail .info h6").text().trim()];
    const image = $(".manga-detail .poster img").attr("src") || "";
    const description = $(".manga-detail .info .description").text().trim();
    const status = $(".manga-detail .info .min-info")
      .text()
      .includes("Releasing")
      ? "ONGOING"
      : "COMPLETED";

    // Extract tags
    const tags: TagSection[] = [];
    const genres: string[] = [];
    let rating = 1;

    // Parse info-rating section
    $("#info-rating .meta div").each((_, element) => {
      const label = $(element).find("span").first().text().trim();
      if (label === "Genres:") {
        $(element)
          .find("a")
          .each((_, genreElement) => {
            genres.push($(genreElement).text().trim());
          });
      }
    });

    // Get rating if available
    const ratingValue = $("#info-rating .score .live-score").text().trim();
    if (ratingValue) {
      rating = parseFloat(ratingValue) / 2; // Convert 10-point scale to 5-point scale
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
        status: status as "ONGOING" | "COMPLETED" | "UNKNOWN",
        tagGroups: tags,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("manga")
        .addPath(sourceManga.mangaId)
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const chapters: Chapter[] = [];

    $(".list-body .item").each((_, element) => {
      const li = $(element);
      const link = li.find("a");
      const chapterId = link.attr("href")?.replace("/read/", "") || "";
      const title = link.find("span").first().text().trim();
      // Extract chapter number from data-number attribute
      const chapterNumber = parseFloat(li.attr("data-number") || "0");
      const date = link.find("span").last().text().trim();

      chapters.push({
        chapterId: chapterId,
        title: title,
        sourceManga: sourceManga,
        chapNum: chapterNumber,
        creationDate: new Date(date),
        volume: undefined,
        langCode: "en",
      });
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const request = {
      // Makes this url https://mangafire.to/read/5f5b3b7b7d1c8c0001b3b7b7/en/chapter-1
      url: new URLBuilder(baseUrl)
        .addPath("read")
        .addPath(chapter.chapterId)
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    // Extract chapter images and their data-number attributes
    const pages: string[] = [];
    const pageMap = new Map<number, string>();

    $(".pages.longstrip .page.fit-w .img img").each((_, element) => {
      const dataNumber = parseInt($(element).attr("data-number") || "1");
      const imageUrl = $(element).attr("src");
      if (imageUrl) {
        pageMap.set(dataNumber, imageUrl);
      }
    });

    // Sort pages by their data-number to maintain correct order
    Array.from(pageMap.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([, url]) => pages.push(url));

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages: pages,
    };
  }

  async getUpdatedSectionItems(
    section: DiscoverSection,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("filter")
        .addQuery("keyword", "")
        .addQuery("language[]", "en")
        .addQuery("sort", "recently_updated")
        .addQuery("page", page.toString())
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".unit .inner").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".info > a").last(); // Get the manga title link
      const title = infoLink.text().trim();
      const image = unit.find(".poster img").attr("src") || "";
      const mangaId = infoLink.attr("href")?.replace("/manga/", "") || "";

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
    const hasNextPage = !!$(".page-item.active + .page-item .page-link").length;

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
        .addPath("filter")
        .addQuery("keyword", "")
        .addQuery("language[]", "en")
        .addQuery("sort", "most_viewed")
        .addQuery("page", page.toString())
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".unit .inner").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".info > a").last(); // Get the manga title link
      const title = infoLink.text().trim();
      const image = unit.find(".poster img").attr("src") || "";
      const mangaId = infoLink.attr("href")?.replace("/manga/", "") || "";

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
    const hasNextPage = !!$(".page-item.active + .page-item .page-link").length;

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

export const MangaFire = new MangaFireExtension();
