import {
  BasicRateLimiter,
  Chapter,
  ChapterDetails,
  ChapterProviding,
  CloudflareBypassRequestProviding,
  CloudflareError,
  ContentRating,
  DiscoverSection,
  DiscoverSectionItem,
  DiscoverSectionProviding,
  DiscoverSectionType,
  Extension,
  Form,
  LibraryItemSourceLinkProposal,
  ManagedCollection,
  ManagedCollectionChangeset,
  ManagedCollectionProviding,
  MangaProviding,
  PagedResults,
  PaperbackInterceptor,
  Request,
  Response,
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SettingsFormProviding,
  SourceManga,
  Tag,
  TagSection,
  UpdateManager,
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
    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("manga")
        .addQuery("latest", "1")
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const units = $(".unit");

    const results: DiscoverSectionItem[] = [];

    units.each((_, element) => {
      const unit = $(element);
      const poster = unit.find(".poster");
      const title = unit.find(".info > a").text().trim();
      const image = unit.find("img").attr("src") || "";
      const mangaId = poster.attr("href")?.replace("/manga/", "") || "";

      results.push(
        createDiscoverSectionItem({
          id: mangaId,
          image: image,
          title: title,
          type: "simpleCarouselItem",
        }),
      );
    });

    const section = createDiscoverSection({
      id: "recently_updated",
      title: "Recently Updated",
      items: results,
      type: "singlerow",
    });

    return [section];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: unknown | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = (metadata as { page?: number } | undefined)?.page ?? 1;

    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("manga")
        .addQuery("latest", "1")
        .addQuery("page", page.toString())
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const units = $(".unit");

    const results: DiscoverSectionItem[] = [];

    units.each((_, element) => {
      const unit = $(element);
      const poster = unit.find(".poster");
      const title = unit.find(".info > a").text().trim();
      const image = unit.find("img").attr("src") || "";
      const mangaId = poster.attr("href")?.replace("/manga/", "") || "";

      results.push(
        createDiscoverSectionItem({
          id: mangaId,
          image: image,
          title: title,
          type: "simpleCarouselItem",
        }),
      );
    });

    const hasNextPage = !!$(".page-item.active + .page-item .page-link").length;

    return {
      items: results,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
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
    const title = $(".detail h1").text().trim();
    const image = $(".detail .poster img").attr("src") || "";
    const description = $(".detail .excerpt").text().trim();

    return createSourceManga({
      id: mangaId,
      titles: [title],
      image: image,
      status: "ONGOING",
      desc: description,
      tags: [],
    });
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const request = {
      url: new URLBuilder(baseUrl)
        .addPath("read")
        .addPath(chapter.chapterId)
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    // Extract chapter images
    const pages: string[] = [];
    $(".chapter-images img").each((_, element) => {
      const imageUrl = $(element).attr("src");
      if (imageUrl) pages.push(imageUrl);
    });

    return createChapterDetails({
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages: pages,
    });
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

    $(".chapter-list li").each((_, element) => {
      const li = $(element);
      const link = li.find("a");
      const chapterId = link.attr("href")?.replace("/read/", "") || "";
      const title = link.text().trim();

      // Extract chapter number from title
      const chapterNumber = parseFloat(
        title.match(/Chapter (\d+)/)?.[1] || "0",
      );

      chapters.push({
        chapterId: chapterId,
        title: title,
        sourceManga: sourceManga,
        chapNum: chapterNumber,
        creationDate: new Date(),
        volume: undefined,
        langCode: "en",
      });
    });

    return chapters;
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

function createRequestObject(options: {
  url: string;
  method: string;
  headers: { Referer: string };
}): Request {
  return {
    url: options.url,
    method: options.method,
    headers: options.headers,
  };
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

function createDiscoverSection(options: {
  id: string;
  title: string;
  items: DiscoverSectionItem[];
  type: "singlerow";
}): DiscoverSection {
  return {
    type: DiscoverSectionType.featured,
    id: options.id,
    title: options.title,
    subtitle: undefined,
  };
}

function createSourceManga(options: {
  id: string;
  titles: string[];
  image: string;
  status: "ONGOING" | "COMPLETED" | "UNKNOWN";
  desc: string;
  tags: TagSection[];
}): SourceManga {
  return {
    mangaId: options.id,
    mangaInfo: {
      primaryTitle: options.titles[0],
      secondaryTitles: options.titles.slice(1),
      thumbnailUrl: options.image,
      synopsis: options.desc,
      rating: 1,
      contentRating: ContentRating.EVERYONE,
    },
  };
}

function createChapterDetails(options: {
  id: string;
  mangaId: string;
  pages: string[];
}): ChapterDetails {
  return {
    id: options.id,
    mangaId: options.mangaId,
    pages: options.pages,
  };
}

export const MangaFire = new MangaFireExtension();
