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
  Form,
  MangaProviding,
  PagedResults,
  Request,
  SearchFilter,
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SettingsFormProviding,
  SortingOption,
  SourceManga,
  Tag,
  TagSection,
} from "@paperback/types";
import { SettingsForm } from "./forms";
import { NHentaiInterceptor } from "./interceptors";
import {
  getExtraArgumentsSetting,
  getLanguageAbbreviationFromSlug,
  getLanguageToken,
  SORT_OPTIONS,
  getHideReadSetting,
} from "./settings";

import tagsData from "./tags.json";

const BASE_URL = "https://nhentai.net";
const API_URL = `${BASE_URL}/api`;
const THUMB_HOST = "https://i.nhentai.net";
const IMAGE_HOST = "https://i3.nhentai.net";
const EMPTY_QUERY = '""';
const READ_STATE_KEY = "nhentai.readHistory";

interface FilterOption {
  id: string;
  label: string;
  token?: string;
}

const LENGTH_FILTER_OPTIONS: FilterOption[] = [
  { id: "all", label: "All" },
  { id: "gt20", label: "More than 20 pages", token: ">20" },
  { id: "gt40", label: "More than 40 pages", token: ">40" },
  { id: "gt80", label: "More than 80 pages", token: ">80" },
  { id: "gt120", label: "More than 120 pages", token: ">120" },
  { id: "gt200", label: "More than 200 pages", token: ">200" },
  { id: "le20", label: "20 pages or less", token: "<=20" },
];

const FAVORITES_FILTER_OPTIONS: FilterOption[] = [
  { id: "all", label: "All" },
  { id: "fav_100", label: "More than 100 favorites", token: ">100" },
  { id: "fav_250", label: "More than 250 favorites", token: ">250" },
  { id: "fav_500", label: "More than 500 favorites", token: ">500" },
  { id: "fav_1000", label: "More than 1k favorites", token: ">1000" },
  { id: "fav_2500", label: "More than 2.5k favorites", token: ">2500" },
  { id: "fav_5000", label: "More than 5k favorites", token: ">5000" },
  { id: "fav_7500", label: "More than 7.5k favorites", token: ">7500" },
  { id: "fav_10000", label: "More than 10k favorites", token: ">10000" },
  { id: "fav_20000", label: "More than 20k favorites", token: ">20000" },
  { id: "fav_50000", label: "More than 50k favorites", token: ">50000" },
];

const POPULAR_SECTIONS = [
  { id: "popular_today", title: "Popular Today", sort: "popular-today" },
  { id: "popular_week", title: "Popular Weekly", sort: "popular-week" },
  { id: "popular_month", title: "Popular Monthly", sort: "popular-month" },
  { id: "popular_all", title: "Popular All-Time", sort: "popular" },
] as const;

type TagDefinition = { id: string; label: string };
const popularTags: TagDefinition[] = (
  tagsData as { popularTags: TagDefinition[] }
).popularTags;

const IMAGE_TYPE_MAP: Record<string, string> = {
  j: "jpg",
  p: "png",
  g: "gif",
  w: "webp",
};

// NOTE: The readCache and associated functions assume single-threaded execution.
// If used in a multi-threaded environment, race conditions may occur.
// Consider implementing synchronization if concurrency is introduced.
let readCache: Set<string> | undefined;

interface GalleryTag {
  id: number;
  type: string;
  name: string;
  url: string;
  count: number;
}

interface GalleryTitle {
  english: string | null;
  japanese: string | null;
  pretty: string;
}

interface GalleryImage {
  t: string;
}

interface Gallery {
  id: number;
  media_id: string;
  title: GalleryTitle;
  images: {
    pages: GalleryImage[];
    cover: GalleryImage;
    thumbnail: GalleryImage;
  };
  tags: GalleryTag[];
  num_pages: number;
  num_favorites: number;
  upload_date: number;
}

interface QueryResponse {
  result?: Gallery[];
  num_pages: number;
  per_page: number;
  error?: string;
}

interface PaginationMetadata {
  page?: number;
}

