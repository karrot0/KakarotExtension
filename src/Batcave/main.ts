import {
  Chapter,
  ChapterDetails,
  ChapterProviding,
  Cookie,
  CloudflareBypassRequestProviding,
  CookieStorageInterceptor,
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
import { CaveInterceptor } from "./interceptors";
import { Metadata } from "./model";

const baseUrl = "https://batcave.biz";

type BatcaveImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  CloudflareBypassRequestProviding &
  DiscoverSectionProviding;

export class BatcaveExtension implements BatcaveImplementation {
  requestManager = new CaveInterceptor("main");
  cookieStorageInterceptor = new CookieStorageInterceptor({
    storage: "stateManager",
  });

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "popular_section",
        title: "Popular",
        type: DiscoverSectionType.featured,
      },
      {
        id: "catalogue_section",
        title: "Catalogue",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "new_comic_section",
        title: "New Comics",
        type: DiscoverSectionType.simpleCarousel,
      },
      { id: "genres", title: "Genres", type: DiscoverSectionType.genres },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "popular_section":
        return this.getPopularSectionItems(section);
      case "catalogue_section":
        return this.getCatalogueSectionItems(section);
      case "new_comic_section":
        return this.getNewComicsSectionItems(section);
      case "genres":
        return this.getGenreSectionItems(section);
      default:
        return { items: [] };
    }
  }

  async getSearchResults(
    query: SearchQuery<Metadata>,
    metadata: Metadata | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;

    // Example URL: https://batcave.biz/search/invincible
    // With PAGE: https://batcave.biz/search/invincible/page/2/
    // DOES NOT WORK WITH NO TITLE: https://batcave.biz/search/

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

    let $ = await this.fetchCheerio({ url: this.buildSearchUrl(query.title, page), method: "GET" });
    let searchResults = this.parseReadedList($);

    if (searchResults.length === 0) {
      const relaxed = relaxSearchTitle(query.title);
      if (relaxed && relaxed !== query.title) {
        $ = await this.fetchCheerio({ url: this.buildSearchUrl(relaxed, page), method: "GET" });
        searchResults = this.parseReadedList($);
      }
    }

    return {
      items: searchResults,
      metadata: hasNextPage($) ? { page: page + 1 } : undefined,
    };
  }

  buildSearchUrl(title: string, page: number): string {
    const urlBuilder = new URLBuilder(baseUrl).addPath("search").addPath(title, true);

    if (page > 1) {
      urlBuilder.addPath("page").addPath(page.toString());
    }

    return urlBuilder.build();
  }

  parseReadedList($: CheerioAPI): SearchResultItem[] {
    const searchResults: SearchResultItem[] = [];

    $(".readed").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".readed__title a");
      const title = infoLink.text().trim();
      const imgEl = unit.find(".readed__img img");
      const image = absoluteUrl(imgEl.attr("data-src") || imgEl.attr("src"));
      const mangaId = parseMangaId(infoLink.attr("href"));
      const latestChapterText = unit.find(".readed__info li:last-child").text().trim();
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

    return searchResults;
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    // Expected mangaId: 6975-invincible-2003
    const request = { url: mangaUrl(mangaId), method: "GET" };

    const $ = await this.fetchCheerio(request);

    const title = $("h1").first().text().trim();
    const image = absoluteUrl($(".page__poster img").attr("src"));
    const description = $(".page__text").text().trim();

    const ratingMatch = /(\d+(\.\d+)?)/.exec($(".page__poster-rating-score").first().text());
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

    const statusText = $(".page__list li")
      .filter((_, el) => $(el).text().includes("Release type"))
      .first()
      .text()
      .toLowerCase();

    const status = statusText.includes("completed")
      ? "COMPLETED"
      : statusText.includes("ongoing")
        ? "ONGOING"
        : "UNKNOWN";

    const tags: TagSection[] = [];
    const genres: string[] = [];

    $(".page__tags a").each((_, element) => {
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
      url: mangaUrl(sourceManga.mangaId),
      method: "GET",
    };
    const $ = await this.fetchCheerio(request);
    const chapters: Chapter[] = [];

    const chapterScript =
      $(".page__chapters-list script")
        .filter((_, el) => {
          const content = $(el).html();
          return content ? content.includes("__DATA__") : false;
        })
        .first()
        .html() || "";

    const jsonMatch = chapterScript.match(/window\.__DATA__\s*=\s*({[\s\S]*?});/);
    const jsonData = jsonMatch ? jsonMatch[1] : null;

    interface ChapterData {
      id: number;
      title?: string;
      posi: number;
      date?: string;
    }

    interface ParsedData {
      chapters?: ChapterData[];
    }

    try {
      if (!jsonData) throw new Error("No JSON data found");

      const parsedData: ParsedData = JSON.parse(jsonData) as ParsedData;

      if (parsedData.chapters) {
        parsedData.chapters.forEach((chapter: ChapterData) => {
          if (chapter.id && typeof chapter.id === "number") {
            chapters.push({
              chapterId: chapter.id.toString(),
              title: chapter.title?.trim() || `Chapter ${chapter.posi}`,
              sourceManga,
              chapNum: chapter.posi,
              publishDate: parsePublishDate(chapter.date),
              volume: 0,
              langCode: "🇬🇧",
            });
          } else {
            console.error(`Invalid Chapter`);
          }
        });
      }
    } catch (err) {
      console.error("Error parsing JSON data:", err);
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    // The reader page ships images:[] and loads them via this AJAX call.
    // news_id = numeric mangaId prefix, chapter_id = chapterId; both required.
    const newsId = parseNewsId(chapter.sourceManga.mangaId);
    if (!newsId) {
      throw new Error(`Could not read a news id from mangaId "${chapter.sourceManga.mangaId}"`);
    }

    try {
      const request = {
        url: `${baseUrl}/engine/ajax/controller.php?mod=api&action=reader/getChapterData`,
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `news_id=${newsId}&chapter_id=${chapter.chapterId}`,
      };

      const [response, data] = await Application.scheduleRequest(request);
      if (response.status === 503 || response.status === 403) {
        throw new CloudflareError({
          url: baseUrl,
          method: "GET",
          headers: { referer: baseUrl, origin: baseUrl },
        } as Request);
      }

      const parsed = JSON.parse(Application.arrayBufferToUTF8String(data)) as {
        success?: boolean;
        error?: string;
        data?: { images?: string[] };
      };

      if (parsed.success === false) {
        throw new Error(parsed.error ?? "Chapter data request was rejected");
      }

      const pages = (parsed.data?.images ?? []).map(absoluteUrl);

      return {
        id: chapter.chapterId,
        mangaId: chapter.sourceManga.mangaId,
        pages,
      };
    } catch (error) {
      console.error("Error fetching chapter details:", error);
      throw error;
    }
  }

  async getCatalogueSectionItems(
    _section: DiscoverSection,
    metadata?: Metadata,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const urlBuilder = new URLBuilder(baseUrl).addPath("comix/");

    if (page > 1) {
      urlBuilder.addPath("page").addPath(page.toString());
    }

    const request = {
      url: urlBuilder.build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $("#dle-content .readed").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".readed__title a");
      const title = infoLink.text().trim();
      const imgEl = unit.find(".readed__img img");
      const image = absoluteUrl(imgEl.attr("data-src") || imgEl.attr("src"));
      const mangaId = parseMangaId(infoLink.attr("href"));
      const latestChapterText = unit.find(".readed__info li:last-child").text().trim();
      const latestChapter = latestChapterText.replace("Last issue:", "").trim();

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

    return {
      items: items,
      metadata: hasNextPage($) ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getPopularSectionItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const metadata: Metadata = { page: 1, collectedIds: [] };
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: baseUrl,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".poster.grid-item").each((_, element) => {
      const unit = $(element);
      const title = unit.find(".poster__title").text().trim();
      const imgEl = unit.find(".poster__img img");
      const image = absoluteUrl(imgEl.attr("data-src") || imgEl.attr("src"));
      const mangaId = parseMangaId(unit.attr("href"));
      const rating = unit.find(".poster__label--rate").text().trim();

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push({
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          supertitle: `Rating: ${rating}`,
          type: "featuredCarouselItem",
        });
      }
    });

    const hasNextPage = !!$(".panel-page-number .page-blue").next().length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getNewComicsSectionItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const metadata: Metadata = { page: 1, collectedIds: [] };
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: page > 1 ? `${baseUrl}/page/${page}/` : `${baseUrl}/`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    // Use the content container's id so we only target the current list
    $("#content-load .latest.grid-item").each((_, element) => {
      const unit = $(element);
      // Target the anchor inside .latest__title to keep inner icons out of the title text
      const title = unit.find(".latest__title a").clone().children().remove().end().text().trim();
      const imgEl = unit.find(".latest__img img");
      const image = absoluteUrl(imgEl.attr("data-src") || imgEl.attr("src"));
      // Grab the href from the title anchor rather than using closest()
      const mangaId = parseMangaId(unit.find(".latest__title a").attr("href"));
      const latestChapter = unit.find(".latest__chapter a").text().trim();

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

    const hasNextPage = !!$(".pagination__btn-loader a").length;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getGenreSectionItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const metadata = { page: 1, collectedIds: [] };
    const items = [
      { id: "https://batcave.biz/genres/Action", value: "Action" },
      { id: "https://batcave.biz/genres/Adventure", value: "Adventure" },
      { id: "https://batcave.biz/genres/Anthology", value: "Anthology" },
      {
        id: "https://batcave.biz/genres/Anthropomorphic",
        value: "Anthropomorphic",
      },
      { id: "https://batcave.biz/genres/Biography", value: "Biography" },
      { id: "https://batcave.biz/genres/Children", value: "Children" },
      { id: "https://batcave.biz/genres/Comedy", value: "Comedy" },
      { id: "https://batcave.biz/genres/Crime", value: "Crime" },
      { id: "https://batcave.biz/genres/Drama", value: "Drama" },
      { id: "https://batcave.biz/genres/Family", value: "Family" },
      { id: "https://batcave.biz/genres/Fantasy", value: "Fantasy" },
      { id: "https://batcave.biz/genres/Fighting", value: "Fighting" },
      {
        id: "https://batcave.biz/genres/Graphic%20Novels",
        value: "Graphic Novels",
      },
      { id: "https://batcave.biz/genres/Historical", value: "Historical" },
      { id: "https://batcave.biz/genres/Horror", value: "Horror" },
      {
        id: "https://batcave.biz/genres/Leading%20Ladies",
        value: "Leading Ladies",
      },
      { id: "https://batcave.biz/genres/LGBTQ", value: "LGBTQ" },
      { id: "https://batcave.biz/genres/Literature", value: "Literature" },
      { id: "https://batcave.biz/genres/Manga", value: "Manga" },
      {
        id: "https://batcave.biz/genres/Martial%20Arts",
        value: "Martial Arts",
      },
      { id: "https://batcave.biz/genres/Mature", value: "Mature" },
      { id: "https://batcave.biz/genres/Military", value: "Military" },
      { id: "https://batcave.biz/genres/Mini-Series", value: "Mini-Series" },
      {
        id: "https://batcave.biz/genres/Movies%20%26amp%3B%20TV",
        value: "Movies & TV",
      },
      { id: "https://batcave.biz/genres/Music", value: "Music" },
      { id: "https://batcave.biz/genres/Mystery", value: "Mystery" },
      { id: "https://batcave.biz/genres/Mythology", value: "Mythology" },
      { id: "https://batcave.biz/genres/Personal", value: "Personal" },
      { id: "https://batcave.biz/genres/Political", value: "Political" },
      {
        id: "https://batcave.biz/genres/Post-Apocalyptic",
        value: "Post-Apocalyptic",
      },
      {
        id: "https://batcave.biz/genres/Psychological",
        value: "Psychological",
      },
      { id: "https://batcave.biz/genres/Pulp", value: "Pulp" },
      { id: "https://batcave.biz/genres/Religious", value: "Religious" },
      { id: "https://batcave.biz/genres/Robots", value: "Robots" },
      { id: "https://batcave.biz/genres/Romance", value: "Romance" },
      { id: "https://batcave.biz/genres/School%20Life", value: "School Life" },
      { id: "https://batcave.biz/genres/Sci-Fi", value: "Sci-Fi" },
      {
        id: "https://batcave.biz/genres/Slice%20of%20Life",
        value: "Slice of Life",
      },
      { id: "https://batcave.biz/genres/Sport", value: "Sport" },
      { id: "https://batcave.biz/genres/Spy", value: "Spy" },
      { id: "https://batcave.biz/genres/Superhero", value: "Superhero" },
      { id: "https://batcave.biz/genres/Supernatural", value: "Supernatural" },
      { id: "https://batcave.biz/genres/Suspense", value: "Suspense" },
      { id: "https://batcave.biz/genres/Thriller", value: "Thriller" },
      { id: "https://batcave.biz/genres/Vampires", value: "Vampires" },
      { id: "https://batcave.biz/genres/Video%20Games", value: "Video Games" },
      { id: "https://batcave.biz/genres/War", value: "War" },
      { id: "https://batcave.biz/genres/Western", value: "Western" },
      { id: "https://batcave.biz/genres/Zombies", value: "Zombies" },
    ];

    return {
      items: items.map((item) => ({
        type: "genresCarouselItem",
        searchQuery: {
          title: "",
          filters: [{ id: "genres", value: { [item.id]: "included" } }],
        },
        name: item.value,
        metadata: metadata ? { page: metadata.page } : undefined,
      })),
    };
  }

  async getGenreSearchQuery(
    genreId: string,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;

    const request = {
      url: genreId,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    return {
      items: this.parseReadedList($),
      metadata: hasNextPage($) ? { page: page + 1 } : undefined,
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return mangaUrl(mangaId);
  }

  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    for (const cookie of this.cookieStorageInterceptor.cookies) {
      this.cookieStorageInterceptor.deleteCookie(cookie);
    }

    for (const cookie of cookies) {
      if (cookie.expires && cookie.expires.getTime() <= Date.now()) {
        continue;
      }
      this.cookieStorageInterceptor.setCookie(cookie);
    }
  }

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const [response, data] = await Application.scheduleRequest(request);
    const html = Application.arrayBufferToUTF8String(data);

    if (response.status === 503 || response.status === 403 || isBotCheckPage(html)) {
      throw new CloudflareError({
        url: baseUrl,
        method: "GET",
        headers: {
          referer: baseUrl,
          origin: baseUrl,
        },
      } as Request);
    }

    return cheerio.load(html);
  }
}

function parseMangaId(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const slug = cleanMangaId(href);
  return slug.length > 0 ? toMangaId(slug) : undefined;
}

const SAFE_ID = /^[A-Za-z0-9-]+$/;
const ENCODED_ID = /^(\d*)-?hx-([0-9a-f]+)$/i;

function toMangaId(slug: string): string {
  if (SAFE_ID.test(slug)) return slug;

  const newsId = /^(\d+)-/.exec(slug)?.[1] ?? "";
  const rest = newsId ? slug.slice(newsId.length + 1) : slug;
  return `${newsId}-hx-${toHex(rest)}`;
}

function toSlug(mangaId: string): string {
  const id = cleanMangaId(mangaId);
  const match = ENCODED_ID.exec(id);
  if (!match) return id;

  const rest = fromHex(match[2]);
  return match[1] ? `${match[1]}-${rest}` : rest;
}

function toHex(value: string): string {
  let hex = "";
  for (let i = 0; i < value.length; i++) {
    hex += value.charCodeAt(i).toString(16).padStart(4, "0");
  }
  return hex;
}

function fromHex(hex: string): string {
  let value = "";
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    value += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  }
  return value;
}

