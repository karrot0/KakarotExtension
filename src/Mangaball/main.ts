import {
  BasicRateLimiter,
  Chapter,
  ChapterDetails,
  ChapterProviding,
  CloudflareBypassRequestProviding,
  ContentRating,
  Cookie,
  CookieStorageInterceptor,
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
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import * as htmlparser2 from "htmlparser2";
import { URLBuilder } from "../utils/url-builder/base";
import { MainInterceptor } from "./network";
import {
  metadata,
  SearchAPIResponse,
  SearchDetails,
  STATIC_SEARCH_DETAILS,
  APIItem,
  ChapterApiResponse,
} from "./models";
import { parseApiItemsToDiscoverItems } from "./parsers";

const baseUrl = "https://mangaball.net/";

type MangaballImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  CloudflareBypassRequestProviding &
  DiscoverSectionProviding;

export class MangaballExtension implements MangaballImplementation {
  requestManager = new MainInterceptor("main");
  cookieStorageInterceptor = new CookieStorageInterceptor({ storage: "stateManager" });
  globalRateLimiter = new BasicRateLimiter("rateLimiter", {
    numberOfRequests: 10,
    bufferInterval: 1,
    ignoreImages: true,
  });

  private cachedCsrfToken: string | undefined;
  private cachedXsrfToken: string | undefined;
  private cachedFormToken: string | undefined;
  private csrfReady: boolean = false;

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
    this.globalRateLimiter.registerInterceptor();

    await this.fetchCsrf(false);
  }

  async fetchCsrf(throwOnCF: boolean = false): Promise<void> {
    try {
      const [homeResp, homeData] = await Application.scheduleRequest({
        url: baseUrl,
        method: "GET",
        headers: {
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "user-agent": await Application.getDefaultUserAgent(),
        },
      });

      if (throwOnCF || (homeResp.status !== 503 && homeResp.status !== 403)) {
      } else if (homeResp.status === 503 || homeResp.status === 403) {
        this.csrfReady = false;
        return;
      }
      const homeHtml = Application.arrayBufferToUTF8String(homeData);
      const dom = htmlparser2.parseDocument(homeHtml);
      const $ = cheerio.load(dom);
      const metaToken = ($('meta[name="csrf-token"]').attr("content") || "").trim();
      let cookieToken: string | undefined;
      try {
        const cookies: readonly Cookie[] = this.cookieStorageInterceptor?.cookies ?? [];
        for (const c of cookies) {
          const name = (c.name || "").toLowerCase();
          if (name.includes("xsrf") || name.includes("csrf")) {
            try {
              cookieToken = decodeURIComponent(c.value || "");
            } catch {
              cookieToken = c.value || "";
            }
            break;
          }
        }
      } catch {
        throw new Error("Failed to access cookies for CSRF token extraction");
      }
      let scriptToken: string | undefined;
      if (!metaToken) {
        const scriptsCombined = $("script")
          .map((_, el) => $(el).html() || "")
          .get()
          .join("\n");
        const m1 = scriptsCombined.match(/csrfToken\s*[:=]\s*["']([^"']+)["']/i);
        if (m1) scriptToken = m1[1];
        else {
          const m2 = scriptsCombined.match(
            /window\.Laravel\s*=\s*\{[\s\S]*?csrfToken\s*:\s*["']([^"']+)["']/i,
          );
          if (m2) scriptToken = m2[1];
        }
      }
      this.cachedCsrfToken = metaToken || cookieToken || scriptToken || "";
      this.cachedXsrfToken = cookieToken || metaToken || scriptToken || "";
      this.cachedFormToken = metaToken || cookieToken || scriptToken || "";
      this.csrfReady = true;
    } catch (err: any) {
      this.csrfReady = false;
      console.log("[init] Failed to fetch CSRF/cookie:", err);
    }
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "popular_updates_section",
        title: "Popular Updates",
        type: DiscoverSectionType.featured,
      },
      {
        id: "latest_releases_section",
        title: "Latest Releases",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "manga_recommend_section",
        title: "Manga Recommend",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "manga_of_day_section",
        title: "Manga of the Day",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "chapter_of_day_section",
        title: "Chapter of the Day",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  private formEncode(params: Record<string, string | number | undefined>): string {
    return Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
  }

  private async searchAPI(search_type: string, search_limit?: number) {
    const bodyParams: Record<string, string | number | undefined> = { search_type };
    if (search_limit !== undefined) bodyParams.search_limit = search_limit;

    await this.fetchCsrf(true);

    const headers: Record<string, string> = {
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: `https://mangaball.net/search-advanced/`,
      "X-Requested-With": "XMLHttpRequest",
      "user-agent": await Application.getDefaultUserAgent(),
    };
    if (this.cachedCsrfToken) {
      headers["X-CSRF-TOKEN"] = this.cachedCsrfToken;
    }
    if (this.cachedXsrfToken) {
      headers["X-XSRF-TOKEN"] = this.cachedXsrfToken;
    }
    if (this.cachedFormToken) {
      bodyParams._token = this.cachedFormToken;
    }
    const apiUrl = new URLBuilder(baseUrl)
      .addPath("api")
      .addPath("v1")
      .addPath("title")
      .addPath("search")
      .build();
    const formBody = this.formEncode(bodyParams);
    const request = {
      url: apiUrl,
      method: "POST",
      body: formBody,
      headers,
    };
    try {
      const [_, data] = await Application.scheduleRequest(request);
      const jsonStr = Application.arrayBufferToUTF8String(data);
      const responseAPI = JSON.parse(jsonStr) as SearchAPIResponse;
      return responseAPI;
    } catch (err) {
      console.error(`[searchAPI] Failed for type=${search_type}:`, err);
      throw err;
    }
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: metadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "popular_updates_section":
        return this.getPopularSectionItems(section, metadata);
      case "latest_releases_section":
        return this.getUpdatedSectionItems(section, metadata);
      case "manga_of_day_section":
        return this.getMangaOfDaySectionItems(section, metadata);
      case "manga_recommend_section":
        return this.getMangaRecommendSectionItems(section, metadata);
      case "chapter_of_day_section":
        return this.getChapterOfDaySectionItems(section, metadata);
      default:
        return { items: [] };
    }
  }

  private async getSearchDetails(): Promise<SearchDetails | undefined> {
    return STATIC_SEARCH_DETAILS;
  }

  async getSearchFilters(): Promise<SearchFilter[]> {
    const filters: SearchFilter[] = [];
    const searchDetails = await this.getSearchDetails();

    filters.push({
      id: "nsfw",
      type: "dropdown",
      options: [
        { id: "false", value: "No" },
        { id: "true", value: "Yes" },
      ],
      value: "false",
      title: "Show 18+ Content",
    });

    if (searchDetails?.tagCategories?.length) {
      for (const cat of searchDetails.tagCategories) {
        filters.push({
          id: `tags_${cat.id}`,
          type: "multiselect",
          options: cat.tags.map((t) => ({ id: t.id, value: t.name })),
          allowExclusion: true,
          value: {},
          allowEmptySelection: true,
          title: cat.label,
          maximum: undefined,
        });
      }
    }
    if (searchDetails?.demographics?.length) {
      filters.push({
        id: "demographics",
        type: "dropdown",
        options: searchDetails.demographics.map((d) => ({ id: d.id, value: d.label })),
        value: "any",
        title: "Demographic",
      });
    }
    if (searchDetails?.translatedLanguages?.length) {
      filters.push({
        id: "translatedLanguages",
        type: "multiselect",
        options: searchDetails.translatedLanguages.map((l) => ({ id: l.id, value: l.label })),
        allowExclusion: false,
        value: {},
        allowEmptySelection: true,
        title: "Translated Languages",
        maximum: undefined,
      });
    }
    if (searchDetails?.originalLanguages?.length) {
      filters.push({
        id: "originalLanguages",
        type: "multiselect",
        options: searchDetails.originalLanguages.map((l) => ({ id: l.id, value: l.label })),
        allowExclusion: false,
        value: {},
        allowEmptySelection: true,
        title: "Original Languages",
        maximum: undefined,
      });
    }
    return filters;
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    const searchDetails = await this.getSearchDetails();
    if (!searchDetails || !searchDetails.sortBy) {
      return [];
    }
    return searchDetails.sortBy.map((sort) => ({
      id: sort.id,
      label: sort.label,
    }));
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: metadata | undefined,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.searchCollectedIds ?? [];
    const getFilterValue = (id: string) => query.filters.find((filter) => filter.id == id)?.value;

    const nsfw = getFilterValue("nsfw") as string | undefined;

    const tag_included_ids: string[] = [];
    const tag_excluded_ids: string[] = [];
    if (STATIC_SEARCH_DETAILS.tagCategories) {
      for (const cat of STATIC_SEARCH_DETAILS.tagCategories) {
        const tags = getFilterValue(`tags_${cat.id}`) as
          | Record<string, "included" | "excluded">
          | undefined;
        if (tags) {
          for (const [slugOrId, v] of Object.entries(tags)) {
            let tagId = slugOrId;
            const found = cat.tags.find((t) => t.id === slugOrId || t.slug === slugOrId);
            if (found) tagId = found.id;
            if (v === "included") tag_included_ids.push(tagId);
            else if (v === "excluded") tag_excluded_ids.push(tagId);
          }
        }
      }
    }

    const contentRating = getFilterValue("contentRating") as string | undefined;
    const demographic = getFilterValue("demographics") as string | undefined;
    const person = getFilterValue("person") as string | undefined;
    const originalLanguages = getFilterValue("originalLanguages") as
      | Record<string, true>
      | undefined;
    const publicationYear = getFilterValue("publicationYear") as string | undefined;
    const publicationStatus = getFilterValue("publicationStatus") as string | undefined;
    const translatedLanguages = getFilterValue("translatedLanguages") as
      | Record<string, true>
      | undefined;

    const sort = sortingOption?.id || "none";
    const search_input = query.title?.trim() || "";

    const filters: Record<string, unknown> = {
      sort,
      tag_included_mode: "and",
      tag_excluded_mode: "and",
      contentRating: contentRating || "any",
      demographic: demographic || "any",
      person: person || "any",
      originalLanguages: "any",
      publicationYear: publicationYear || "",
      publicationStatus: publicationStatus || "any",
      userSettingsEnabled: false,
    };

    if (tag_included_ids.length > 0) filters["tag_included_ids"] = tag_included_ids;
    if (tag_excluded_ids.length > 0) filters["tag_excluded_ids"] = tag_excluded_ids;

    if (originalLanguages) {
      delete filters["originalLanguages"];
      for (const lang of Object.keys(originalLanguages)) {
        if (!Array.isArray(filters["originalLanguages"])) filters["originalLanguages"] = [];
        (filters["originalLanguages"] as string[]).push(lang);
      }
    }
    if (translatedLanguages) {
      for (const lang of Object.keys(translatedLanguages)) {
        if (!Array.isArray(filters["translatedLanguages"])) filters["translatedLanguages"] = [];
        (filters["translatedLanguages"] as string[]).push(lang);
      }
    }
    filters["page"] = page;

    const formBody = [
      `search_input=${encodeURIComponent(search_input)}`,
      ...Object.entries(filters).flatMap(([k, v]) => {
        if (Array.isArray(v)) {
          return v.map(
            (val) => `${encodeURIComponent(`filters[${k}][]`)}=${encodeURIComponent(String(val))}`,
          );
        } else {
          return `${encodeURIComponent(`filters[${k}]`)}=${encodeURIComponent(String(v))}`;
        }
      }),
    ].join("&");

    await this.fetchCsrf(true);

    const headers: Record<string, string> = {
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: baseUrl.replace(/\/$/, ""),
      Referer: baseUrl + "search-advanced",
      "X-Requested-With": "XMLHttpRequest",
      "user-agent": await Application.getDefaultUserAgent(),
    };
    if (nsfw === "true") {
      headers["x-enable-nsfw"] = "true";
    }
    if (this.cachedCsrfToken) headers["X-CSRF-TOKEN"] = this.cachedCsrfToken;
    if (this.cachedXsrfToken) headers["X-XSRF-TOKEN"] = this.cachedXsrfToken;
    if (this.cachedFormToken) headers["x-csrf-token"] = this.cachedFormToken;

    const apiUrl = new URLBuilder(baseUrl)
      .addPath("api")
      .addPath("v1")
      .addPath("title")
      .addPath("search-advanced")
      .build();
    const request = {
      url: apiUrl,
      method: "POST",
      body: formBody,
      headers,
    };
    try {
      const [_, data] = await Application.scheduleRequest(request);
      const jsonStr = Application.arrayBufferToUTF8String(data);
      const response = JSON.parse(jsonStr) as SearchAPIResponse;
      const searchResults: SearchResultItem[] = [];
      for (const raw of response.data ?? []) {
        let mangaId = raw.url;
        const idMatch = raw.url.match(/\/title-detail\/([^/?#]+)/);
        if (idMatch) {
          mangaId = idMatch[1];
        } else {
          mangaId = raw.url.split("/").filter(Boolean).pop() || raw.url;
        }

        console.log("Computed mangaId:", mangaId);
        collectedIds.push(mangaId);

        // Parse alternateName (HTML badges)
        let altTitles: string[] = [];
        if (raw.alternateName) {
          try {
            const $alt = cheerio.load(String(raw.alternateName));
            altTitles = $alt("span")
              .map((_, el) => $alt(el).text().trim())
              .get();
          } catch {
            // Ignore alternate name parsing errors
          }
        }

        // Parse tags (HTML badges)
        let tagNames: string[] = [];
        if (raw.tags) {
          try {
            const $tags = cheerio.load(String(raw.tags));
            tagNames = $tags("span")
              .map((_, el) => $tags(el).text().trim())
              .get();
          } catch {
            // Ignore tag parsing errors
          }
        }

        // Parse authors (HTML badges)
        let authorNames: string[] = [];
        if (raw.authors) {
          try {
            const $auth = cheerio.load(String(raw.authors));
            authorNames = $auth("span")
              .map((_, el) => $auth(el).text().trim())
              .get();
          } catch {
            // Ignore author parsing errors
          }
        }

        // Parse status (HTML badge)
        let statusText = "";
        if (raw.status) {
          try {
            const $status = cheerio.load(String(raw.status));
            statusText = $status("span").first().text().trim();
          } catch {
            statusText = String(raw.status);
          }
        }

        // Extract chapter text from last_chapter HTML
        let latestChapter = "";
        if (raw.last_chapter) {
          try {
            const $lc = cheerio.load(String(raw.last_chapter));
            latestChapter = $lc("a").first().text().trim();
            // Fallback: if no anchor found, just take the text
            if (!latestChapter) {
              latestChapter = $lc.root().text().trim();
            }
          } catch {
            latestChapter = String(raw.last_chapter)
              .replace(/<[^>]*>?/gm, "")
              .trim();
          }
        }

        let subtitle = toRelativeTime(raw.updated_at);
        if (latestChapter) {
          subtitle = `${latestChapter} | ${subtitle}`;
        }

        searchResults.push({
          mangaId: mangaId,
          imageUrl: String(raw.cover || raw.background || ""),
          title: String(raw.name || ""),
          subtitle: subtitle,
          metadata: {
            chapterId: raw.last_chapter || undefined,
            altTitles,
            tagNames,
            authorNames,
            statusText,
            originalId: raw._id,
            originalUrl: raw.url,
          },
        });
      }
      let nextPage: number | undefined = undefined;
      if (response.pagination && response.pagination.current_page < response.pagination.last_page) {
        nextPage = response.pagination.current_page + 1;
      }
      return {
        items: searchResults,
        metadata: nextPage ? { page: nextPage, searchCollectedIds: collectedIds } : undefined,
      };
    } catch (err) {
      console.error(`[getSearchResults] Failed:`, err);
      throw err;
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = {
      url: new URLBuilder(baseUrl).addPath("title-detail").addPath(mangaId).build(),
      method: "GET",
    };
    const $ = await this.fetchCheerio(request);

    const title = $("#comicDetail h6").first().text().trim();
    const altTitles: string[] = [];
    $(".alternate-name-container span").each((_, el) => {
      const t = $(el).text().trim();
      if (t) altTitles.push(t);
    });

    let image = $(".featured-cover").attr("src") || $(".featured-cover").attr("data-src") || "";
    if (image && !image.startsWith("http")) {
      image = image.startsWith("/") ? `${baseUrl}${image.slice(1)}` : `${baseUrl}${image}`;
    }

    const description = $(".description-text p").html() || "";

    const authors: string[] = [];
    $(".badge.bg-secondary.bg-opacity-75 i.fa-user-edit")
      .parent()
      .nextAll("span")
      .each((_, el) => {
        const t = $(el).text().trim();
        if (t) authors.push(t);
      });

    let status = $(".badge.bg-success.me-3").first().text().trim();
    if (!status) status = $(".badge.bg-danger.me-3").first().text().trim();

    const tagGroups: TagSection[] = [];
    const tagBadges = $(
      ".badge.bg-success,.badge.bg-info,.badge.bg-warning,.badge.bg-danger",
    ).filter(function () {
      return !!$(this).attr("data-tag-id");
    });
    if (tagBadges.length > 0) {
      tagGroups.push({
        id: "tags",
        title: "Tags",
        tags: tagBadges
          .map((_, el) => ({
            id: $(el).attr("data-tag-id") || "",
            title: $(el).text().trim(),
          }))
          .get(),
      });
    }

    let rating = 0;
    const ratingText = $(".fa-star.text-warning").parent().find("span").text().trim();
    if (ratingText) {
      const parsed = parseFloat(ratingText);
      if (!isNaN(parsed)) rating = parsed;
    }

    return {
      mangaId: mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: altTitles,
        thumbnailUrl: image,
        synopsis: description,
        rating,
        contentRating: ContentRating.EVERYONE,
        status,
        tagGroups,
        shareUrl: request.url,
        author: authors.join(", "),
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const match = mangaId.match(/([a-f0-9]{24})$/);
    const titleId = match ? match[1] : mangaId;

    const csrfToken = this.cachedFormToken || this.cachedCsrfToken || "";

    const apiUrl = `${baseUrl}api/v1/chapter/chapter-listing-by-title-id/`;
    const headers: Record<string, string> = {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: baseUrl.replace(/\/$/, ""),
      referer: `${baseUrl}title-detail/${mangaId}/`,
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      "x-csrf-token": csrfToken,
      "x-requested-with": "XMLHttpRequest",
    };

    const body = `title_id=${encodeURIComponent(titleId)}`;
    const request = {
      url: apiUrl,
      method: "POST",
      headers,
      body,
    };

    const [_, data] = await Application.scheduleRequest(request);
    const json = JSON.parse(Application.arrayBufferToUTF8String(data)) as ChapterApiResponse; // Assume valid response
    const chapters: Chapter[] = [];
    const seen = new Set<string>();

    for (const ch of json.ALL_CHAPTERS ?? []) {
      for (const t of ch.translations ?? []) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        chapters.push({
          chapterId: t.id,
          sourceManga,
          title: t.name || ch.title || ch.number || "",
          volume: t.volume || 0,
          chapNum: ch.number_float || 0,
          publishDate: t.date ? new Date(t.date) : undefined,
          langCode: t.languageName || t.language || "",
          version: t.group?.name || "",
        });
      }
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const request: Request = {
      url: `${baseUrl}chapter-detail/${chapter.chapterId}`,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const pages: string[] = [];

    const script = $("script")
      .filter((_, el) => {
        const html = $(el).html() || "";
        return html.includes("const chapterImages = JSON.parse(");
      })
      .first()
      .html();

    if (script) {
      const match = script.match(/const chapterImages\s*=\s*JSON\.parse\(`(.+?)`\)/s);
      if (match) {
        try {
          const images = JSON.parse(match[1]);
          if (Array.isArray(images)) {
            pages.push(...images);
          }
        } catch {
          throw new Error("Failed to parse chapter images");
        }
      }
    }

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages: pages,
    };
  }

  async getUpdatedSectionItems(
    section: DiscoverSection,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const latest = await this.searchAPI("getLatestTable");
    const parsed = parseApiItemsToDiscoverItems(latest?.data ?? [], collectedIds, {
      itemType: "chapterUpdatesCarouselItem",
      extractChapterInfo: true,
      customSubtitleExtractor: (raw: APIItem) => {
        return String(raw.updated_at || "");
      },
    });

    return { items: parsed.items, metadata: { page: page + 1, collectedIds: parsed.collectedIds } };
  }

  async getPopularSectionItems(
    section: DiscoverSection,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const Popular = await this.searchAPI("getFeatured");
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const parsed = parseApiItemsToDiscoverItems(Popular.data, collectedIds);
    return { items: parsed.items, metadata: { page: page + 1, collectedIds: parsed.collectedIds } };
  }

  async getMangaOfDaySectionItems(
    section: DiscoverSection,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const recent = await this.searchAPI("getRecentRead");
    const parsed = parseApiItemsToDiscoverItems(recent?.data ?? [], collectedIds, {
      customSubtitleExtractor: (raw: APIItem) => String(raw.updated_at || ""),
    });

    return { items: parsed.items, metadata: { page: page + 1, collectedIds: parsed.collectedIds } };
  }

  async getMangaRecommendSectionItems(
    section: DiscoverSection,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];
    const recommend = await this.searchAPI("getRecommend");
    const parsed = parseApiItemsToDiscoverItems(recommend?.data ?? [], collectedIds);
    return { items: parsed.items, metadata: { page: page + 1, collectedIds: parsed.collectedIds } };
  }

  async getChapterOfDaySectionItems(
    section: DiscoverSection,
    metadata: { page?: number; collectedIds?: string[] } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const recent = await this.searchAPI("getRecentChapterRead");
    const parsed = parseApiItemsToDiscoverItems(recent?.data ?? [], collectedIds, {
      customSubtitleExtractor: (raw: APIItem) => String(raw.updated_at || ""),
    });

    return { items: parsed.items, metadata: { page: page + 1, collectedIds: parsed.collectedIds } };
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
    const [_, data] = await Application.scheduleRequest(request);
    const htmlStr = Application.arrayBufferToUTF8String(data);
    const dom = htmlparser2.parseDocument(htmlStr);
    return cheerio.load(dom);
  }
}

function toRelativeTime(dateText: string): string {
  if (!dateText || typeof dateText !== "string" || !dateText.trim()) {
    return "";
  }

  const now = Date.now();
  let date: Date | undefined;

  // Try parsing as timestamp (seconds or ms)
  const trimmed = dateText.trim();
  if (/^\d{10,13}$/.test(trimmed)) {
    // If 13 digits, treat as ms; if 10 digits, treat as seconds
    if (trimmed.length === 13) {
      date = new Date(Number(trimmed));
    } else if (trimmed.length === 10) {
      date = new Date(Number(trimmed) * 1000);
    }
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    // Handle "YYYY-MM-DD HH:mm:ss"
    const m = dateText.trim().match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (m) {
      date = new Date(
        Number(m[1]), // year
        Number(m[2]) - 1, // month (0-based)
        Number(m[3]), // day
        Number(m[4]), // hour
        Number(m[5]), // minute
        Number(m[6]), // second
      );
    }
  } else if (!isNaN(Date.parse(trimmed))) {
    date = new Date(trimmed);
  }

  if (!date || isNaN(date.getTime())) {
    // Fallback: return as-is
    return trimmed;
  }

  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600)
    return `${Math.floor(diff / 60)} minute${Math.floor(diff / 60) === 1 ? "" : "s"} ago`;
  if (diff < 86400)
    return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) === 1 ? "" : "s"} ago`;
  if (diff < 2592000)
    return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) === 1 ? "" : "s"} ago`;
  if (diff < 31536000)
    return `${Math.floor(diff / 2592000)} month${Math.floor(diff / 2592000) === 1 ? "" : "s"} ago`;
  return `${Math.floor(diff / 31536000)} year${Math.floor(diff / 31536000) === 1 ? "" : "s"} ago`;
}

export const Mangaball = new MangaballExtension();