type NHentaiImplementation = Extension &
  SettingsFormProviding &
  DiscoverSectionProviding &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding;

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

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "new_uploads",
        title: "New Uploads",
        type: DiscoverSectionType.simpleCarousel,
      },
      ...POPULAR_SECTIONS.map((section) => ({
        id: section.id,
        title: section.title,
        type: DiscoverSectionType.simpleCarousel,
      })),
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: PaginationMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const sortKey =
      section.id === "new_uploads"
        ? "date"
        : (POPULAR_SECTIONS.find((entry) => entry.id === section.id)?.sort ??
          "popular");

    const query = this.buildQueryString();
    const response = await this.fetchSearch(query, page, sortKey);
    let galleries = response.result ?? [];
    if (getHideReadSetting()) {
      galleries = galleries.filter((g) => !isMangaRead(g.id.toString()));
    }
    const items = galleries.map((gallery) => this.mapGalleryToDiscoverItem(gallery));
    const hasNextPage = page < response.num_pages;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async getSearchFilters(): Promise<SearchFilter[]> {
    const filters: SearchFilter[] = [];

    // Length
    filters.push({
      id: "length",
      type: "dropdown",
      title: "Length",
      value: "all",
      options: LENGTH_FILTER_OPTIONS.map((option) => ({
        id: option.id,
        value: option.label,
      })),
    });

    // Favorites
    filters.push({
      id: "favorites",
      type: "dropdown",
      title: "Favorites",
      value: "all",
      options: FAVORITES_FILTER_OPTIONS.map((option) => ({
        id: option.id,
        value: option.label,
      })),
    });

    // Popular Tags - Include
    filters.push({
      id: "tags",
      type: "multiselect",
      title: "Tags",
      value: {},
      options: popularTags.map((tag) => ({
        id: tag.id,
        value: tag.label,
      })),
        allowExclusion: true,
        allowEmptySelection: true,
        maximum: undefined
    });

    return filters;
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    return SORT_OPTIONS.map((option) => ({
      id: option.id,
      label: option.label,
    }));
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: PaginationMetadata | undefined,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const trimmedTitle = query.title?.trim() ?? "";

    if (trimmedTitle && /^\d+$/.test(trimmedTitle)) {
      try {
        const gallery = await this.fetchGallery(trimmedTitle);
        return {
          items: [this.mapGalleryToSearchResult(gallery)],
          metadata: undefined,
        };
      } catch (error) {
        console.error("Failed to fetch gallery by ID", error);
        return { items: [], metadata: undefined };
      }
    }

    const {
      tokens: filterTokens,
      favoritesConstraint,
    } = this.buildFilterTokens(query.filters);

    // Define interface for tags filter value
    interface TagsFilterValue {
      [tagId: string]: "included" | "excluded";
    }

    // Type guard for TagsFilterValue
    function isTagsFilterValue(value: unknown): value is TagsFilterValue {
      if (typeof value !== "object" || value === null) return false;
      const obj = value as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        const v = obj[key];
        if (v !== "included" && v !== "excluded") return false;
      }
      return true;
    }

    // Get tags from filter
    const tagsFilter = query.filters?.find((f) => f.id === "tags");
    const tagsValue: TagsFilterValue = isTagsFilterValue(tagsFilter?.value)
      ? tagsFilter.value
      : {};

    const includedTags: Tag[] = [];
    const excludedTags: Tag[] = [];

    // Process tags based on their inclusion/exclusion state
    for (const [tagId, state] of Object.entries(tagsValue)) {
      const normalizedTagId = tagId.replaceAll("-", " ");
      if (state === "excluded") {
        excludedTags.push({ id: normalizedTagId, title: "" });
      } else if (state === "included") {
        includedTags.push({ id: normalizedTagId, title: "" });
      }
    }

    const tagTokens: string[] = [
      ...this.buildTagTokens(includedTags, false),
      ...this.buildTagTokens(excludedTags, true),
    ];
    const sortOrder = this.resolveSortOrder(query, sortingOption);
    const searchQuery = this.buildQueryString(
      trimmedTitle,
      [...filterTokens, ...tagTokens]
    );
    let response: QueryResponse | undefined;
    try {
      response = await this.fetchSearch(searchQuery, page, sortOrder);
    } catch (e) {
      // Network or interceptor error during fetch; return an empty page instead of propagating to the app
      if (e instanceof Error) {
        console.error("Search fetch aborted or failed:", e.message, e);
      } else {
        console.error("Search fetch aborted or failed:", e);
      }
      return { items: [], metadata: undefined };
    }

    const galleries = response?.result ?? [];

    // Apply optional client-side favorites filtering if the API doesn't support the specific threshold
    const filteredGalleries = favoritesConstraint
      ? galleries.filter((g) => {
          if (favoritesConstraint.type === "min")
            return g.num_favorites >= favoritesConstraint.value;
          return g.num_favorites <= favoritesConstraint.value;
        })
      : galleries;

    let items = filteredGalleries.map((gallery) => this.mapGalleryToSearchResult(gallery));
    if (getHideReadSetting()) {
      items = items.filter((item) => !isMangaRead(item.mangaId));
    }
    const hasNextPage = page < response.num_pages;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const gallery = await this.fetchGallery(mangaId);
    const tagSections = this.createTagSections(gallery);
    const secondaryTitles = [
      gallery.title.english,
      gallery.title.japanese,
      gallery.title.pretty,
    ].filter((title): title is string => !!title);

    return {
      mangaId: gallery.id.toString(),
      mangaInfo: {
        primaryTitle: gallery.title.pretty,
        secondaryTitles: Array.from(new Set(secondaryTitles)),
        thumbnailUrl: this.buildCoverUrl(gallery),
        synopsis: "",
        rating: 0,
        status: "COMPLETED",
        contentRating: ContentRating.ADULT,
        tagGroups: tagSections,
        shareUrl: `${BASE_URL}/g/${gallery.id}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const gallery = await this.fetchGallery(sourceManga.mangaId);
    const languageSlug = this.extractLanguageSlug(gallery.tags);

    const chapter: Chapter = {
      chapterId: gallery.id.toString(),
      sourceManga,
      title: gallery.title.pretty,
      chapNum: 1,
      volume: 1,
      langCode: this.mapLanguageToChapterCode(languageSlug),
      publishDate: new Date(gallery.upload_date * 1000),
    };

    return [chapter];
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const gallery = await this.fetchGallery(chapter.chapterId);
    const pages = gallery.images.pages.map((image, index) =>
      this.buildPageUrl(gallery, index + 1, image),
    );

    // Persist read state for both resolved gallery and parent manga id
    markMangaAsRead(gallery.id.toString());
    markMangaAsRead(chapter.sourceManga.mangaId);

    const details: ChapterDetails = {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };

    return details;
  }

  getMangaShareUrl(mangaId: string): string {
    return `${BASE_URL}/g/${mangaId}`;
  }

  checkCloudflareStatus(status: number): void {
    if (status === 503 || status === 403) {
      throw new CloudflareError({ url: BASE_URL, method: "GET" });
    }
  }

  private async fetchSearch(
    query: string,
    page: number,
    sort: string,
  ): Promise<QueryResponse> {
    const request: Request = {
      url: `${API_URL}/galleries/search?query=${encodeURIComponent(query)}&page=${page}&sort=${encodeURIComponent(sort)}`,
      method: "GET",
    };

    return this.fetchJson<QueryResponse>(request);
  }

  private async fetchGallery(mangaId: string): Promise<Gallery> {
    const request: Request = {
      url: `${API_URL}/gallery/${mangaId}`,
      method: "GET",
    };

    return this.fetchJson<Gallery>(request);
  }

  private async fetchJson<T>(request: Request): Promise<T> {
    const [response, data] = await Application.scheduleRequest(request);
    this.checkCloudflareStatus(response.status);
    const text = Application.arrayBufferToUTF8String(data);
    const parsed = JSON.parse(text) as T & { error?: string };

    if (
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      parsed.error
    ) {
      throw new Error(parsed.error);
    }

    return parsed;
  }

  private buildQueryString(
    title?: string,
    filterTokens: string[] = [],
    options?: { skipDefaultLanguage?: boolean },
  ): string {
    const tokens: string[] = [];

    if (title && title.length > 0) {
      tokens.push(title);
    }

    for (const token of filterTokens) {
      if (token && token.length > 0) {
        tokens.push(token);
      }
    }

    const languageToken = getLanguageToken();
    if (!options?.skipDefaultLanguage && languageToken) {
      tokens.push(`language:${languageToken}`);
    }

    const baseSegment = tokens.join(" ").trim();
    const extraArguments = getExtraArgumentsSetting().trim();
    const combined = [baseSegment, extraArguments]
      .filter((segment) => segment.length > 0)
      .join(" ")
      .trim();
    
    return combined.length > 0 ? combined : EMPTY_QUERY;
  }

  private buildFilterTokens(filters: SearchQuery["filters"] | undefined): {
    tokens: string[];
    favoritesConstraint?: { type: "min" | "max"; value: number };
  } {
    if (!filters || filters.length === 0) {
      return {
        tokens: [],
        favoritesConstraint: undefined,
      };
    }

    const tokens: string[] = [];
    let favoritesConstraint: { type: "min" | "max"; value: number } | undefined;

    const lengthToken = this.getDropdownValue(filters, "length");
    const favoritesToken = this.getDropdownValue(filters, "favorites");

    const lengthOptionToken = this.getOptionToken(
      lengthToken,
      LENGTH_FILTER_OPTIONS,
    );
    if (lengthOptionToken) {
      tokens.push(`pages:${lengthOptionToken}`);
    }

    const favoritesOptionToken = this.getOptionToken(
      favoritesToken,
      FAVORITES_FILTER_OPTIONS,
    );
    if (favoritesOptionToken) {
      tokens.push(`favorites:${favoritesOptionToken}`);
      const favoritesMatch = favoritesOptionToken.match(/^(>=|<=|>|<)(\d+)$/);
      if (favoritesMatch) {
        const operator = favoritesMatch[1];
        const value = Number(favoritesMatch[2]);
        if (!Number.isNaN(value)) {
          if (operator.startsWith(">")) {
            favoritesConstraint = { type: "min", value };
          } else if (operator.startsWith("<")) {
            favoritesConstraint = { type: "max", value };
          }
        }
      }
    }

    return { tokens, favoritesConstraint };
  }

  private getDropdownValue(filters: SearchQuery["filters"] | undefined, id: string): string | undefined {
    if (!filters) return undefined;
    const filter = filters.find((entry) => entry.id === id);
    return typeof filter?.value === "string" ? filter.value : undefined;
  }

  private mapGalleryToDiscoverItem(gallery: Gallery): DiscoverSectionItem {
    return {
      type: "simpleCarouselItem",
      mangaId: gallery.id.toString(),
      imageUrl: this.buildCoverUrl(gallery),
      title: gallery.title.pretty,
      subtitle: this.createSubtitle(gallery),
      contentRating: ContentRating.ADULT,
      metadata: undefined,
    };
  }

  private mapGalleryToSearchResult(gallery: Gallery): SearchResultItem {
    return {
      mangaId: gallery.id.toString(),
      imageUrl: this.buildCoverUrl(gallery),
      title: gallery.title.pretty,
      subtitle: this.createSubtitle(gallery),
      contentRating: ContentRating.ADULT,
      metadata: undefined,
    };
  }

  private buildCoverUrl(gallery: Gallery): string {
    const extension = this.getImageExtension(gallery.images.pages[0]);
    return `${THUMB_HOST}/galleries/${gallery.media_id}/1.${extension}`;
  }

  private buildPageUrl(
    gallery: Gallery,
    index: number,
    image: GalleryImage,
  ): string {
    const extension = this.getImageExtension(image);
    return `${IMAGE_HOST}/galleries/${gallery.media_id}/${index}.${extension}`;
  }

  private getImageExtension(image: GalleryImage): string {
    return IMAGE_TYPE_MAP[image.t] ?? "jpg";
  }

  private createSubtitle(gallery: Gallery): string {
    const languageSlug = this.extractLanguageSlug(gallery.tags);
    const languageAbbrev = getLanguageAbbreviationFromSlug(languageSlug);
    const subtitleParts: string[] = [];
    if (isMangaRead(gallery.id.toString())) {
      subtitleParts.push("rd");
    }
    if (languageAbbrev && languageAbbrev !== "UNK") {
      subtitleParts.push(languageAbbrev.toUpperCase());
    }
    subtitleParts.push(gallery.num_pages.toString());
    subtitleParts.push(gallery.num_favorites.toString());
    return subtitleParts.join(" | ");
  }

  private extractLanguageSlug(tags: GalleryTag[]): string | undefined {
    return tags.find(
      (tag) => tag.type === "language",
    )?.name;
  }

  private mapLanguageToChapterCode(slug: string | undefined): string {
    switch (slug) {
      case "english":
        return "EN";
      case "japanese":
        return "JP";
      case "chinese":
        return "ZH";
      case "korean":
        return "KO";
      default:
        return "EN";
    }
  }

  private buildTagTokens(tags: Tag[] | undefined, excluded: boolean): string[] {
    if (!tags || tags.length === 0) {
      return [];
    }
    const prefix = excluded ? "-" : "";
    const escapeTagValue = (value: string): string =>
      value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return tags
      .map((tag) => {
        const tagId = tag.id?.trim();
        if (!tagId) {
          return undefined;
        }
        if (tagId.includes(":")) {
          const [type, ...rest] = tagId.split(":");
          const value = rest.join(":");
          if (!type || value.length === 0) {
            return undefined;
          }
          const safeValue = escapeTagValue(value);
          return `${prefix}${type}:"${safeValue}"`;
        }
        const safeValue = escapeTagValue(tagId);
        return `${prefix}tag:"${safeValue}"`;
      })
      .filter((token): token is string => !!token && token.length > 0);
  }

  private extractTagSlug(tag: GalleryTag): string | undefined {
    if (tag.url) {
      const segments = tag.url
        .split("/")
        .filter((segment) => segment.length > 0);
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        return lastSegment.split("?")[0];
      }
    }
    if (tag.name) {
      return tag.name.toLowerCase().replace(/\s+/g, "_");
    }
    return undefined;
  }

  private buildTagIdentifier(tag: GalleryTag): string {
    const slug = this.extractTagSlug(tag) ?? tag.id.toString();
    const type = tag.type || "tag";
    return `${type}:${slug}`;
  }

  private createTagSections(gallery: Gallery): TagSection[] {
    const sections: TagSection[] = [];
    const grouped = new Map<string, TagSection>();

    for (const tag of gallery.tags) {
      if (tag.type === "language") {
        continue;
      }

      const sectionId = this.resolveSectionId(tag.type);
      const sectionTitle = this.resolveSectionTitle(tag.type);
      const existing = grouped.get(sectionId);
      const tagEntry: Tag = {
        id: this.buildTagIdentifier(tag),
        title: this.formatTagTitle(tag.name),
      };

      if (existing) {
        existing.tags.push(tagEntry);
      } else {
        grouped.set(sectionId, {
          id: sectionId,
          title: sectionTitle,
          tags: [tagEntry],
        });
      }
    }

    sections.push(
      ...Array.from(grouped.values()).filter(
        (section) => section.tags.length > 0,
      ),
    );

    return sections;
  }

  private resolveSectionId(tagType: string): string {
    switch (tagType) {
      case "tag":
        return "tags";
      case "artist":
        return "artists";
      case "parody":
        return "parodies";
      case "character":
        return "characters";
      case "group":
        return "groups";
      case "category":
        return "categories";
      case "series":
        return "series";
      case "magazine":
        return "magazines";
      default:
        return tagType;
    }
  }

  private resolveSectionTitle(tagType: string): string {
    switch (tagType) {
      case "tag":
        return "Tags";
      case "artist":
        return "Artists";
      case "parody":
        return "Parodies";
      case "character":
        return "Characters";
      case "group":
        return "Groups";
      case "category":
        return "Categories";
      case "series":
        return "Series";
      case "magazine":
        return "Magazines";
      default:
        return tagType.charAt(0).toUpperCase() + tagType.slice(1);
    }
  }

  private formatTagTitle(name: string): string {
    return name
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private resolveSortOrder(
    query: SearchQuery,
    sortingOption?: SortingOption,
  ): string {
    if (sortingOption?.id) {
      return sortingOption.id;
    }

    const sortFilter = query.filters?.find((filter) => filter.id === "sort");
    if (sortFilter && typeof sortFilter.value === "string") {
      const match = SORT_OPTIONS.find(
        (option) => option.id === sortFilter.value,
      );
      if (match) {
        return match.id;
      }
    }

    return SORT_OPTIONS[0].id;
  }

  private getOptionToken(
    value: string | undefined,
    options: FilterOption[],
  ): string | undefined {
    if (!value || value === "all") {
      return undefined;
    }
    const match = options.find((option) => option.id === value);
    if (!match) {
      return undefined;
    }
    return match.token ?? match.id;
  }
}

function getReadCache(): Set<string> {
  if (!readCache) {
    const stored = Application.getState(READ_STATE_KEY) as string[] | undefined;
    readCache = new Set(stored ?? []);
  }
  return readCache;
}

function persistReadCache(): void {
  const cache = getReadCache();
  Application.setState(Array.from(cache), READ_STATE_KEY);
}

function isMangaRead(mangaId: string): boolean {
  return getReadCache().has(mangaId);
}

function markMangaAsRead(mangaId: string): void {
  const cache = getReadCache();
  if (!cache.has(mangaId)) {
    cache.add(mangaId);
    persistReadCache();
  }
}

export const NHentai = new NHentaiExtension();
