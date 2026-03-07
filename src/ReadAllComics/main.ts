import {
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
  CloudflareBypassRequestProviding &
  DiscoverSectionProviding;

export class ReadAllComicsExtension implements ReadAllComicsImplementation {
  cookieStorageInterceptor = new CookieStorageInterceptor({storage: "stateManager"})
  requestManager = new ReadAllComicsInterceptor("main");

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
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
    const collectedIds: string[] = metadata?.collectedIds ?? [];
    const page: number = metadata?.page ?? 1;
    const searchTerm = query.title ?? "";

    // If search term is empty, show catalogue section instead
    if (!searchTerm.trim()) {
      const section: DiscoverSection = {
        id: "catalogue_section",
        title: "Catalogue",
        type: DiscoverSectionType.simpleCarousel,
      };
      // Simply forward to the catalogue logic, preserving metadata for pagination
      const catalogue = await this.getCatalogueSectionItems(section, {
        page,
        collectedIds,
      });

      // convert DiscoverSectionItem -> SearchResultItem
      const results: SearchResultItem[] = catalogue.items.map((item) => ({
        mangaId: item.mangaId,
        imageUrl: item.imageUrl,
        title: item.title,
        subtitle: item.subtitle,
        metadata: undefined,
      }));

      return {
        items: results,
        metadata: catalogue.metadata,
      };
    }

    // Original search logic for when search term is provided
    const request = {
      url: `${baseUrl}/?story=${encodeURIComponent(searchTerm)}&s=&type=comic`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const results: SearchResultItem[] = [];
    const newCollectedIds = [...collectedIds];

    $(".list-story.categories > li").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find("a.cat-title");

      const title = infoLink.text().trim();
      const imageEl = unit.find("img.book-cover");
      const rawImage = imageEl.attr("data-src") || imageEl.attr("src") || "";
      const image = rawImage;
      const categoryLink = unit.find("a.book-link").attr("href") || "";

      const mangaIdMatch = categoryLink.match(/category\/([^/]+)\//);
      const mangaId = mangaIdMatch ? mangaIdMatch[1] : "";

      const dateText = unit.find(".latest-date").text().replace("Updated:", "").trim();
      const totalIssues = unit.find(".cat-total-issues").text().trim();
      const fullSubtitle = totalIssues ? `${dateText} | ${totalIssues}` : dateText;

      if (title && mangaId && !newCollectedIds.includes(mangaId)) {
        newCollectedIds.push(mangaId);
        results.push({
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          subtitle: fullSubtitle,
          metadata: undefined,
        });
      }
    });

    return {
      items: results,
      metadata: undefined,
    };
  }

  private async getMangaIdFromChapter(chapterId: string): Promise<string> {
    const request = {
      url: `${baseUrl}/${chapterId}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    const categoryHref = $(".pinbin-category a[href*='/category/']").attr("href") || "";
    const mangaId = categoryHref.split("/").filter(Boolean).pop();

    if (!mangaId) {
      throw new Error("Manga ID not found");
    }

    return mangaId;
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
    let hasNextPage = false;
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

    for (const element of $(".posts-grid > article.post-item").toArray()) {
      const unit = $(element);
      const linkEl = unit.find(".post-thumbnail a");
      const imageEl = unit.find(".post-thumbnail img");
      const titleEl = unit.find(".post-title a");
      const dateEl = unit.find(".post-date");

      const title = titleEl.text().trim();
      const image = imageEl.attr("src") || "";
      const postUrl = linkEl.attr("href") || "";
      // ChapterId: extract from URL, e.g. https://readallcomics.com/valiant-beyond-tales-of-the-shadowman-006-ghosts-of-the-bayou-part-3-of-3-2026/ => valiant-beyond-tales-of-the-shadowman-006-ghosts-of-the-bayou-part-3-of-3-2026
      const chapterId = postUrl.match(/readallcomics\.com\/([^/]+)\/?/);
      const chapterIdMatch = chapterId ? chapterId[1] : "";
      const mangaId = await this.getMangaIdFromChapter(chapterIdMatch);

      const dateText = dateEl.text().trim();
      const fullSubtitle = dateText;

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            image: image,
            title: title,
            subtitle: fullSubtitle,
            type: "simpleCarouselItem",
          }),
        );
      }
    }

    $(".pagination .page-numbers").each((_, element) => {
      const pageNumber = $(element).text().trim();
      if (pageNumber && !isNaN(Number(pageNumber))) {
      hasNextPage = Number(pageNumber) > page;
      }
    });

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/category/${mangaId}`;
  }

  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    // Clear all the cookies
    for (const cookie of cookies) {
      this.cookieStorageInterceptor.deleteCookie(cookie);
    }

    // Set all the cookies
    for (const cookie of cookies) {
      this.cookieStorageInterceptor.setCookie(cookie);
    }
  }

  async checkCloudflareStatus(status: number): Promise<void> {

    console.log(this.cookieStorageInterceptor.cookies);
    switch (status) {
      case 503:
      case 403:
        console.log(`Cloudflare protection detected. Status: ${status}`);
        throw new CloudflareError(
          {
            url: baseUrl,
            method: "GET",
            headers: {
              referer: baseUrl,
              origin: baseUrl,
            },
          },
          "Cloudflare bypass required, please complete the challenge."
        );
      case 404:
        throw new Error("Content not found");
    }
  }

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const [response, data] = await Application.scheduleRequest(request);
    await this.checkCloudflareStatus(response.status);
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
