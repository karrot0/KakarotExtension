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
import { FireInterceptor } from "./MangaFireInterceptor";

const baseUrl = "https://mangafire.to";

type MangaFireImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class MangaFireExtension implements MangaFireImplementation {
  requestManager = new FireInterceptor("main");

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

    Application.registerSearchFilter({
      id: "type",
      type: "dropdown",
      options: [
        { id: "all", value: "All" },
        { id: "manhua", value: "Manhua" },
        { id: "manhwa", value: "Manhwa" },
        { id: "manga", value: "Manga" },
      ],
      value: "all",
      title: "Type Filter",
    });

    Application.registerSearchFilter({
      id: "genres",
      type: "multiselect",
      options: [
        { id: "all", value: "All" },
        { id: "action", value: "Action" },
        { id: "adventure", value: "Adventure" },
        { id: "comedy", value: "Comedy" },
        { id: "drama", value: "Drama" },
        { id: "ecchi", value: "Ecchi" },
        { id: "fantasy", value: "Fantasy" },
        { id: "horror", value: "Horror" },
        { id: "mature", value: "Mature" },
        { id: "romance", value: "Romance" },
        { id: "sci-fi", value: "Sci-Fi" },
        { id: "shoujo", value: "Shoujo" },
        { id: "shounen", value: "Shounen" },
        { id: "slice-of-life", value: "Slice of Life" },
        { id: "sports", value: "Sports" },
        { id: "supernatural", value: "Supernatural" },
      ],
      allowExclusion: true,
      value: { all: "included" },
      title: "Genre Filter",
      allowEmptySelection: true,
      maximum: undefined,
    });

    Application.registerSearchFilter({
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
        id: "genres_section",
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
      case "genres_section":
        return this.getFilterSection();
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
      .addQuery("page", page.toString());

    const getFilterValue = (id: string) =>
      query.filters.find((filter) => filter.id == id)?.value;

    const type = getFilterValue("type");
    const genres = getFilterValue("genres");
    const status = getFilterValue("status");
    const sortBy = getFilterValue("sortBy");

    if (type && type != "all") {
      searchUrl.addQuery("type[]", type);
    }

    if (genres && genres != "all") {
      searchUrl.addQuery("genre[]", genres);
    }

    if (status && status != "all") {
      searchUrl.addQuery(
        "status[]",
        status === "ongoing" ? "releasing" : "completed",
      );
    }

    if (sortBy) {
      let sort = "most_relevance";
      switch (sortBy) {
        case "latest":
          sort = "recently_updated";
          break;
        case "oldest":
          sort = "oldest";
          break;
      }
      searchUrl.addQuery("sort", sort);
    }

    const request = {
      url: searchUrl.build(),
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
    // const request = {
    //   url: new URLBuilder(baseUrl)
    //     .addPath("manga")
    //     .addPath(sourceManga.mangaId)
    //     .build(),
    //   method: "GET",
    // };
    // example https://mangafire.to/ajax/read/0w5k/chapter/en
    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("ajax")
        .addPath("read")
        .addPath(sourceManga.mangaId.split(".")[1])
        .addPath("chapter")
        .addPath("en")
        .build(),
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(request);

    const r: MangaFire.Result = JSON.parse(
      Application.arrayBufferToUTF8String(buffer),
    ) as MangaFire.Result;
    const $ = cheerio.load(r.result.html);

    const chapters: Chapter[] = [];

    $("li").each((_, element) => {
      // console.log();
      const li = $(element);
      const link = li.find("a");
      const chapterId = link.attr("data-id") || "0";
      const title = link.find("span").first().text().trim();
      // Extract chapter number from data-number attribute
      const chapterNumber = parseFloat(link.attr("data-number") || "0");

      chapters.push({
        chapterId: chapterId,
        title: title,
        sourceManga: sourceManga,
        chapNum: chapterNumber,
        // creationDate: new Date(date),
        volume: undefined,
        langCode: "🇬🇧",
      });
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    console.log(`Parsing chapter ${chapter.chapterId}`);
    try {
      // Utilizing ajax API
      // Example: https://mangafire.to/ajax/read/chapter/3832635
      const url = new URLBuilder(baseUrl)
        .addPath("ajax")
        .addPath("read")
        .addPath("chapter")
        .addPath(chapter.chapterId)
        .build();

      console.log(url);

      const request: Request = {
        url,
        method: "GET",
      };

      const [_, buffer] = await Application.scheduleRequest(request);
      const json: MangaFire.PageResponse = JSON.parse(
        Application.arrayBufferToUTF8String(buffer),
      ) as MangaFire.PageResponse;

      const pages: string[] = [];
      json.result.images.forEach((value: MangaFire.ImageData) => {
        pages.push(value[0]);
      });
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

  async getNewMangaSectionItems(
    section: DiscoverSection,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: new URLBuilder(baseUrl).addPath("added").build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".unit .inner").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".info > a").last();
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

  async getFilterSection(): Promise<PagedResults<DiscoverSectionItem>> {
    const items = [
      { id: "manhua", name: "Manhua", type: "type" },
      { id: "manhwa", name: "Manhwa", type: "type" },
      { id: "manga", name: "Manga", type: "type" },
      { id: "action", name: "Action", type: "genres" },
      { id: "adventure", name: "Adventure", type: "genres" },
      { id: "comedy", name: "Comedy", type: "genres" },
      { id: "drama", name: "Drama", type: "genres" },
      { id: "ecchi", name: "Ecchi", type: "genres" },
      { id: "fantasy", name: "Fantasy", type: "genres" },
      { id: "horror", name: "Horror", type: "genres" },
      { id: "mature", name: "Mature", type: "genres" },
      { id: "romance", name: "Romance", type: "genres" },
      { id: "sci-fi", name: "Sci-Fi", type: "genres" },
      { id: "shoujo", name: "Shoujo", type: "genres" },
      { id: "shounen", name: "Shounen", type: "genres" },
      { id: "slice-of-life", name: "Slice of Life", type: "genres" },
      { id: "sports", name: "Sports", type: "genres" },
      { id: "supernatural", name: "Supernatural", type: "genres" },
    ];

    return {
      items: items.map((item) => ({
        type: "genresCarouselItem",
        searchQuery: {
          title: "",
          filters: [{ id: item.type, value: item.id }],
        },
        name: item.name,
        metadata: undefined,
      })),
      metadata: undefined,
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
