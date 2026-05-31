import {
  type AdvancedSearchForm,
  BasicRateLimiter,
  Chapter,
  ChapterProviding,
  CloudflareError,
  ContentRating,
  DiscoverSection,
  DiscoverSectionItem,
  DiscoverSectionProviding,
  DiscoverSectionType,
  Extension,
  MangaProviding,
  NovelChapter,
  PagedResults,
  Request,
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SortingOption,
  SourceManga,
  TagSection,
} from "@paperback/types";
import * as cheerio from "cheerio";
import * as htmlparser2 from "htmlparser2";
import { URLBuilder } from "../utils/url-builder/base";
import { ScribbleHubInterceptor } from "./interceptors";
import { type ScribbleHubMetadata} from "./model";
import type { CheerioAPI } from "cheerio";

const baseUrl = "https://www.scribblehub.com";

type ScribbleHubImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class ScribbleHubExtension implements ScribbleHubImplementation {
  requestManager = new ScribbleHubInterceptor("main");
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
        id: "trending_section",
        title: "Trending Novels",
        type: DiscoverSectionType.featured,
      },
      {
        id: "latest_section",
        title: "Latest Series",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "latest_updates_section",
        title: "latest Updates",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "trending_section":
        return this.getTrendingSectionItems(section);
      case "latest_section":
        return this.getLatestSectionItems(section);
      case "latest_updates_section":
        return this.getLatestUpdatesSectionItems(section);
      default:
        return { items: [] };
    }
  }

  async getSortingOptions(_query: SearchQuery<Metadata>): Promise<SortingOption[]> {
    return SORTS.map((s) => ({ id: s.id, label: s.label }));
  }

  async getAdvancedSearchForm(query: SearchQuery<Metadata>): Promise<AdvancedSearchForm> {
    const meta = (query.metadata as { searchMeta?: ScribbleHubSearchMeta } | undefined)?.searchMeta;
    return new ScribbleHubSearchForm(meta);
  }

  async getSearchResults(
    query: SearchQuery<ScribbleHubMetadata>,
    metadata: ScribbleHubMetadata | undefined,
    sortingOption: SortingOption | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const paginationMeta = metadata as { page?: number } | undefined;
    const page = paginationMeta?.page ?? 1;

    if (query.title && query.title.trim() !== "") {
      const searchUrl = `${baseUrl}/ajax/searchLive?inputContent=${encodeURIComponent(query.title.trim())}`;
      const [, data] = await Application.scheduleRequest({ url: searchUrl, method: "GET" });
      const jsonString = Application.arrayBufferToUTF8String(data);
      const result = JSON.parse(jsonString) as NovelFireResult;
      const html = String(result?.result?.html ?? "");
      const dom = htmlparser2.parseDocument(html);
      const $ = cheerio.load(dom);
      const items: SearchResultItem[] = [];
      $(".novel-item").each((_, el) => {
        const novel = $(el);
        const a = novel.find("a");
        const url = String(a.attr("href")) || "";
        const title = String(novel.find(".novel-title").text()).trim();
        const coverUrl = String(novel.find("img").attr("src")) || "";
        const mangaId = url.split("/book/")[1] || url;
        if (title && mangaId) {
          items.push({ mangaId, title, imageUrl: coverUrl, subtitle: undefined });
        }
      });
      return { items };
    }

    const searchMeta = (query.metadata as { searchMeta?: NovelFireSearchMeta } | undefined)?.searchMeta;
    const genre = searchMeta?.genre ?? "genre-all";
    const sort = sortingOption?.id ?? searchMeta?.sort ?? "sort-latest-release";
    const status = searchMeta?.status ?? "status-all";

    const request = {
      url: new URLBuilder(baseUrl)
        .addPath(genre)
        .addPath(sort)
        .addPath(status)
        .addPath("all-novel")
        .addQuery("page", String(page))
        .build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const collectedIds: string[] = [];
    const items: SearchResultItem[] = [];

    $(".novel-item").each((_, el) => {
      const novel = $(el);
      const a = novel.find("a");
      const url = a.attr("href") || "";
      const title = a.attr("title") || a.text().trim();
      const imgurl = novel.find("img").attr("data-src") || novel.find("img").attr("src") || "";
      const coverUrl = imgurl.startsWith("http") ? imgurl : `${baseUrl}${imgurl}`;
      const mangaId = url.split("/book/")[1] || "";
      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push({ mangaId, title, imageUrl: coverUrl, subtitle: undefined });
      }
    });

    const hasNextPage = !!$(".simple-pagination li.active").next("li:not(.disabled)").length;

    return {
      items,
      metadata: hasNextPage ? ({ page: page + 1 } satisfies { page: number }) : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = {
      url: `${baseUrl}/series/${mangaId}/`,
      method: "GET",
    };
    const $ = (await this.fetchCheerio(request));
    const title = String($(".fic_title").text()).trim();
    const coverUrl = String($(".fic_image img").attr("src")) || "";
    const genres: string[] = [];
    $(".wi_fic_genre a.fic_genre").each((_, el) => {
      genres.push(String($(el).text()).trim());
    });
    const tags: string[] = [];
    $(".wi_fic_showtags a.stag").each((_, el) => {
      tags.push(String($(el).text()).trim());
    });
    const rating = parseFloat(String($(".fic_rate span span").first().text()).trim()) || 1;
    const author = String($('[property="author"] .auth_name_fic').text()).trim();
    const rawStatus = String($("li:has(.rnd_stats) > span").text()).trim();
    const status = rawStatus.split(" - ")[0]?.toUpperCase() || "UNKNOWN";
    const description = String($(".wi_fic_desc").text()).trim();

    const tagGroups: TagSection[] = [];
    if (genres.length > 0) {
      tagGroups.push({
        id: "genres",
        title: "Genres",
        tags: genres.map((genre) => ({
          id: genre.toLowerCase().replace(/\s+/g, "-"),
          title: genre,
        })),
      });
    }
    if (tags.length > 0) {
      tagGroups.push({
        id: "tags",
        title: "Tags",
        tags: tags.map((tag) => ({
          id: tag.toLowerCase().replace(/\s+/g, "-"),
          title: tag,
        })),
      });
    }

    return {
      mangaId: mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl: coverUrl,
        synopsis: description,
        rating: rating,
        contentRating: ContentRating.EVERYONE,
        contentType: "novel",
        status: status as "ONGOING" | "COMPLETED" | "UNKNOWN",
        tagGroups: tagGroups,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const request = {
      url: `${baseUrl}/series/${sourceManga.mangaId}/`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const chapters: Chapter[] = [];

    $("ol.toc_ol li.toc_w").each((_, el) => {
      const li = $(el);
      const a = li.find("a.toc_a");
      const href = String(a.attr("href") ?? "");
      const title = a.text().trim();

      const chapterIdMatch = href.match(/\/(read\/.+\/chapter\/\d+)/);
      const chapterId = chapterIdMatch?.[1] ?? "";
      if (!chapterId) return;

      const chapNumMatch = title.match(/chapter\s+([\d.]+)/i);
      const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0;

      const dateTitle = String(li.find("span.fic_date_pub").attr("title") ?? "");
      const publishDate = dateTitle && !dateTitle.includes("ago") ? new Date(dateTitle) : undefined;

      chapters.push({
        chapterId,
        title,
        sourceManga,
        chapNum,
        publishDate,
        volume: 0,
        langCode: "en",
        version: "1",
      });
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<NovelChapter> {
    const request = {
      url: `${baseUrl}/${chapter.chapterId}/`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    $(".wi-ads, .ads-title").remove();

    const content = $(".chp_raw").map((_, el) => $(el).html() ?? "").toArray().join("");
    const html = `<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>${content}</body></html>`;

    return {
      mangaId: chapter.sourceManga.mangaId,
      id: chapter.chapterId,
      type: "html",
      html,
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/series/${mangaId}/`;
  }

  private async parseSearchResults($: CheerioAPI): Promise<SearchResultItem[]> {
    const items: SearchResultItem[] = [];
    $(".search_main_box").each((_, el) => {
      const novel = $(el);
      const a = novel.find(".search_title a").first();
      const url = String(a.attr("href") ?? "").trim();
      const title = String(a.text()).trim();
      const imgUrl =
        String(novel.find(".search_img img").attr("data-src") ?? "") ||
        String(novel.find(".search_img img").attr("src") ?? "");
      const coverUrl = imgUrl.startsWith("http") ? imgUrl : `${baseUrl}${imgUrl}`;

      let mangaId = "";
      const seriesMatch = url.match(/\/series\/(\d+\/[^/?]+)/);
      if (seriesMatch?.[1]) {
        mangaId = seriesMatch[1];
      }

      if (title && mangaId) {
        items.push({ mangaId, title, imageUrl: coverUrl, subtitle: undefined });
      }
    });
    return items;
  }

  private async getTrendingSectionItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = 1;
    const collectedIds = [] as string[];

    const request = {
      url: `${baseUrl}/series-ranking/?sort=5&order=1&pg=${page}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    (await this.parseSearchResults($)).forEach((item) => {
      if (!collectedIds.includes(item.mangaId)) {
        collectedIds.push(item.mangaId);
        items.push({
          type: "featuredCarouselItem",
          mangaId: item.mangaId,
          imageUrl: item.imageUrl,
          title: item.title,
          supertitle: item.subtitle,
        });
      }
    });

    const hasNextPage = $(".simple-pagination a.page-link.next").length > 0;

    return {
      items: items,
      metadata: hasNextPage ? ({ page: page + 1 } satisfies { page: number }) : undefined,
    };
  }

  private async getLatestUpdatesSectionItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = 1;
    const collectedIds = [] as string[];

    const request = {
      url: `${baseUrl}/latest-series/?pg=${page}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    (await this.parseSearchResults($)).forEach((item) => {
      if (!collectedIds.includes(item.mangaId)) {
        collectedIds.push(item.mangaId);
        items.push({
          type: "chapterUpdatesCarouselItem",
          mangaId: item.mangaId,
          chapterId: "",
          imageUrl: item.imageUrl,
          title: item.title,
          subtitle: item.subtitle,
        });
      }
    });

    const hasNextPage = $(".simple-pagination a.page-link.next").length > 0;


    return {
      items: items,
      metadata: hasNextPage ? ({ page: page + 1 } satisfies { page: number }) : undefined,
    };
  }

  private async getLatestSectionItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    let page = 1;
    let collectedIds = [] as string[];

    const request = {
      url: `${baseUrl}/latest-series/?pg=${page}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    (await this.parseSearchResults($)).forEach((item) => {
      if (!collectedIds.includes(item.mangaId)) {
        collectedIds.push(item.mangaId);
        items.push({
          type: "simpleCarouselItem",
          mangaId: item.mangaId,
          imageUrl: item.imageUrl,
          title: item.title,
          subtitle: item.subtitle,
        });
      }
    });

    const hasNextPage = $(".simple-pagination a.page-link.next").length > 0;

    return {
      items: items,
      metadata: { page: page + 1, collectedIds: collectedIds },
    };
  }

  checkCloudflareStatus(status: number): void {
    if (status == 503 || status == 403) {
      throw new CloudflareError({ url: baseUrl, method: "GET" });
    }
  }

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const [, data] = await Application.scheduleRequest(request);
    this.checkCloudflareStatus((data as any)?.status ?? 200);
    const htmlStr = Application.arrayBufferToUTF8String(data);
    const dom = htmlparser2.parseDocument(htmlStr);
    return cheerio.load(dom);
  }
}

export const ScribbleHub = new ScribbleHubExtension();