function cleanMangaId(mangaId: string): string {
  return mangaId
    .trim()
    .replace(/^https?:/i, "")
    .replace(/^\/\/[^/]+/, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/\.html?$/i, "")
    .replace(/\/+$/, "")
    .trim();
}

function mangaUrl(mangaId: string): string {
  const path = toSlug(mangaId).split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/${path}.html`;
}

function parseNewsId(mangaId: string): string | undefined {
  return /^(\d+)/.exec(toSlug(mangaId))?.[1];
}

function absoluteUrl(raw: string | undefined): string {
  const url = (raw ?? "").replace(/\\\//g, "/").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `${baseUrl}/${url.replace(/^\/+/, "")}`;
}

function isBotCheckPage(html: string): boolean {
  return (
    /\.open\(\s*["']POST["']\s*,\s*["']\/_v["']/.test(html) ||
    (html.includes("pow_nonce") && html.includes("pow_hash"))
  );
}

function parsePublishDate(date: string | undefined): Date | undefined {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec((date ?? "").trim());
  if (!match) return undefined;

  const [, day, month, year] = match;
  return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
}

function hasNextPage($: CheerioAPI): boolean {
  const currentPage = parseInt($(".pagination__pages > span").first().text()) || 1;
  return (
    $(".pagination__pages > a").filter((_, el) => {
      const pageNum = parseInt($(el).text());
      return !isNaN(pageNum) && pageNum > currentPage;
    }).length > 0
  );
}

function relaxSearchTitle(title: string): string {
  return title
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export const Batcave = new BatcaveExtension();
