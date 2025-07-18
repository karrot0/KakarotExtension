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
  SearchFilter,
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SourceManga,
  TagSection,
} from "@paperback/types";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
// import { postToDiscordWebhook } from "../utils/discord_debugging";
import { URLBuilder } from "../utils/url-builder/base";
import { ReadComicsOnlineInterceptor } from "./interceptors";
import { CaveMetadata } from "./model";

const baseUrl = "https://readcomicsonline.ru";

type ReadComicsOnlineImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class ReadComicsOnlineExtension
  implements ReadComicsOnlineImplementation
{
  requestManager = new ReadComicsOnlineInterceptor("main");

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
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
    metadata: CaveMetadata | undefined,
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

  async getSearchFilters(): Promise<SearchFilter[]> {
    const filters: SearchFilter[] = [];

    return filters;
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const itemsPerPage = 10;

    const searchUrl = new URLBuilder(`${baseUrl}/search`);
    searchUrl.addQuery("query", query.title);

    const request = {
      url: searchUrl.build(),
      method: "GET",
    };

    const [response, data] = await Application.scheduleRequest(request);
    this.checkCloudflareStatus(response.status);
    const responseText = Application.arrayBufferToUTF8String(data);
    
    let searchResults: SearchResultItem[] = [];

    try {
      interface SearchResponse {
        suggestions: { value: string; data: string }[];
      }

      const searchData: SearchResponse = JSON.parse(responseText) as SearchResponse;
      
      if (searchData.suggestions && Array.isArray(searchData.suggestions)) {
        searchResults = searchData.suggestions.map(item => ({
          mangaId: item.data,
          title: item.value,
          imageUrl: `${baseUrl}/uploads/manga/${item.data}/cover/cover_250x350.jpg`,
          type: "searchResultItem" as const,
        }));
      }
    } catch (error) {
      console.error("Failed to parse search response:", error);
    }

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedResults = searchResults.slice(startIndex, endIndex);
    const hasNextPage = endIndex < searchResults.length;

    return {
      items: paginatedResults,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    // Expected mangaId: 6975-invincible-2003
    const request = { url: `${baseUrl}/comic/${mangaId}`, method: "GET" };

    const $ = await this.fetchCheerio(request);

    const title = $("h2.listmanga-header").first().text().trim();
    const rawImage = $(".boxed img").attr("src") || "";
    const image = rawImage.startsWith("//") ? `https:${rawImage}` : rawImage;
    const description = $(".manga.well p").text().trim();
    const author = $("dt:contains('Author') + dd a").text().trim();

    const ratingMatch = $(".rating")
      .text()
      .match(/Average\s*([\d.]+)/);
    let rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
    rating = rating * 20;

    const statusText = $("dt:contains('Status') + dd span")
      .text()
      .toLowerCase();

    const status = statusText.includes("ongoing")
      ? "ONGOING"
      : statusText.includes("completed")
        ? "COMPLETED"
        : "UNKNOWN";

    const tags: TagSection[] = [];
    const genres: string[] = [];

    $("dd.tag-links a").each((_, element) => {
      genres.push($(element).text().trim());
    });

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
        synopsis: description,
        author: author,
        rating: rating,
        contentRating: ContentRating.EVERYONE,
        status: status,
        tagGroups: tags,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    // Expected mangaId format: 6975-invincible-2003
    const request = {
      url: `${baseUrl}/comic/${sourceManga.mangaId}`,
      method: "GET",
    };
    const $ = await this.fetchCheerio(request);
    const chapters: Chapter[] = [];

    $(".chapters li").each((_, element) => {
      const chapterElement = $(element);
      const titleElement = chapterElement.find("h5.chapter-title-rtl a");
      const chapterTitle = titleElement.text().trim();
      const chapterUrl = titleElement.attr("href") || "";

      // Extract chapter ID from URL
      const chapterId = chapterUrl
        ?.replace(/^https?:\/\/readcomicsonline\.ru\/comic\/[^/]+/g, "")
        .trim();

      // Extract date
      const dateText = chapterElement
        .find(".date-chapter-title-rtl")
        .text()
        .trim();
      const [day, month, year] = dateText.split(" ").map((item, index) => {
        if (index === 1) {
          const monthName = item.replace(".", "");
          return new Date(Date.parse(`${monthName} 1, 2000`)).getMonth() + 1; // Month is 0-indexed
        }
        return parseInt(item);
      });

      const isoDate = `${year}-${String(month).padStart(
        2,
        "0",
      )}-${String(day).padStart(2, "0")}`;

      // Extract chapter number - handle both regular issues and annuals
      let chapNum = 0;
      
      // First try to match regular issue numbers like "#123" or "#123.1"
      const regularMatch = chapterTitle.match(/#(\d+(?:\.\d+)?)/);
      if (regularMatch) {
        chapNum = parseFloat(regularMatch[1]);
      } else {
        // Try to match annual patterns like "#Annual 2022" or "#- Annual 01"
        const annualMatch = chapterTitle.match(/#(?:-\s*)?Annual\s+(\d+)/i);
        if (annualMatch) {
          // Use the year as chapter number for annuals to sort them properly
          chapNum = parseFloat(annualMatch[1]);
        }
      }

      chapters.push({
        chapterId: chapterId,
        title: chapterTitle,
        sourceManga: sourceManga,
        chapNum: chapNum,
        publishDate: new Date(isoDate),
        volume: 0,
        langCode: "🇬🇧",
      });
    });

    return chapters.sort((a, b) => {
      return (a.publishDate?.getTime() || 0) - (b.publishDate?.getTime() || 0);
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

      // Extract images from the HTML structure
      $("#all img").each((_, element) => {
        const dataSrc = $(element).attr("data-src");
        if (dataSrc) {
          // Clean up the URL by trimming whitespace
          const cleanUrl = dataSrc.trim();
          pages.push(cleanUrl);
        }
      });

      // Fallback: try to get the single page from #ppp if #all is empty
      if (pages.length === 0) {
        const singlePageSrc = $("#ppp img").attr("src");
        if (singlePageSrc) {
          pages.push(singlePageSrc.trim());
        }
      }

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

    $("#schedule .schedule-item").each((_, element) => {
      const unit = $(element);
      const titleLink = unit.find(".schedule-name a");
      const title = titleLink.text().trim();
      const rawImage = unit.find(".schedule-avatar img").attr("src") || "";
      const image = rawImage.startsWith("/")
        ? `https://batcave.biz${rawImage}`
        : rawImage;
      const rawMangaId = titleLink.attr("href");
      const mangaId = rawMangaId
        ?.replace(/^https?:\/\/readcomicsonline\.ru\/comic\//, "") // Remove domain prefix if present
        .trim();
      const latestChapter = unit.find(".schedule-date a").text().trim();

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            image: image,
            title: title,
            subtitle: latestChapter,
            type: "simpleCarouselItem",
          }),
        );
      }
    });

    const hasNextPage = false;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
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

    $(".list-group-item").each((_, element) => {
      const unit = $(element);
      const titleLink = unit.find(".chart-title");
      const title = titleLink.text().trim();
      const href = titleLink.attr("href") || "";

      // Extract manga ID from URL: https://readcomicsonline.ru/comic/batman-2016 -> batman-2016
      const mangaId = href
        ?.replace(/^https?:\/\/readcomicsonline\.ru\/comic\//, "") // Remove domain prefix if present
        .trim();

      const rawImage = unit.find("img").attr("src") || "";
      const image = rawImage.startsWith("//")
        ? `https:${rawImage.replace("cover_thumb.jpg", "cover_250x350.jpg")}`
        : rawImage.startsWith("/")
          ? `${baseUrl}${rawImage.replace("cover_thumb.jpg", "cover_250x350.jpg")}`
          : rawImage.replace("cover_thumb.jpg", "cover_250x350.jpg");

      // Extract view count
      const viewText = unit.find(".fa-eye").parent().text().trim();
      const viewCount = viewText.replace(/[^\d]/g, "");

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push({
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          supertitle: `Views: ${viewCount}`,
          type: "featuredCarouselItem",
        });
      }
    });

    // Popular section typically doesn't have pagination
    return {
      items: items,
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

    $(".col-sm-6 .media").each((_, element) => {
      const unit = $(element);
      const titleLink = unit.find(".media-heading a");
      const title = titleLink.text().trim();
      const href = titleLink.attr("href") || "";

      // Extract manga ID from URL: https://readcomicsonline.ru/comic/batman-2016 -> batman-2016
      const mangaId = href
        ?.replace(/^https?:\/\/readcomicsonline\.ru\/comic\//, "") // Remove domain prefix if present
        .trim();

      const rawImage = unit.find(".media-left img").attr("src") || "";
      const image = rawImage.startsWith("//")
        ? `https:${rawImage.replace("cover_thumb.jpg", "cover_250x350.jpg")}`
        : rawImage.startsWith("/")
          ? `${baseUrl}${rawImage.replace("cover_thumb.jpg", "cover_250x350.jpg")}`
          : rawImage.replace("cover_thumb.jpg", "cover_250x350.jpg");

      // Extract latest chapter number
      const chapterLink = unit
        .find("div a[href*='/comic/']")
        .first()
        .text()
        .trim();
      const latestChapter = chapterLink;

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            image: image,
            title: title,
            subtitle: latestChapter,
            type: "simpleCarouselItem",
          }),
        );
      }
    });

    // Check for pagination - look for next page link
    const hasNextPage = !!$(".pagination li a[rel='next']").length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/${mangaId}`;
  }

  checkCloudflareStatus(status: number): void {
    if (status === 503 || status === 403) {
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

export const ReadComicsOnline = new ReadComicsOnlineExtension();
