import {
  BasicRateLimiter,
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
import { URLBuilder } from "../utils/url-builder/base";
import { RawKumaInterceptor } from "./RawKumaInterceptor";

//import { postToDiscordWebhook } from "../utils/discord_debugging";

const baseUrl = "https://rawkuma.com";

type KumaImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class RawKumaExtension implements KumaImplementation {
  requestManager = new RawKumaInterceptor("main");
  globalRateLimiter = new BasicRateLimiter("rateLimiter", {
    numberOfRequests: 15,
    bufferInterval: 1,
    ignoreImages: true,
  });

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.globalRateLimiter.registerInterceptor();
  }

  async getSearchFilters(): Promise<SearchFilter[]> {
    const filters: SearchFilter[] = [];

    filters.push({
      id: "type",
      type: "dropdown",
      options: [
        { id: "", value: "All" },
        { id: "manga", value: "Manga" },
        { id: "manhwa", value: "Manhwa" },
        { id: "manhua", value: "Manhua" },
        { id: "comic", value: "Comic" },
      ],
      value: "",
      title: "Type Filter",
    });

    const genreList = await this.getGenreList();
    if (genreList.length > 0) {
      filters.push({
        id: "genres",
        type: "multiselect",
        title: "Genres",
        options: genreList,
        value: {},
        allowExclusion: true,
        allowEmptySelection: true,
        maximum: undefined,
      });
    }

    return filters;
  }

  private async getGenreList(): Promise<{ id: string; value: string }[]> {
    try {
      const request = {
        url: `${baseUrl}/manga/`,
        method: "GET",
      };

      const $ = await this.fetchCheerio(request);
      const genres: { id: string; value: string }[] = [];

      $("ul.genrez li").each((_, element) => {
        const label = $(element).find("label").text().trim();
        const value = $(element).find("input[type=checkbox]").attr("value");
        if (label && value) {
          genres.push({
            id: value.toLowerCase(),
            value: label,
          });
        }
      });

      return genres;
    } catch (error) {
      console.error("Failed to get genre list:", error);
      return [];
    }
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
    metadata: Thunder.Metadata | undefined,
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

  async getSearchResults(
    query: SearchQuery,
    metadata: { page?: number } | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;

    const urlBuilder = new URLBuilder(baseUrl)
      .addPath("manga")
      .addQuery("title", query.title)
      .addQuery("page", page.toString());

    if (query.filters) {
      for (const filter of query.filters) {
        switch (filter.id) {
          case "type":
          case "status":
            if (filter.value) {
              urlBuilder.addQuery(filter.id, filter.value);
            }
            break;
          case "orderby":
            if (filter.value) {
              urlBuilder.addQuery("order", filter.value);
            }
            break;
          case "author":
            if (filter.value) {
              urlBuilder.addQuery("author", filter.value);
            }
            break;
          case "year":
            if (filter.value) {
              urlBuilder.addQuery("yearx", filter.value);
            }
            break;
          case "genres":
            const genreRecord = filter.value as Record<
              string,
              "included" | "excluded"
            >;
            Object.entries(genreRecord).forEach(([genreId, state]) => {
              const value = state === "excluded" ? `-${genreId}` : genreId;
              urlBuilder.addQuery("genre[]", value);
            });
            break;
        }
      }
    }

    const searchUrl = urlBuilder.build();
    const request = {
      url: searchUrl,
      method: "GET",
    };

    // Handle direct URL searches
    if (query.title.startsWith("https://rawkuma.com/")) {
      try {
        const mangaId = query.title.split("/manga/")[1]?.replace(/\/$/, "");
        if (!mangaId) {
          return { items: [], metadata: undefined };
        }

        const manga = await this.getMangaDetails(mangaId);
        return {
          items: [
            {
              mangaId: mangaId,
              imageUrl: manga.mangaInfo.thumbnailUrl,
              title: manga.mangaInfo.primaryTitle,
              metadata: undefined,
            },
          ],
          metadata: undefined,
        };
      } catch (e) {
        console.error(e);
        return { items: [], metadata: undefined };
      }
    }

    // Regular search
    const $ = await this.fetchCheerio(request);
    const searchResults: SearchResultItem[] = [];

    $(".listupd .bs").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".bsx a");
      const title = unit.find(".tt").text().trim();
      const image = unit.find(".limit img").attr("src") || "";
      const href = infoLink.attr("href");
      const mangaId = href
        ? href.split("/manga/")[1]?.replace(/\/$/, "")
        : undefined;

      if (title && mangaId) {
        searchResults.push({
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          metadata: undefined,
        });
      }
    });

    const hasNextPage = !!$(".panel-page-number .page-blue").next().length;

    return {
      items: searchResults,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    // Expected mangaId: byoujaku-na-akuyaku-reijou-desu-ga-konyakusha-ga-kahogo-sugite-nigedashitai-watashitachi-kenen-no-naka-deshita-yo-ne
    const request = {
      url: `${baseUrl}/manga/${mangaId}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    // Extract basic manga details
    const title = $(".entry-title").text().trim().replace(" Raw", "");
    const altTitles = $(".wd-full:has(b:contains('Alternative'))")
      .find("span")
      .text()
      .split("|")
      .map((t) => t.trim())
      .filter(Boolean);
    const image = $(".thumb img").attr("src") || "";
    const description = $(".entry-content").text().trim();
    const statusText = $(".imptdt")
      .filter((_, el) => $(el).find("i").text().includes("Ongoing"))
      .find("i")
      .text()
      .trim()
      .toLowerCase();

    const status: "ONGOING" | "COMPLETED" | "UNKNOWN" = statusText.includes(
      "ongoing",
    )
      ? "ONGOING"
      : statusText.includes("completed")
        ? "COMPLETED"
        : "UNKNOWN";

    // Extract tags
    const tags: TagSection[] = [];
    const genres: string[] = [];
    let rating = 1;

    // Parse genres
    $(".mgen a").each((_, element) => {
      genres.push($(element).text().trim());
    });

    // Get rating if available
    const ratingText = $(".num").attr("content");
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
    // Expected mangaId: byoujaku-na-akuyaku-reijou-desu-ga-konyakusha-ga-kahogo-sugite-nigedashitai-watashitachi-kenen-no-naka-deshita-yo-ne
    const request = {
      url: `${baseUrl}/manga/${sourceManga.mangaId}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const chapters: Chapter[] = [];

    $(".clstyle li").each((_, element) => {
      const li = $(element);
      const link = li.find(".eph-num a");
      const href = link.attr("href");

      if (!href) {
        return;
      }

      // Expected chapterId: byoujaku-na-akuyaku-reijou-desu-ga-konyakusha-ga-kahogo-sugite-nigedashitai-watashitachi-kenen-no-naka-deshita-yo-ne-chapter-19-4
      const chapterId = href.replace(baseUrl, "").replace(/^\/|\/$/g, "");
      const chapterNum = li.attr("data-num");
      const title = link.find(".chapternum").text().trim();
      const date = link.find(".chapterdate").text().trim();

      chapters.push({
        chapterId: chapterId,
        title: title,
        sourceManga: sourceManga,
        chapNum: chapterNum ? parseFloat(chapterNum) : 0,
        volume: undefined,
        langCode: "🇯🇵",
        publishDate: new Date(date),
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
      let pages: string[] = [];

      const html = $.html();
      const scriptContent = $("script")
        .map((_, script) => $(script).html() || "")
        .get()
        .join("\n");

      const imgSrcPattern = /var\s+imageList\s*=\s*(\[.*?\])/s;
      const imageListMatch = scriptContent.match(imgSrcPattern);

      const isValidChapterImage = (url: string): boolean => {
        // Exclude website assets and icons
        if (
          url.includes("/wp-content/uploads/2024/") &&
          (url.includes("-Icon-") ||
            url.includes("-logo-") ||
            url.includes("rawkuma"))
        ) {
          return false;
        }

        // Include cdn images that look like chapter images
        if (url.includes("cdn.kumacdn.club") && url.includes("/chapter-")) {
          return true;
        }

        return false;
      };

      if (imageListMatch && imageListMatch[1]) {
        try {
          const cleanJson = imageListMatch[1]
            .replace(/'/g, '"')
            .replace(/,\s*]/g, "]");
          const imageList = JSON.parse(cleanJson);
          if (Array.isArray(imageList)) {
            pages = imageList
              .filter((img) => typeof img === "string")
              .filter(isValidChapterImage);
          }
        } catch (err) {
          console.error("Failed to parse JSON image list:", err);
        }
      }

      if (pages.length === 0) {
        const altPatterns = [
          /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
          /data-src=["']([^"']+)["']/gi,
        ];

        for (const pattern of altPatterns) {
          let match;
          while ((match = pattern.exec(html)) !== null) {
            const imgUrl = match[1];
            if (
              imgUrl &&
              !pages.includes(imgUrl) &&
              isValidChapterImage(imgUrl)
            ) {
              pages.push(imgUrl);
            }
          }
        }
      }

      return {
        id: chapter.chapterId,
        mangaId: chapter.sourceManga.mangaId,
        pages: pages,
      };
    } catch (error) {
      console.error(error);
      throw error;
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

    $(".listupd .utao").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".imgu a");
      const title = unit.find(".luf h3").text().trim();
      const image = unit.find(".imgu img").attr("src") || "";
      const href = infoLink.attr("href");
      const mangaId = href
        ? href.split("/manga/")[1]?.replace(/\/$/, "")
        : undefined;
      // Expected mangaId: byoujaku-na-akuyaku-reijou-desu-ga-konyakusha-ga-kahogo-sugite-nigedashitai-watashitachi-kenen-no-naka-deshita-yo-ne

      const latestChapter = unit.find(".luf ul li").first();
      const chapterText = latestChapter.find("a").text().trim();
      const timeAgo = latestChapter.find("span").text().trim();
      const subtitle = `${chapterText} - ${timeAgo}`;

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
    const hasNextPage = !!$(".hpage .r").length;

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

    $(".serieslist.pop.wpop.wpop-alltime li").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".imgseries a");
      const title = unit.find("h2 a").text().trim();
      const image = unit.find(".imgseries img").attr("src") || "";
      const href = infoLink.attr("href");
      const mangaId = href
        ? href.split("/manga/")[1]?.replace(/\/$/, "")
        : undefined;
      const rank = unit.find(".ctr").text().trim();
      const genres = unit
        .find("span a")
        .map((_, el) => $(el).text())
        .get()
        .join(", ");

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push({
          type: "featuredCarouselItem",
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          supertitle: `#${rank}`,
          metadata: undefined,
        });
      }
    });

    // Check if there's a next page
    const hasNextPage = false;

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
      url: `${baseUrl}/manga/?order=latest`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".listupd .bs").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".bsx a");
      const title = unit.find(".tt").text().trim();
      const image = unit.find(".limit img").attr("src") || "";
      const href = infoLink.attr("href");
      const mangaId = href
        ? href.split("/manga/")[1]?.replace(/\/$/, "")
        : undefined;
      const latestChapter = unit.find(".epxs").text().trim();
      const rating = unit.find(".numscore").text().trim();

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

    // Check if there's a next page by looking for the "Next" link
    const hasNextPage = !!$(".hpage .r").length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getCloudflareBypassRequestAsync(): Promise<Request> {
    return {
      url: `${baseUrl}/`,
      method: "GET",
      headers: {
        referer: `${baseUrl}/`,
        origin: `${baseUrl}/`,
        "user-agent": await Application.getDefaultUserAgent(),
      },
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

export const RawKuma = new RawKumaExtension();
