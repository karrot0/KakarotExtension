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
import { ReadAllComicsInterceptor } from "./interceptors";
import { ReadAllComicsMetadata } from "./model";

const baseUrl = "https://readallcomics.com";

type ReadAllComicsImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class ReadAllComicsExtension implements ReadAllComicsImplementation {
  requestManager = new ReadAllComicsInterceptor("main");

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "catalogue_section",
        title: "Catalogue",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: ReadAllComicsMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "catalogue_section":
        return this.getCatalogueSectionItems(section, metadata);
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

    if (!query.title) {
      const catalogueResults = await this.getCatalogueSectionItems(
        {
          id: "catalogue_section",
          title: "",
          type: DiscoverSectionType.simpleCarousel,
        },
        metadata,
      );
      return {
        items: catalogueResults.items
          .map((item) => {
            if (item.type === "simpleCarouselItem") {
              const searchItem: SearchResultItem = {
                mangaId: item.mangaId,
                title: item.title,
                imageUrl: item.imageUrl,
                subtitle: item.subtitle,
                metadata: item.metadata,
              };
              return searchItem;
            }
            return null;
          })
          .filter((item): item is SearchResultItem => item !== null),
        metadata: catalogueResults.metadata,
      };
    }

    const urlBuilder = new URLBuilder(baseUrl)
      .addPath("search")
      .addPath(query.title);

    if (page > 1) {
      urlBuilder.addPath("page").addPath(page.toString());
    }

    const searchUrl = urlBuilder;

    // Get filter values
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const getFilterValue = (id: string) =>
      query.filters.find((filter) => filter.id == id)?.value;

    const request = { url: searchUrl.build(), method: "GET" };

    const $ = await this.fetchCheerio(request);
    const searchResults: SearchResultItem[] = [];

    $(".readed").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".readed__title a");
      const title = infoLink.text().trim();
      const rawImage = unit.find("img").attr("data-src") || "";
      const image = rawImage.startsWith("/")
        ? `https://batcave.biz${rawImage}`
        : rawImage;
      const rawMangaId = infoLink.attr("href");
      const mangaId = rawMangaId
        ?.replace(/^https?:\/\/batcave\.biz\//, "") // Remove domain prefix if present
        .replace(/\.html$/, "") // Remove the ".html" extension
        .trim();
      const latestChapterText = unit
        .find(".readed__info li:last-child")
        .text()
        .trim();
      const latestChapter = latestChapterText
        .replace("Last issue:", "")
        .trim()
        .replace(/.*#(\d+).*/, "#$1");

      if (!mangaId) return;

      searchResults.push({
        mangaId: mangaId,
        imageUrl: image,
        title: title,
        subtitle: latestChapter,
        metadata: undefined,
      });
    });

    const currentPage =
      parseInt($(".pagination__pages > span").first().text()) || 1;
    const hasNextPage =
      $(".pagination__pages > a").filter((_, el) => {
        const pageNum = parseInt($(el).text());
        return !isNaN(pageNum) && pageNum > currentPage;
      }).length > 0;

    return {
      items: searchResults,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    // Expected mangaId: 6975-invincible-2003
    const request = { url: `${baseUrl}/category/${mangaId}`, method: "GET" };

    const $ = await this.fetchCheerio(request);

    const title = $("h1").first().text().trim();
    const rawImage = $(".description-archive img").first().attr("src") || "";
    const image = rawImage.startsWith("/")
      ? `https://2.bp.blogspot.com${rawImage}`
      : rawImage;

    const description = $(".b strong")
      .map((_, el) => $(el).parent().text().trim())
      .get()
      .filter(
        (text) =>
          !text.startsWith("Vol") &&
          !text.includes("Publisher:") &&
          !text.includes("Genres:"),
      )
      .join("\n")
      .trim();

    // Status is always ONGOING for comics unless explicitly stated as completed
    const status = "ONGOING";

    // Rating - No rating shown on the site, default to 0
    const rating = 0;

    const tags: TagSection[] = [];
    const genreText = $(".b strong")
      .filter((_, el) => {
        const prevText = $(el).parent().text().trim();
        return prevText.includes("Genres:");
      })
      .first()
      .text();
    const genres = genreText.split(",").map((g) => g.trim());
    const publisher = $(".b strong")
      .filter((_, el) => {
        const prevText = $(el).parent().text().trim();
        return prevText.includes("Publisher:");
      })
      .first()
      .parent()
      .text()
      .trim()
      .replace("Publisher:", "")
      .trim();

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
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const request = {
      url: `${baseUrl}/category/${sourceManga.mangaId}`,
      method: "GET",
    };
    const $ = await this.fetchCheerio(request);

    const chapters: Chapter[] = [];

    $(".list-story li").each((_, element) => {
      const link = $(element).find("a");
      const url = link.attr("href") || "";
      const title = link.text().trim();

      const yearMatch = title.match(/\((\d{4})\)/);
      const year = yearMatch?.[1] ?? "2000";
      // Get volume number from title (e.g., "v1", "v2")
      const volumeMatch = title.match(/v(\d+)/i);
      const volNum = volumeMatch?.[1] ? parseInt(volumeMatch[1]) : 0;

      // Handle special cases where chapter number is the year
      const chapterMatch = title.match(/(?:v\d+\s)?(\d+)/);
      const chapNum = chapterMatch?.[1]
        ? parseInt(chapterMatch[1]) > 2000
          ? 0
          : parseInt(chapterMatch[1])
        : 0;

      // Get chapter ID from URL
      const urlParts = url.split("/").filter(Boolean);
      const chapterId = urlParts[urlParts.length - 1];

      chapters.push({
        chapterId: chapterId,
        title: title,
        sourceManga,
        chapNum: chapNum, // Use simple incrementing number
        publishDate: new Date(year),
        volume: volNum,
        langCode: "🇬🇧",
      });
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    try {
      const request = {
        url: `${baseUrl}/${chapter.chapterId}`,
        method: "GET",
      };

      const $ = await this.fetchCheerio(request);
      const pages: string[] = [];

      $('img[decoding="async"]').each((_, element) => {
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

  async getCatalogueSectionItems(
    section: DiscoverSection,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const urlBuilder = new URLBuilder(baseUrl);

    if (page > 1) {
      urlBuilder.addPath("page").addPath(page.toString());
    }

    const request = {
      url: urlBuilder.build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $("#post-area .post").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".pinbin-copy a");
      const title = infoLink.attr("title")?.trim() || infoLink.text().trim();
      const imageEl = unit.find("img");
      const rawImage = imageEl.attr("data-src") || imageEl.attr("src") || "";
      const image = rawImage.startsWith("/")
        ? `https://2.bp.blogspot.com${rawImage}`
        : rawImage;
      const rawMangaId =
        unit.attr("class")?.match(/category-([^\s]+)/)?.[1] ?? "";
      const mangaId = rawMangaId || "";
      const dateText = unit.find(".pinbin-copy span").text().trim();

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            image: image,
            title: title,
            subtitle: dateText,
            type: "simpleCarouselItem",
          }),
        );
      }
    });

    const currentPage = $(".pagination__pages > span").first().text();
    const hasNextPage =
      $(".pagination__pages > a").filter(
        (_, el) => parseInt($(el).text()) > parseInt(currentPage),
      ).length > 0;

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

export const ReadAllComics = new ReadAllComicsExtension();
