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
  type Metadata,
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
import { ScribbleHubInterceptor } from "./interceptors";
import { type ScribbleHubMetadata, type ScribbleHubSearchMeta, SORTS } from "./model";
import { ScribbleHubSearchForm } from "./forms/SearchForm";
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
        title: "Latest Updates",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: Metadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const meta = metadata as ScribbleHubMetadata | undefined;
    switch (section.id) {
      case "trending_section":
        return this.getTrendingSectionItems(section, meta);
      case "latest_section":
        return this.getLatestSectionItems(section, meta);
      case "latest_updates_section":
        return this.getLatestUpdatesSectionItems(section, meta);
      default:
        return { items: [] };
    }
  }

  async getSortingOptions(_query: SearchQuery<ScribbleHubMetadata>): Promise<SortingOption[]> {
    return SORTS.map((s) => ({ id: s.id, label: s.label }));
  }

  async getAdvancedSearchForm(query: SearchQuery<ScribbleHubMetadata>): Promise<AdvancedSearchForm> {
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

    const searchMeta = (query.metadata as { searchMeta?: ScribbleHubSearchMeta } | undefined)?.searchMeta;
    const genres = searchMeta?.genres ?? {};
    const sort = sortingOption?.id ?? "1";

    const included = Object.keys(genres).filter((id) => genres[id] === "included");
    const excluded = Object.keys(genres).filter((id) => genres[id] === "excluded");
    const hasGenreFilter = included.length > 0 || excluded.length > 0;

    let url: string;
    if (query.title && query.title.trim() !== "") {
      url = `${baseUrl}/?s=${encodeURIComponent(query.title.trim())}&post_type=fictionposts`;
    } else if (hasGenreFilter) {
      const parts = [`sf=1`, `sort=${sort}`, `order=1`, `pg=${page}`];
      if (included.length > 0) parts.push(`gi=${included.join(",")}`);
      if (excluded.length > 0) parts.push(`ge=${excluded.join(",")}`);
      url = `${baseUrl}/series-finder/?${parts.join("&")}`;
    } else {
      url = `${baseUrl}/series-ranking/?sort=${sort}&order=1&pg=${page}`;
    }

    const $ = await this.fetchCheerio({ url, method: "GET" });
    const items = await this.parseSearchResults($);
    const hasNextPage = $("a.page-link.next").length > 0;

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
    const numericId = sourceManga.mangaId.split("/")[0];
    const chapters: Chapter[] = [];
    let page = 1;

    while (true) {
      const $ = await this.fetchCheerio({
        url: `${baseUrl}/wp-admin/admin-ajax.php`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: `action=wi_getreleases_pagination&mypostid=${numericId}&pagenum=${page}`,
      });

      const rows = $("li.toc_w");
      if (rows.length === 0) break;

      rows.each((_, el) => {
        const li = $(el);
        const a = li.find("a.toc_a");
        const href = String(a.attr("href") ?? "").trim();
        const title = a.text().trim();

        const chapterIdMatch = href.match(/\/(read\/.+\/chapter\/\d+)/);
        const chapterId = chapterIdMatch?.[1] ?? "";
        if (!chapterId) return;

        const chapNum = parseInt(li.attr("order") ?? "0", 10) || 0;

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

      page++;
    }

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
    metadata: ScribbleHubMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds: string[] = metadata?.collectedIds ?? [];

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

    const hasNextPage = $("a.page-link.next").length > 0;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } satisfies ScribbleHubMetadata : undefined,
    };
  }

  private async getLatestUpdatesSectionItems(
    _section: DiscoverSection,
    metadata: ScribbleHubMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds: string[] = metadata?.collectedIds ?? [];

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

    const hasNextPage = $("a.page-link.next").length > 0;


    return {
      items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } satisfies ScribbleHubMetadata : undefined,
    };
  }

  private async getLatestSectionItems(
    _section: DiscoverSection,
    metadata: ScribbleHubMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds: string[] = metadata?.collectedIds ?? [];

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

    const hasNextPage = $("a.page-link.next").length > 0;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } satisfies ScribbleHubMetadata : undefined,
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
