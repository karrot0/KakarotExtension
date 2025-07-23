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
import * as htmlparser2 from "htmlparser2";
import { URLBuilder } from "../utils/url-builder/base";
import { NHentaiInterceptor } from "./interceptors";
import {
  NHentaiMetadata,
} from "./model";

const baseUrl = "https://nhentai.net";

type NHentaiImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class NHentaiExtension implements NHentaiImplementation {
  requestManager = new NHentaiInterceptor("main");
  globalRateLimiter = new BasicRateLimiter("rateLimiter", {
    numberOfRequests: 10,
    bufferInterval: 1,
    ignoreImages: true,
  });

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.globalRateLimiter.registerInterceptor();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "popular_section",
        title: "Popular",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "new_uploads",
        title: "New Uploads",
        type: DiscoverSectionType.simpleCarousel,
      }
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: NHentaiMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "popular_section":
        return this.getPopularSectionItems(section, metadata);
      case "new_uploads":
        return this.getNewUploadsSectionItems(section, metadata);
      default:
        return { items: [] };
    }
  }

  private async getSearchDetails() {
    try {
      const request = {
        url: `${baseUrl}/filter`,
        method: "GET",
      };

      const $ = await this.fetchCheerio(request);
      const types: { id: string; label: string }[] = [];
      const genres: { id: string; label: string }[] = [];
      const status: { id: string; label: string }[] = [];
      const languages: { id: string; label: string }[] = [];
      const years: { id: string; label: string }[] = [];
      const lengths: { id: string; label: string }[] = [];
      const sorts: { id: string; label: string }[] = [];

      $(
        ".dropdown:has(button .value[data-placeholder='Type']) .dropdown-menu.noclose.c1 li",
      ).each((_, element) => {
        const id = $(element).find("input").attr("value") ?? "";
        const label = $(element).find("label").text().trim();
        if (label) {
          types.push({ id, label });
        }
      });

      $(".genres li").each((_, element) => {
        const id = $(element).find("input").attr("value") ?? "";
        const label = $(element).find("label").text().trim();
        if (label && id) {
          genres.push({ id, label });
        }
      });

      $(
        ".dropdown:has(button .value[data-placeholder='Status']) .dropdown-menu.noclose.c1 li",
      ).each((_, element) => {
        const id = $(element).find("input").attr("value") ?? "";
        const label = $(element).find("label").text().trim();
        if (label && id) {
          status.push({ id, label });
        }
      });

      $(
        ".dropdown:has(button .value[data-placeholder='Language']) .dropdown-menu.noclose.c1 li",
      ).each((_, element) => {
        const id = $(element).find("input").attr("value") ?? "";
        const label = $(element).find("label").text().trim();
        if (label && id) {
          languages.push({ id, label });
        }
      });

      $(
        ".dropdown:has(button .value[data-placeholder='Year']) .dropdown-menu.noclose.md.c3 li",
      ).each((_, element) => {
        const id = $(element).find("input").attr("value") ?? "";
        const label = $(element).find("label").text().trim();
        if (label && id) {
          years.push({ id, label });
        }
      });

      $(
        ".dropdown:has(button .value[data-placeholder='Length']) .dropdown-menu.noclose.c1 li",
      ).each((_, element) => {
        const id = $(element).find("input").attr("value") ?? "";
        const label = $(element).find("label").text().trim();
        if (label && id) {
          lengths.push({ id, label });
        }
      });

      $(
        ".dropdown:has(button .value[data-placeholder='Sort']) .dropdown-menu.noclose.c1 li",
      ).each((_, element) => {
        const id = $(element).find("input").attr("value") ?? "";
        const label = $(element).find("label").text().trim();
        if (label && id) {
          sorts.push({ id, label });
        }
      });

      return {
        types: types,
        genres: genres,
        status: status,
        languages: languages,
        years: years,
        lengths: lengths,
        sorts: sorts,
      };
    } catch (error) {
      console.error("Error fetching search details:", error);
    }
  }

  async getSearchFilters(): Promise<SearchFilter[]> {
    const filters: SearchFilter[] = [];
    const searchDetails = await this.getSearchDetails();
    filters.push({
      id: "type",
      type: "dropdown",
      options: [
        { id: "all", value: "All" },
        ...(searchDetails?.types?.map((t) => ({ id: t.id, value: t.label })) ||
          []),
      ],
      value: "all",
      title: "Type Filter",
    });

    filters.push({
      id: "genres",
      type: "multiselect",
      options:
        searchDetails?.genres?.map((g) => ({ id: g.id, value: g.label })) || [],
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
        ...(searchDetails?.status?.map((s) => ({ id: s.id, value: s.label })) ||
          []),
      ],
      value: "all",
      title: "Status Filter",
    });

    filters.push({
      id: "language",
      type: "dropdown",
      options: [
        { id: "all", value: "All" },
        ...(searchDetails?.languages?.map((l) => ({
          id: l.id,
          value: l.label,
        })) || []),
      ],
      value: "all",
      title: "Language Filter",
    });

    filters.push({
      id: "year",
      type: "dropdown",
      options: [
        { id: "all", value: "All" },
        ...(searchDetails?.years?.map((y) => ({ id: y.id, value: y.label })) ||
          []),
      ],
      value: "all",
      title: "Year Filter",
    });

    filters.push({
      id: "length",
      type: "dropdown",
      options: [
        { id: "all", value: "All" },
        ...(searchDetails?.lengths?.map((l) => ({
          id: l.id,
          value: l.label,
        })) || []),
      ],
      value: "all",
      title: "Length Filter",
    });

    return filters;
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: { page?: number } | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;

    if (!query.title || query.title.trim() === "") {
      const result = await this.getNewUploadsSectionItems({
        id: "new_uploads",
        title: "New Uploads",
        type: DiscoverSectionType.simpleCarousel,
      }, { page });
      return {
        items: result.items.map(item => {
          const dItem = item as {
            mangaId: string;
            imageUrl: string;
            title: string;
            subtitle?: string;
          };
          return {
            mangaId: dItem.mangaId,
            imageUrl: dItem.imageUrl,
            title: dItem.title,
            subtitle: dItem.subtitle,
            metadata: undefined,
          };
        }),
        metadata: result.metadata,
      };
    }

    const searchUrl = new URLBuilder(baseUrl)
      .addPath("search")
      .addQuery("q", encodeURIComponent(query.title ?? ""))
      .addQuery("page", page.toString());

    const url = searchUrl.build();

    const request = { url, method: "GET" };

    const $ = await this.fetchCheerio(request);
    const searchResults: SearchResultItem[] = [];

    $(".container.index-container .gallery").each((_, element) => {
      const gallery = $(element);
      const link = gallery.find("a.cover");
      const href = link.attr("href") || "";
      const mangaId = typeof href === "string" ? href.replace(/\/g\/(\d+)\//, "$1") : "";
      const img = link.find("img");
      const image =
        typeof img.attr("data-src") === "string" ? img.attr("data-src") :
        typeof img.attr("src") === "string" ? img.attr("src") : "";
      const title = typeof link.find(".caption").text() === "string" ? link.find(".caption").text().trim() : "";
      const subtitle = undefined;

      if (!title || !mangaId) {
        return;
      }

      searchResults.push({
        mangaId: mangaId,
        imageUrl: image ?? "",
        title: title,
        subtitle: subtitle,
        metadata: undefined,
      });
    });

    const hasNextPage = !!$("section.pagination a.next").length;

    return {
      items: searchResults,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = {
      url: new URLBuilder(baseUrl).addPath("g").addPath(mangaId).build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    const title = $(".title .pretty").first().text().trim();
    const altTitles: string[] = [];
    $(".title").each((_, el) => {
      const alt = $(el).text().trim();
      if (alt && alt !== title) altTitles.push(alt);
    });

    const image =
      $("#cover img").attr("data-src") ||
      $("#cover img").attr("src") ||
      "";

    const description = "";

    const status: "ONGOING" | "COMPLETED" | "UNKNOWN" = "UNKNOWN";

    const tags: TagSection[] = [];
    $("#tags .tag-container").each((_, el) => {
      const sectionTitle = $(el).contents().first().text().replace(":", "").trim();
      const tagList: { id: string; title: string }[] = [];
      $(el)
      .find(".tags a.tag")
      .each((_, tagEl) => {
        const id =
        $(tagEl).attr("href")?.split("/").filter(Boolean).pop() ||
        $(tagEl).find(".name").text().trim().toLowerCase().replace(/\s+/g, "-");
        const title = $(tagEl).find(".name").text().trim();
        if (id && title) tagList.push({ id, title });
      });
      if (tagList.length > 0) {
      tags.push({
        id: sectionTitle.toLowerCase(),
        title: sectionTitle,
        tags: tagList,
      });
      }
    });

    const rating = 0;

    const authors: string[] = [];
    $("#tags .tag-container:contains('Artists') .tags a.tag").each((_, el) => {
      const name = $(el).find(".name").text().trim();
      if (name) authors.push(name);
    });

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
    const chapters: Chapter[] = [];

    chapters.push({
      chapterId: sourceManga.mangaId,
      title: sourceManga.mangaInfo.primaryTitle,
      sourceManga,
      chapNum: 1,
      publishDate: undefined,
      volume: 1,
      langCode: "N/A"
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const request = {
      url: new URLBuilder(baseUrl).addPath("g").addPath(chapter.chapterId).build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    const thumbContainers = $(".thumbs .thumb-container");
    const numberOfPages = thumbContainers.length;

    const images: string[] = [];

    const pageUrls = Array.from({ length: numberOfPages }, (_, i) => `${baseUrl}/g/${chapter.chapterId}/${i + 1}/`);
    const pageRequests = pageUrls.map(url => this.fetchCheerio({ url, method: "GET" }));

    const pageCheerios = await Promise.all(pageRequests);

    for (const page$ of pageCheerios) {
      const imgUrl =
      page$("#image-container img").attr("data-src") ||
      page$("#image-container img").attr("src") ||
      "";

      if (imgUrl) {
        images.push(imgUrl);
      }
    }

    return {
      mangaId: chapter.sourceManga.mangaId,
      id: chapter.chapterId,
      pages: images,
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/manga/${mangaId}`;
  }

  async getPopularSectionItems(
    section: DiscoverSection,
    metadata: NHentaiMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: baseUrl,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".container.index-popular .gallery").each((_, element) => {
      const gallery = $(element);
      const link = gallery.find("a.cover");
      const href = link.attr("href") || "";

      const mangaId = href.replace(/\/g\/(\d+)\//, "$1");

      const img = link.find("img");
      const image =
        img.attr("data-src") ||
        img.attr("src") ||
        "";
      const title = link.find(".caption").text().trim();

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

    const hasNextPage = false;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getNewUploadsSectionItems(
    section: DiscoverSection,
    metadata: NHentaiMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: `${baseUrl}/?page=${page}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".container.index-container .gallery").each((_, element) => {
      if ($(element).closest(".index-popular").length > 0) return;

      const gallery = $(element);
      const link = gallery.find("a.cover");
      const href = link.attr("href") || "";

      const mangaId = href.replace(/\/g\/(\d+)\//, "$1");

      const img = link.find("img");
      const image =
      img.attr("data-src") ||
      img.attr("src") ||
      "";
      const title = link.find(".caption").text().trim();

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

    const hasNextPage = !!$("section.pagination a.next").length;

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

export const NHentai = new NHentaiExtension();
