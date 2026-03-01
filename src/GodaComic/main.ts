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
  SortingOption,
  SourceManga,
  TagSection,
} from "@paperback/types";
import { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";
import * as htmlparser2 from "htmlparser2";
import { GodaComicInterceptor } from "./interceptors";
import {
  ApiResponse,
  ChapterInfo,
  Genres,
  GodaComicMetadata,
  Tags,
} from "./model";

// helper to pull manga identifier from various href patterns (slug or numeric id)
function extractMangaId(href: string): string | undefined {
  let match = href.match(/\/book\/(\d+)/);
  if (match) return match[1];
  match = href.match(/\/manga\/([^\/?#]+)/);
  if (match) return match[1];
  return undefined;
}

const baseUrl = "https://manhuascans.org";

type GodaComicImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class GodaComicExtension implements GodaComicImplementation {
  requestManager = new GodaComicInterceptor("main");
  globalRateLimiter = new BasicRateLimiter("rateLimiter", {
    numberOfRequests: 10,
    bufferInterval: 1,
    ignoreImages: true,
  });

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.globalRateLimiter.registerInterceptor();
  }

  private async parseSection(
    path: string,
    metadata: GodaComicMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds: string[] = metadata?.collectedIds ?? [];

    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    const pagedUrl = page > 1 ? `${url.replace(/\/+$/, "")}/page/${page}` : url;
    const request = { url: pagedUrl, method: "GET" };
    const $ = await this.fetchCheerio(request);

    const items: DiscoverSectionItem[] = [];

    $("div.pb-2 a, a.slicarda").each((_, el) => {
      const anchor = $(el);
      const href = anchor.attr("href") ?? "";
      const mangaId = extractMangaId(href);
      if (!mangaId || collectedIds.includes(mangaId)) return;
      collectedIds.push(mangaId);

      const img = anchor.find("img").first();
      let imageUrl = img.attr("src") ?? "";
      if (imageUrl.startsWith("/")) {
        imageUrl = baseUrl.replace(/\/+$/g, "") + imageUrl;
      }

      let title = anchor.find("h3.cardtitle").first().text().trim();
      if (!title) {
        title = anchor.text().trim() || img.attr("alt")?.trim() || "";
      }

      items.push({
        type: "featuredCarouselItem",
        mangaId,
        imageUrl,
        title,
        metadata: undefined,
      });
    });

    const hasNextPage = $("button:contains('NEXT'), a:contains('NEXT')").length > 0 || $("span:contains('NEXT')").closest("button").length > 0;
    return {
      items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "trending_section",
        title: "Trending",
        type: DiscoverSectionType.featured,
      },
      {
        id: "updated_section",
        title: "Recently Updated",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "top_and_hot_section",
        title: "Top & Hot",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "new_section",
        title: "New",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: GodaComicMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "updated_section":
        return this.getUpdatedSectionItems(section, metadata);
      case "trending_section":
        return this.getTrendingSectionItems(section, metadata);
      case "top_and_hot_section":
        return this.getTopAndHotSectionItems(section, metadata);
      case "new_section":
        return this.getNewSectionItems(section, metadata);
      default:
        return { items: [] };
    }
  }

  async getSearchFilters(): Promise<SearchFilter[]> {
    const filters: SearchFilter[] = [];

    return filters;
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    return [];
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: GodaComicMetadata | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;

    // If no title, return trending section mapped to search results
    if (!query.title) {
      const ds = await this.getDiscoverSectionItems({ id: "trending_section" } as DiscoverSection, metadata);
      const items: SearchResultItem[] = (ds.items || [])
        .filter((i) => !!(i as any).mangaId && !!(i as any).title && !!(i as any).imageUrl)
        .map((i) => ({
          mangaId: (i as any).mangaId,
          title: (i as any).title,
          imageUrl: (i as any).imageUrl,
          subtitle: undefined,
          metadata: undefined,
        }));
      return {
        items,
        metadata: ds.metadata as any,
      };
    }

    const request = {
      url: `${baseUrl}/s/${encodeURIComponent(query.title ?? "")}?page=${page}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: SearchResultItem[] = [];

    $("div.cardlist div.pb-2 a, div.pb-2 a").each((_, el) => {
      const anchor = $(el);
      const href = anchor.attr("href") ?? "";
      const mangaId = extractMangaId(href);
      if (!mangaId) return;

      const title =
      anchor.find("h3.cardtitle").first().text().trim() ||
      anchor.text().trim() ||
      "";

      let imageUrl = anchor.find("img").first().attr("src") ?? "";
      imageUrl = imageUrl.trim();
      if (!imageUrl) return;
      if (imageUrl.startsWith("//")) imageUrl = `https:${imageUrl}`;
      else if (imageUrl.startsWith("/"))
      imageUrl = baseUrl.replace(/\/+$/g, "") + imageUrl;

      items.push({
        mangaId,
        title,
        imageUrl,
        subtitle: undefined,
        metadata: undefined,
      });
    });

    return {
      items,
      metadata: { page: page + 1, collectedIds: metadata?.collectedIds },
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `https://manhuascans.org/manga/${mangaId}`;
    const request: Request = { url, method: "GET" };
    const $ = await this.fetchCheerio(request);

    // primary title (new markup uses h1.mb-2; fallback to previous selector)
    let primaryTitle = "";
    const h1 = $("h1.mb-2").first();
    if (h1 && h1.length) {
      // remove status/labels inside the h1 before extracting text
      h1.find("span").remove();
      primaryTitle = h1.text().trim();
    }
    if (!primaryTitle) {
      primaryTitle = $("h2[itemprop=title]").first().text().trim() || "";
    }

    // alternative titles (fallback to existing row-based layout)
    const altTitles: string[] = [];
    $(".row.py-1").each((_, el) => {
      const label = $(el).find(".col-4").first().text().trim();
      if (label.startsWith("Alternative titles")) {
        const text = $(el).find(".col-8").text().trim();
        if (text) {
          altTitles.push(
            ...text
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          );
        }
      }
    });

    // thumbnail
    let thumbnailUrl = "";
    const ogImage =
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='og:image']").attr("content");

    if (ogImage) {
      thumbnailUrl = ogImage;
    }

    // synopsis (new markup uses text-medium.line-clamp-4; fallback to .description)
    let synopsis = $(".text-medium.line-clamp-4").first().text().trim();
    if (!synopsis) synopsis = $(".description").first().text().trim();

    // status: prefer status badge inside the h1, fallback to row-based label parsing
    let statusText = $("h1.mb-2 span").first().text().trim();
    if (!statusText) {
      $(".row.py-1").each((_, el) => {
        const label = $(el).find(".col-4").first().text().trim();
        if (label.startsWith("Status")) {
          statusText = $(el).find(".col-8").text().trim();
        }
      });
    }
    let status: "ONGOING" | "COMPLETED" | "UNKNOWN" = "UNKNOWN";
    if (/completed/i.test(statusText)) status = "COMPLETED";
    else if (/ongoing/i.test(statusText)) status = "ONGOING";

    // genres/tags: new markup places genres in a div with a span.font-medium label
    const genres: string[] = [];
    $("div").each((_, el) => {
      const label = $(el).find("span.font-medium").first().text().trim();
      if (label.startsWith("Genres")) {
        $(el)
          .find("a")
          .each((_, g) => {
            const text = $(g).text().trim();
            if (text) genres.push(text);
          });
      }
    });

    const tagGroups: TagSection[] = [];
    if (genres.length) {
      const tags = genres.map((g, i) => {
        let id = g.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!id) id = `genre${i}`;
        return { id, title: g };
      });
      tagGroups.push({
        id: "genres",
        title: "Genres",
        tags,
      });
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle,
        secondaryTitles: altTitles,
        thumbnailUrl,
        synopsis,
        rating: 0,
        contentRating: ContentRating.EVERYONE,
        status,
        tagGroups,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const url = `https://manhuascans.org/chapterlist/${mangaId}`;

    const request: Request = { url, method: "GET" };
    let $ = await this.fetchCheerio(request);

    // page may load chapters via JS; check for placeholder element with mid/host
    const allChaptersDiv = $("#allchapters");
    if (allChaptersDiv.length) {
      const mid = allChaptersDiv.attr("data-mid") || mangaId;
      const host = allChaptersDiv.attr("data-host") || baseUrl;
      const apiUrl = `${host}/manga/get?mid=${mid}&mode=all`;
      const resp = await this.fetchCheerio({ url: apiUrl, method: "GET" });
      $ = resp; // switch to API response HTML
    }

    const chapters: Chapter[] = [];

    // each chapter item
    $("#allchapterlist .chapteritem a").each((_, el) => {
      const anchor = $(el);
      const href = anchor.attr("href") || "";
      const parts = href.split('/').filter(Boolean);
      const mData = anchor.attr("data-ms");
      const cData = anchor.attr("data-cs");
      let chapterId: string | undefined;
      if (mData && cData) {
        chapterId = `${mData}_${cData}`;
      } else {
        chapterId = parts.length ? parts[parts.length - 1] : undefined;
      }
      if (!chapterId) return;

      const title = anchor.find("span.chaptertitle").first().text().trim() || anchor.attr("data-ct") || "";
      // attempt numeric parsing from data-ct or title
      let chapNum = 0;
      const numMatch = (anchor.attr("data-ct") || title).match(/(\d+(?:\.\d+)?)/);
      if (numMatch && numMatch[1]) chapNum = parseFloat(numMatch[1]);


      const langCode = "en";

      chapters.push({
        chapterId,
        title,
        sourceManga,
        chapNum,
        publishDate: undefined,
        volume: 0,
        langCode,
        version: "1",
      });
    });

    // sort by chapNum ascending
    chapters.sort((a, b) => a.chapNum - b.chapNum);

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    // chapterId format m_c is stored in getChapters
    const [m, c] = (chapter.chapterId || "").split("_");
    if (!m || !c) {
      throw new Error("Missing m/c identifiers for chapter details");
    }
    const apiUrl = `${baseUrl}/chapter/getcontent?m=${m}&c=${c}`;
    const request: Request = { url: apiUrl, method: "GET" };

    const $ = await this.fetchCheerio(request);
    const pages: string[] = [];

    // collect images from the chapter container (including noscript fallbacks)
    $("#chapcontent img").each((_, el) => {
      const img = $(el);
      let src =
        img.attr("data-src") ||
        img.attr("data-original") ||
        img.attr("data-lazy") ||
        img.attr("data-srcset") ||
        img.attr("srcset") ||
        img.attr("src") ||
        "";

      src = src.trim();
      if (!src) return;

      // src/srcset/data-srcset can contain multiple entries; take the first URL
      if (src.includes(",")) src = src.split(",")[0].trim();
      if (src.includes(" ")) src = src.split(" ")[0].trim();

      // normalize protocol-relative and root-relative URLs
      if (src.startsWith("//")) src = `https:${src}`;
      else if (src.startsWith("/")) src = baseUrl.replace(/\/+$/g, "") + src;

      if (src && !pages.includes(src)) pages.push(src);
    });

    // fallback: if nothing found, try grabbing images from any <noscript> tags
    if (pages.length === 0) {
      $("noscript").each((_, n) => {
        const nos = $(n);
        const inner = nos.html() || "";
        const m = inner.match(/src=["']([^"']+)["']/);
        if (m && m[1]) {
          let src = m[1].trim();
          if (src.startsWith("//")) src = `https:${src}`;
          else if (src.startsWith("/")) src = baseUrl.replace(/\/+$/g, "") + src;
          if (src && !pages.includes(src)) pages.push(src);
        }
      });
    }

    return {
      mangaId: chapter.sourceManga.mangaId,
      id: chapter.chapterId,
      pages,
    };
  }

  private async getUpdatedSectionItems(
    section: DiscoverSection,
    metadata: GodaComicMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const request = {
      url: baseUrl,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];
    const page = metadata?.page ?? 1;
    const collectedIds: string[] = metadata?.collectedIds ?? [];

    // new markup uses <a class="slicarda"> anchors; older markup used .trending container
    $(".trending, a.slicarda").each((_, el) => {
      // the element itself may already be the anchor
      const anchor = $(el).is("a") ? $(el) : $(el).find("a").first();
      const href = anchor.attr("href") ?? "";
      const mangaId = extractMangaId(href);
      if (!mangaId || collectedIds.includes(mangaId)) return;
      collectedIds.push(mangaId);

      const img = anchor.find("img").first();
      const imageUrl = img.attr("src") ?? "";
      // prefer the explicit title element if present, otherwise fallback to anchor text or alt
      let title = anchor.find("h3.slicardtitle").first().text().trim();
      if (!title) {
        title = anchor.text().trim() || img.attr("alt")?.trim() || "";
      }

      // chapter number lives in a <p class="slicardtitlep"> inside the card
      const chapText = anchor.find("p.slicardtitlep").first().text().trim();

      items.push({
        type: "chapterUpdatesCarouselItem",
        mangaId,
        chapterId: "",
        imageUrl,
        title,
        subtitle: chapText,
        metadata: undefined,
      });
    });

    const hasNextPage = items.length > 0;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  // trending, top/hot and new sections currently share the same markup as updates
  private async getTrendingSectionItems(
    section: DiscoverSection,
    metadata: GodaComicMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    return this.parseSection("/dayup", metadata);
  }

  private async getTopAndHotSectionItems(
    section: DiscoverSection,
    metadata: GodaComicMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    return this.parseSection("/hots", metadata);
  }

  private async getNewSectionItems(
    section: DiscoverSection,
    metadata: GodaComicMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    return this.parseSection("/newss", metadata);
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/manga/${mangaId}`;
  }

  checkCloudflareStatus(status: number): void {
    if (status == 503 || status == 403) {
      throw new CloudflareError({ url: baseUrl, method: "GET" });
    }
  }

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const [, data] = await Application.scheduleRequest(request);
    // this.checkCloudflareStatus((data as any)?.status ?? 200);
    const htmlStr = Application.arrayBufferToUTF8String(data);
    const dom = htmlparser2.parseDocument(htmlStr);
    return cheerio.load(dom);
  }
}

export const GodaComic = new GodaComicExtension();
