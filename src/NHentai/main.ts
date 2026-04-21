import {
  BasicRateLimiter,
  Chapter,
  ChapterDetails,
  ChapterProviding,
  CloudflareBypassRequestProviding,
  CloudflareError,
  ContentRating,
  Cookie,
  CookieStorageInterceptor,
  DiscoverSection,
  DiscoverSectionItem,
  DiscoverSectionProviding,
  DiscoverSectionType,
  Extension,
  Form,
  MangaProviding,
  PagedResults,
  Request,
  Response,
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
  addDescMarkedReadId,
  ALL_DISCOVER_SECTIONS,
  DATE_FILTER_PRESETS,
  DISCOVER_TO_SORT_MAP,
  ensureInstallDate,
  formatDateByPattern,
  getAddTagsToDescriptionSetting,
  getAllRereadManga,
  getDateFormatSetting,
  getDaysOldFilterSetting,
  getDefaultSearchSortSetting,
  getDescMarkedReadIds,
  getDiscoverSectionOrder,
  getDisplayOptionsSetting,
  getEnableRelatedSetting,
  getEnableRereadSectionSetting,
  getExtraArgumentsSetting,
  getFavoritesThresholdMaxSetting,
  getFavoritesThresholdSetting,
  getHiddenSections,
  getHideReadInRelatedSetting,
  getHideReadSetting,
  getIncludeOrGroups,
  getIncognitoModeSetting,
  getLanguageAbbreviationFromSlug,
  getLanguageSetting,
  getLanguageToken,
  getMarkReadOnViewSetting,
  getPagesExpressionSetting,
  getRelatedLanguageSetting,
  getRemoveSeparatorSpacesSetting,
  getRereadCount,
  getSearchFilterDate,
  getSearchFilterFavorites,
  getSearchFilterLength,
  getSearchFilterTags,
  getStrictFavoritesFilterSetting,
  getThumbnailQualitySetting,
  incrementDisplayedManga,
  incrementMarkReadOnDescCount,
  parsePagesExpression,
  recordMangaReadCount,
  recordPageCount,
  recordReadingSession,
  recordTagCounts,
  removeDescMarkedReadId,
  setRelatedLanguageSetting,
  setSearchFilterDate,
  setSearchFilterFavorites,
  setSearchFilterLength,
  setSearchFilterRelatedLanguage,
  setSearchFilterTags,
  SORT_OPTIONS,
} from "./settings";

const DOMAIN = "https://nhentai.net";
const API_V2_URL = `${DOMAIN}/api/v2`;
const EMPTY_QUERY = '""';
const READ_STATE_KEY = "nhentai.readHistory";
const RELATED_IDS_CACHE_KEY = "nhentai.relatedIdsCache";
const RELATED_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const RELATED_VIEW_COUNTS_KEY = "nhentai.relatedViewCounts";
const CDN_IMAGE_SERVERS_STATE_KEY = "nhentai.cdn.imageServers";
const CDN_THUMB_SERVERS_STATE_KEY = "nhentai.cdn.thumbServers";
const CDN_TS_STATE_KEY = "nhentai.cdn.ts";
const CDN_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

// Minimum tile counts before returning results
const MIN_CAROUSEL_TILES = 6;
const SEARCH_PAGE_SIZE = 12;
const STANDARD_SECTION_PAGE_SIZE = 12;
const LAST_READ_PAGE_SIZE = 10;
// Special sections (top_reread, last_read, related) show fewer tiles in carousel
const SPECIAL_SECTION_CAROUSEL_TILES = 6;
const MAX_SEARCH_PAGES = 50; // Max API pages to search through when filtering
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DISCOVER_FETCH_BATCH_SIZE = 1;

// Track how many times each related manga has been shown in the carousel
let relatedViewCounts: Map<number, number> | undefined;
const RELATED_AGE_WINDOW_TILES = 72;

function getRelatedViewCounts(): Map<number, number> {
  if (!relatedViewCounts) {
    const stored = Application.getState(RELATED_VIEW_COUNTS_KEY) as
      | Record<string, number>
      | undefined;
    relatedViewCounts = new Map(
      Object.entries(stored ?? {}).map(([k, v]) => [parseInt(k, 10), v]),
    );
  }
  return relatedViewCounts;
}

function incrementRelatedViewCount(id: number): number {
  const counts = getRelatedViewCounts();
  const current = counts.get(id) ?? 0;
  const newCount = current + 1;
  counts.set(id, newCount);
  const obj: Record<string, number> = {};
  counts.forEach((v, k) => {
    obj[k.toString()] = v;
  });
  Application.setState(obj, RELATED_VIEW_COUNTS_KEY);
  return newCount;
}

interface FilterOption {
  id: string;
  label: string;
  token?: string;
}

const LENGTH_FILTER_OPTIONS: FilterOption[] = [
  { id: "all", label: "All" },
  { id: "le20", label: "Less than 20 pages", token: "<=20" },
  { id: "gt20", label: "More than 20 pages", token: ">20" },
  { id: "gt40", label: "More than 40 pages", token: ">40" },
  { id: "gt80", label: "More than 80 pages", token: ">80" },
  { id: "gt120", label: "More than 120 pages", token: ">120" },
  { id: "gt200", label: "More than 200 pages", token: ">200" },
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
  { id: "popular_week", title: "Popular This Week", sort: "popular-week" },
  { id: "popular_month", title: "Popular This Month", sort: "popular-month" },
  { id: "popular_all", title: "Popular All-Time", sort: "popular" },
] as const;

const POPULAR_TAGS_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const POPULAR_TAGS_STATE_KEY = "nhentai.popularTagsCache";
const POPULAR_TAGS_TS_STATE_KEY = "nhentai.popularTagsCacheTs";

// Persistent gallery cache - survives app restarts
const GALLERY_CACHE_STATE_KEY = "nhentai.galleryCache";
const GALLERY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GALLERY_CACHE_MAX_SIZE = 200; // Max galleries to persist (reduced for storage efficiency)

const RATE_LIMIT_WINDOW_SECONDS = 1.0;
// Static limiter defaults reapplied on each extension initialization.
const NHENTAI_BACKUP_API_REQUESTS_PER_SECOND = 20;
const NHENTAI_IMAGE_REQUESTS_PER_SECOND = 8;

// ============================================================================
// Endpoint-Aware Rate Limiting with Mutex-Style Queue (Session-Only)
// ============================================================================
// nhentai API v2 rate limits per endpoint (from docs):
//   - /api/v2/search: 30/1min per IP
//   - /api/v2/galleries/{id}: 45/1min per IP
//   - /api/v2/galleries (list), /galleries/popular: 60/1min per IP
//   - /api/v2/galleries/{id}/related, /tagged: 90/1min per IP
//
// BURST-BASED RATE LIMITING:
// Instead of waiting between each request, we allow requests to fire as fast as
// possible up to the limit. Only when we hit the limit do we wait for the minute
// window to reset. This provides much faster loading while respecting rate limits.
// ============================================================================

type EndpointClass =
  | "search"
  | "galleryDetail"
  | "galleries"
  | "related"
  | "tagged"
  | "default";

// Track request timestamps for burst-based rate limiting
// Each endpoint class has a list of timestamps of recent requests
interface BurstQueue {
  timestamps: number[];
  mutex: Promise<void>;
}

const burstQueues: Record<EndpointClass, BurstQueue> = {
  search: { timestamps: [], mutex: Promise.resolve() },
  galleryDetail: { timestamps: [], mutex: Promise.resolve() },
  galleries: { timestamps: [], mutex: Promise.resolve() },
  related: { timestamps: [], mutex: Promise.resolve() },
  tagged: { timestamps: [], mutex: Promise.resolve() },
  default: { timestamps: [], mutex: Promise.resolve() },
};

const NHENTAI_ENDPOINT_LIMITS: Record<EndpointClass, number> = {
  search: 30,
  galleryDetail: 45,
  galleries: 60,
  related: 90,
  tagged: 90,
  default: 45,
};

function getEndpointRateLimit(endpointClass: EndpointClass): number {
  return NHENTAI_ENDPOINT_LIMITS[endpointClass];
}

function classifyEndpoint(url: string): EndpointClass {
  // Extract path from URL
  const pathMatch = url.match(/\/api\/v2\/(.+?)(?:\?|$)/);
  if (!pathMatch) return "default";
  const path = pathMatch[1];

  // Search endpoint (most restrictive - 30/min)
  if (path === "search" || path.startsWith("search?")) {
    return "search";
  }

  // Related endpoints (90/min)
  if (path.includes("/related")) {
    return "related";
  }

  // Tagged endpoint (90/min)
  if (path === "galleries/tagged" || path.startsWith("galleries/tagged?")) {
    return "tagged";
  }

  // Gallery detail endpoint (45/min) - /galleries/{id}
  // This is more restrictive than gallery list, needs separate queue
  // Pattern: galleries/<number> (not followed by /popular, /tagged, /random)
  const galleryDetailMatch = path.match(/^galleries\/(\d+)(?:$|\/pages)/);
  if (galleryDetailMatch) {
    return "galleryDetail";
  }

  // Gallery list/popular endpoints (60/min) - includes:
  // - /galleries (list)
  // - /galleries/popular
  // - /cdn, /tags, etc.
  if (
    path.startsWith("galleries") ||
    path.startsWith("cdn") ||
    path.startsWith("tags")
  ) {
    return "galleries";
  }

  return "default";
}

/**
 * Burst-based rate limiting: allows requests to fire as fast as possible
 * up to the rate limit. Only waits when the limit would be exceeded.
 *
 * Key behaviors:
 * 1. Requests fire immediately if under the limit
 * 2. When limit is reached, waits for oldest request to expire (60s window)
 * 3. Mutex ensures concurrent calls don't race past the limit
 */
async function withRateLimit<T>(
  endpointClass: EndpointClass,
  fn: () => Promise<T>,
): Promise<T> {
  const queue = burstQueues[endpointClass];
  const rateLimit = getEndpointRateLimit(endpointClass);
  const WINDOW_MS = 60_000; // 1 minute window

  // Mutex to prevent concurrent calls from racing
  let resolveMutex: () => void;
  const myMutex = new Promise<void>((resolve) => {
    resolveMutex = resolve;
  });
  const prevMutex = queue.mutex;
  queue.mutex = myMutex;

  try {
    await prevMutex;

    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    // Clean up expired timestamps (older than 1 minute)
    queue.timestamps = queue.timestamps.filter((t) => t > windowStart);

    // Check if we're at the limit
    if (queue.timestamps.length >= rateLimit) {
      // Wait for the oldest request to expire
      const oldestTimestamp = queue.timestamps[0];
      const waitMs = oldestTimestamp + WINDOW_MS - now + 100; // +100ms buffer
      if (waitMs > 0) {
        console.log(
          `[NHentai] Rate limit reached for ${endpointClass} (${queue.timestamps.length}/${rateLimit}). ` +
            `Waiting ${Math.round(waitMs / 1000)}s for window to reset.`,
        );
        await Application.sleep(waitMs / 1000);
        // Clean up again after waiting
        queue.timestamps = queue.timestamps.filter(
          (t) => t > Date.now() - WINDOW_MS,
        );
      }
    }

    // Record this request's timestamp
    queue.timestamps.push(Date.now());

    // Execute the actual request
    return await fn();
  } finally {
    resolveMutex!();
  }
}

// ============================================================================
// Discover Section Staggering
// ============================================================================
// Stagger section loads to reduce initial burst when app launches
// All 6 sections fire nearly simultaneously, so we add progressive delays
const SECTION_STAGGER_MS = 100; // 100ms between section API calls
let lastSectionRequestTime = 0;

async function staggeredSectionDelay(): Promise<void> {
  const now = Date.now();
  const timeSinceLast = now - lastSectionRequestTime;

  // Progressive stagger: first section goes immediately,
  // subsequent sections wait progressively longer
  const requiredDelay = SECTION_STAGGER_MS;
  if (timeSinceLast < requiredDelay) {
    const waitMs = requiredDelay - timeSinceLast;
    await Application.sleep(waitMs / 1000);
  }
  lastSectionRequestTime = Date.now();
}

type TagDefinition = { id: string; label: string; count: string };

const IMAGE_TYPE_MAP: Record<string, string> = {
  j: "jpg",
  p: "png",
  g: "gif",
  w: "webp",
};

const DEBUG_NHENTAI =
  typeof process !== "undefined" && process?.env?.KAKAROT_DEBUG_NHENTAI === "1";

function logDebug(...args: unknown[]) {
  if (DEBUG_NHENTAI) {
    console.log("[NHentai]", ...args);
  }
}

function summarizeRelatedPoolOrder(
  items: { id: number; tag: string; cycleIndex: number }[],
): string {
  return items.map((item) => `${item.tag}:${item.id}`).join(", ");
}

type FavoritesConstraint = {
  min?: number;
  max?: number;
};

function hasFavoritesConstraint(
  constraint?: FavoritesConstraint,
): constraint is FavoritesConstraint {
  return (
    constraint !== undefined &&
    (constraint.min !== undefined || constraint.max !== undefined)
  );
}

function matchesFavoritesConstraint(
  gallery: Gallery,
  constraint?: FavoritesConstraint,
): boolean {
  if (!hasFavoritesConstraint(constraint)) return true;
  if (constraint.min !== undefined && gallery.num_favorites < constraint.min) {
    return false;
  }
  if (constraint.max !== undefined && gallery.num_favorites > constraint.max) {
    return false;
  }
  return true;
}

function interleaveGalleryLists(lists: Gallery[][]): Gallery[] {
  const seen = new Set<number>();
  const merged: Gallery[] = [];
  let added = true;

  while (added) {
    added = false;
    for (const list of lists) {
      const next = list.shift();
      if (!next) continue;
      added = true;
      if (seen.has(next.id)) continue;
      seen.add(next.id);
      merged.push(next);
    }
  }

  return merged;
}

function normalizeBridgeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

type NHentaiGlobalHooks = {
  __nhentaiInvalidateRelatedPool?: () => void;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "string" ||
    typeof error === "number" ||
    typeof error === "boolean" ||
    error === null ||
    error === undefined
  ) {
    return String(error ?? "");
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "unknown error";
  }
}

class ReadHistory {
  private _ordered: string[];
  private _lookup: Set<string>;
  constructor(items: string[] = []) {
    this._ordered = [...items];
    this._lookup = new Set(items);
  }
  has(id: string): boolean {
    return this._lookup.has(id);
  }
  markRead(id: string): boolean {
    if (this._lookup.has(id)) {
      this._ordered = [id, ...this._ordered.filter((x) => x !== id)];
      return false;
    }
    this._lookup.add(id);
    this._ordered.unshift(id);
    return true;
  }
  get ordered(): string[] {
    return this._ordered;
  }
  get size(): number {
    return this._lookup.size;
  }
  toArray(): string[] {
    return [...this._ordered];
  }
}

let readHistory: ReadHistory | undefined;

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
  t?: string;
  path?: string;
  thumbnail?: string;
}

interface Gallery {
  id: number;
  media_id: string;
  isLite?: boolean;
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

interface V2GalleryListItem {
  id: number;
  media_id: string;
  thumbnail: string;
  thumbnail_width: number;
  thumbnail_height: number;
  english_title: string | null;
  japanese_title: string | null;
  tag_ids: number[];
  num_pages?: number; // Available from search API
}

interface V2SearchResponse {
  result?: V2GalleryListItem[];
  num_pages: number;
  per_page: number;
  total?: number | null;
  error?: string;
}

interface V2GalleryAsset {
  path: string;
  width: number;
  height: number;
}

interface V2GalleryPageAsset extends V2GalleryAsset {
  number: number;
  thumbnail: string;
  thumbnail_width: number;
  thumbnail_height: number;
}

interface V2GalleryDetailResponse {
  id: number;
  media_id: string;
  title: GalleryTitle;
  cover: V2GalleryAsset;
  thumbnail: V2GalleryAsset;
  tags: GalleryTag[];
  num_pages: number;
  num_favorites: number;
  upload_date: number;
  pages: V2GalleryPageAsset[];
}

interface V2RelatedResponse {
  result?: V2GalleryListItem[];
  error?: string;
}

interface V2TagEntry {
  id: number;
  type: string;
  name: string;
  slug: string;
  url: string;
  count: number;
}

interface V2TagListResponse {
  result?: V2TagEntry[];
  num_pages: number;
  per_page: number;
  total?: number | null;
  error?: string;
}

interface V2CdnResponse {
  image_servers?: string[];
  thumb_servers?: string[];
  error?: string;
}

interface ResponseAndText {
  response: Response;
  text: string;
}

interface PaginationMetadata {
  page?: number;
  buffer?: Gallery[];
  numPages?: number;
}

type NHentaiImplementation = Extension &
  SettingsFormProviding &
  DiscoverSectionProviding &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  CloudflareBypassRequestProviding;

export class NHentaiExtension implements NHentaiImplementation {
  requestManager = new NHentaiInterceptor("main");
  cookieStorageInterceptor = new CookieStorageInterceptor({
    storage: "stateManager",
  });
  // Keep request pressure conservative to avoid NHentai 429 spikes under
  // concurrent discover section loads. This is now a backup limiter - the
  // primary rate limiting is done by the endpoint-aware system in fetchJson.
  globalRateLimiter = new BasicRateLimiter("rateLimiter", {
    numberOfRequests: NHENTAI_BACKUP_API_REQUESTS_PER_SECOND,
    bufferInterval: RATE_LIMIT_WINDOW_SECONDS,
    ignoreImages: true,
  });
  // Keep image requests throttled, but with a higher ceiling than API traffic.
  // A low value here causes long reader queues when users scroll quickly.
  imageRateLimiter = new BasicRateLimiter("imageRateLimiter", {
    numberOfRequests: NHENTAI_IMAGE_REQUESTS_PER_SECOND,
    bufferInterval: RATE_LIMIT_WINDOW_SECONDS,
    ignoreImages: false,
  });
  private popularTagsCache?: TagDefinition[];
  private popularTagsFetch?: Promise<TagDefinition[]>;
  private popularTagsCacheTs?: number;
  private cdnImageServers?: string[];
  private cdnThumbServers?: string[];
  private cdnConfigTs?: number;
  private cdnConfigFetch?: Promise<void>;
  private searchCache = new Map<
    string,
    { response: QueryResponse; ts: number }
  >();
  private searchPending = new Map<string, Promise<QueryResponse>>();
  // Cached SearchFilter[] output to avoid rebuilding on every framework call
  // Cached SearchFilter[] output — REMOVED caching to ensure fresh state reads
  private searchFiltersDirty = true;

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
    this.globalRateLimiter.registerInterceptor();
    this.imageRateLimiter.registerInterceptor();
    // Register global callback for related pool invalidation
    (globalThis as NHentaiGlobalHooks).__nhentaiInvalidateRelatedPool = () =>
      this.invalidateRelatedPool();
    // Ensure install date is set for statistics
    ensureInstallDate();

    try {
      const savedImageServers = Application.getState(
        CDN_IMAGE_SERVERS_STATE_KEY,
      ) as string[] | undefined;
      const savedThumbServers = Application.getState(
        CDN_THUMB_SERVERS_STATE_KEY,
      ) as string[] | undefined;
      const savedTs = Application.getState(CDN_TS_STATE_KEY) as
        | number
        | undefined;

      if (Array.isArray(savedImageServers) && savedImageServers.length > 0) {
        this.cdnImageServers = savedImageServers;
      }
      if (Array.isArray(savedThumbServers) && savedThumbServers.length > 0) {
        this.cdnThumbServers = savedThumbServers;
      }
      if (typeof savedTs === "number") {
        this.cdnConfigTs = savedTs;
      }
    } catch {
      // Ignore state restore issues for CDN config.
    }

    const hasServers =
      (this.cdnImageServers?.length ?? 0) > 0 &&
      (this.cdnThumbServers?.length ?? 0) > 0;
    const needsRefresh =
      !this.cdnConfigTs ||
      Date.now() - this.cdnConfigTs >= CDN_CACHE_TTL_MS ||
      !hasServers;
    if (needsRefresh) {
      this.cdnConfigFetch = this.refreshCdnConfig().finally(() => {
        this.cdnConfigFetch = undefined;
      });
      void this.cdnConfigFetch;
    }
  }

  // Static accessor for settings form
  getPopularTagsForSettings(): TagDefinition[] {
    if (this.popularTagsCache == null) {
      this.popularTagsFetch = this.getPopularTags();
    }
    return this.popularTagsCache ?? [];
  }

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    const order = getDiscoverSectionOrder();
    const hidden = getHiddenSections();
    const sectionMap = new Map(ALL_DISCOVER_SECTIONS.map((s) => [s.id, s]));

    const sections: DiscoverSection[] = [];
    for (const id of order) {
      if (hidden.has(id)) continue;
      if (id === "related" && !getEnableRelatedSetting()) continue;
      if (id === "top_reread" && !getEnableRereadSectionSetting()) continue;

      const def = sectionMap.get(id);
      if (!def) continue;
      sections.push({
        id: def.id,
        title: def.title,
        type: DiscoverSectionType.simpleCarousel,
      });
    }

    return sections;
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: PaginationMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    // Stagger section requests to prevent burst on app launch
    // Only stagger initial page loads (metadata.page === undefined or 1)
    if (!metadata?.page || metadata.page === 1) {
      await staggeredSectionDelay();
    }

    // Handle Related section separately
    if (section.id === "related") {
      return this.getRelatedSection(metadata);
    }

    // Handle Last Read section
    if (section.id === "last_read") {
      return this.getLastReadSection(metadata);
    }

    // Handle Top Reread section
    if (section.id === "top_reread") {
      return this.getTopRereadSection(metadata);
    }

    const initialPage = metadata?.page ?? 1;
    const sectionStart = Date.now();
    const sortKey =
      section.id === "new_uploads"
        ? "date"
        : (POPULAR_SECTIONS.find((entry) => entry.id === section.id)?.sort ??
          "popular");

    const {
      tokens: discoverTokens,
      pagesConstraint: discoverPagesConstraint,
      dateConstraint: discoverDateConstraint,
      favoritesConstraint: discoverFavoritesConstraint,
    } = this.buildFilterTokens(undefined);

    const query = this.buildQueryString(undefined, discoverTokens);
    const hideRead = getHideReadSetting();
    const readCache = hideRead ? getReadCache() : null;

    const MAX_CAROUSEL_TILES = 6;
    let currentPage = initialPage;
    let response: QueryResponse | undefined;
    let items: DiscoverSectionItem[] = [];
    let bufferedGalleries = [
      ...((
        metadata as (PaginationMetadata & { buffer?: Gallery[] }) | undefined
      )?.buffer ?? []),
    ];

    if (bufferedGalleries.length > 0) {
      const initialBufferTake = bufferedGalleries.slice(0, MAX_CAROUSEL_TILES);
      bufferedGalleries = bufferedGalleries.slice(MAX_CAROUSEL_TILES);
      const hydratedFromBuffer = await this.hydrateLiteGalleries(
        initialBufferTake,
        initialBufferTake.length,
      );
      items.push(
        ...hydratedFromBuffer.map((gallery) =>
          this.mapGalleryToDiscoverItem(gallery),
        ),
      );
    }

    // Popular all-time and monthly need to scan deeper since heavy readers
    // have read most of the top results.  Other sections have smaller pools.
    const isDeepScan =
      section.id === "popular_all" || section.id === "popular_month";
    const MAX_PAGES = isDeepScan ? 15 : 10;
    let pagesScanned = 0;
    let reachedEnd = false;

    // Deep-scan sections fire a larger initial batch to find unread items faster
    const DEEP_SCAN_INITIAL_BATCH = 2;
    // Heavy filtering (page count, date, favorites) may discard many results,
    // requiring more API pages.  hideRead alone is cheap — start with smaller
    // batches to avoid saturating the rate limiter when one page suffices.
    const heavyFiltering =
      discoverPagesConstraint !== undefined ||
      discoverDateConstraint !== undefined ||
      discoverFavoritesConstraint !== undefined;
    let attemptedPages = 0;
    let consecutiveFailures = 0;
    while (pagesScanned < MAX_PAGES && items.length < MAX_CAROUSEL_TILES) {
      const batchSize =
        pagesScanned === 0 && isDeepScan
          ? DEEP_SCAN_INITIAL_BATCH
          : pagesScanned === 0 && !heavyFiltering
            ? 1
            : DISCOVER_FETCH_BATCH_SIZE;
      const remainingBatch = Math.min(batchSize, MAX_PAGES - attemptedPages);
      if (remainingBatch <= 0) break;
      const batchPages = Array.from(
        { length: remainingBatch },
        (_, index) => currentPage + index,
      );
      const batchResults = await Promise.all(
        batchPages.map(async (page) => {
          try {
            return {
              page,
              result: await this.fetchSearchWithOrExpansion(
                query,
                page,
                sortKey,
              ),
            };
          } catch (e) {
            if (e instanceof CloudflareError) throw e;
            const msg = getErrorMessage(e);
            if (
              msg.includes("429") ||
              msg.includes("Cloudflare") ||
              msg.includes("Non-JSON")
            ) {
              await this.pause(150);
            }
            return { page, result: null };
          }
        }),
      );

      for (const { page, result } of batchResults) {
        attemptedPages++;
        currentPage = page + 1;
        if (!result) {
          consecutiveFailures++;
          await this.pause(Math.min(2500, 300 * consecutiveFailures));
          if (consecutiveFailures >= 4) {
            reachedEnd = true;
            break;
          }
          continue;
        }

        consecutiveFailures = 0;
        pagesScanned++;

        response = result;
        const galleries = result.result ?? [];
        const filtered =
          hideRead && readCache
            ? galleries.filter((g) => !readCache.has(g.id.toString()))
            : galleries;

        const pagesExact = discoverPagesConstraint?.exact;
        const pagesMin = discoverPagesConstraint?.min;
        const pagesMax = discoverPagesConstraint?.max;

        const strictFavoritesEnabled =
          getStrictFavoritesFilterSetting() &&
          hasFavoritesConstraint(discoverFavoritesConstraint);
        const favoritesSource = strictFavoritesEnabled
          ? await this.hydrateLiteGalleries(filtered, filtered.length, {
              force: true,
            })
          : filtered;

        const filteredForFavorites = hasFavoritesConstraint(
          discoverFavoritesConstraint,
        )
          ? favoritesSource.filter((g) => {
              if (!strictFavoritesEnabled && g.isLite) return true;
              return matchesFavoritesConstraint(g, discoverFavoritesConstraint);
            })
          : favoritesSource;

        const filteredForPages =
          pagesExact !== undefined ||
          pagesMin !== undefined ||
          pagesMax !== undefined
            ? filteredForFavorites.filter((g) => {
                if (g.isLite) return true;
                if (pagesExact !== undefined) return g.num_pages === pagesExact;
                if (pagesMin !== undefined && g.num_pages < pagesMin)
                  return false;
                if (pagesMax !== undefined && g.num_pages > pagesMax)
                  return false;
                return true;
              })
            : filteredForFavorites;

        const filteredForDate = discoverDateConstraint
          ? filteredForPages.filter((g) => {
              if (g.isLite) return true;
              const uploadedMs = g.upload_date * 1000;
              if (discoverDateConstraint.newerThanDays !== undefined) {
                const cutoff =
                  Date.now() -
                  discoverDateConstraint.newerThanDays * 24 * 60 * 60 * 1000;
                if (uploadedMs < cutoff) return false;
              }
              if (discoverDateConstraint.olderThanDays !== undefined) {
                const olderThan =
                  Date.now() -
                  discoverDateConstraint.olderThanDays * 24 * 60 * 60 * 1000;
                if (uploadedMs > olderThan) return false;
              }
              return true;
            })
          : filteredForPages;

        const remainingSlots = MAX_CAROUSEL_TILES - items.length;
        if (remainingSlots > 0) {
          const pageCandidates = filteredForDate.slice(0, remainingSlots);
          const pageRemainder = filteredForDate.slice(remainingSlots);
          if (pageRemainder.length > 0) {
            bufferedGalleries.push(...pageRemainder);
          }
          const hydratedCandidates = await this.hydrateLiteGalleries(
            pageCandidates,
            pageCandidates.length,
          );
          items.push(
            ...hydratedCandidates.map((gallery) =>
              this.mapGalleryToDiscoverItem(gallery),
            ),
          );
        }

        if (page >= result.num_pages) {
          reachedEnd = true;
          break;
        }
        if (items.length >= MAX_CAROUSEL_TILES) {
          break;
        }
      }
      if (reachedEnd) break;
    }

    // Fallback: if hide-read is enabled and every scanned page is filtered out,
    // show a small non-hidden baseline instead of returning an empty section.
    if (items.length === 0 && hideRead) {
      try {
        const fallback = await this.fetchSearchWithOrExpansion(
          query,
          1,
          sortKey,
        );
        const fallbackCandidates = (fallback.result ?? []).slice(
          0,
          MIN_CAROUSEL_TILES,
        );
        const hydratedFallback = await this.hydrateLiteGalleries(
          fallbackCandidates,
          fallbackCandidates.length,
        );
        items.push(
          ...hydratedFallback.map((gallery) =>
            this.mapGalleryToDiscoverItem(gallery),
          ),
        );
      } catch {
        // Keep empty if fallback fails.
      }
    }

    // Last-resort fallback: if every section request failed and produced no
    // response object, run one plain v2 search for this sort to avoid empty
    // carousels caused by malformed/corrupted filter state.
    if (items.length === 0 && response === undefined) {
      try {
        const fallback = await this.fetchSearch(EMPTY_QUERY, 1, sortKey);
        const fallbackCandidates = (fallback.result ?? []).slice(
          0,
          MIN_CAROUSEL_TILES,
        );
        const hydratedFallback = await this.hydrateLiteGalleries(
          fallbackCandidates,
          fallbackCandidates.length,
        );
        items.push(
          ...hydratedFallback.map((gallery) =>
            this.mapGalleryToDiscoverItem(gallery),
          ),
        );
      } catch {
        // Keep empty if fallback fails.
      }
    }

    // Cap items
    items = items.slice(0, MAX_CAROUSEL_TILES);

    // Return metadata: undefined when no items found so framework won't retry
    // Return metadata when items found and more pages exist
    const hasMore =
      bufferedGalleries.length > 0 ||
      (!reachedEnd &&
        response !== undefined &&
        currentPage < response.num_pages);

    recordDisplayedTiles(items);
    console.log(
      `[NHentai] Section "${section.id}" done: ${items.length} items, ${pagesScanned} pages scanned, ${Date.now() - sectionStart}ms`,
    );
    return {
      items,
      metadata:
        items.length > 0 && hasMore
          ? {
              page: currentPage,
              ...(bufferedGalleries.length > 0
                ? { buffer: bufferedGalleries }
                : {}),
            }
          : undefined,
    };
  }

  /**
   * Immediately notify the framework that search filters changed.
   * Coalesces rapid-fire calls within the current event loop tick.
   */
  private debouncedInvalidateSearchFilters(): void {
    this.searchFiltersDirty = true;
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    // Filter out expired cookies before storing
    const now = Date.now();
    const validCookies = cookies.filter((cookie) => {
      if (cookie.expires && cookie.expires.getTime() <= now) {
        return false;
      }
      return true;
    });

    for (const cookie of validCookies) {
      this.cookieStorageInterceptor.deleteCookie(cookie);
    }

    for (const cookie of validCookies) {
      this.cookieStorageInterceptor.setCookie(cookie);
    }
  }

  async getSearchFilters(): Promise<SearchFilter[]> {
    this.searchFiltersDirty = false;

    const filters: SearchFilter[] = [];

    // Length
    filters.push({
      id: "length",
      type: "dropdown",
      title: "Length",
      value: getSearchFilterLength(),
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
      value: getSearchFilterFavorites(),
      options: FAVORITES_FILTER_OPTIONS.map((option) => ({
        id: option.id,
        value: option.label,
      })),
    });

    // Days Old filter
    filters.push({
      id: "daysOld",
      type: "dropdown",
      title: "Date",
      value: getSearchFilterDate(),
      options: DATE_FILTER_PRESETS.map((option) => ({
        id: option.id,
        value: option.label,
      })),
    });

    // Use cached popular tags, blocking only if cache is empty (to prevent empty tag list).
    // Kick off a background fetch if cache is stale.
    if (
      !this.popularTagsCache ||
      !this.popularTagsCacheTs ||
      Date.now() - this.popularTagsCacheTs >= POPULAR_TAGS_CACHE_TTL_MS
    ) {
      if (!this.popularTagsFetch) {
        this.popularTagsFetch = this.getPopularTags();
      }
    }
    // If cache is empty, wait for the in-flight fetch to complete so tags aren't missing
    if (!this.popularTagsCache && this.popularTagsFetch) {
      try {
        await this.popularTagsFetch;
      } catch {
        /* ignore */
      }
    }
    const popularTags = this.popularTagsCache ?? [];
    const savedTags = getSearchFilterTags();
    const cleanedTags: Record<string, "included" | "excluded"> = {
      ...savedTags,
    };
    // Strip leftover apply-manga-filter key from old state
    delete cleanedTags["__apply_manga_filter_tags__"];
    const cleanedChanged =
      Object.keys(cleanedTags).length !== Object.keys(savedTags).length;

    if (cleanedChanged) {
      setSearchFilterTags(cleanedTags);
    }

    // Sort selected/excluded tags to the top of the tag list
    const selectedTagIds = new Set(Object.keys(cleanedTags));
    const sortedPopularTags = [
      ...popularTags.filter((tag) => selectedTagIds.has(tag.id)),
      ...popularTags.filter((tag) => !selectedTagIds.has(tag.id)),
    ];

    filters.push({
      id: "tags",
      type: "multiselect",
      title: "Tags",
      value: cleanedTags,
      options: sortedPopularTags.map((tag) => {
        const showTagCounts =
          getDisplayOptionsSetting().includes("show_tag_counts");
        const cleanedLabel = tag.label.replace(/\s*-\s*\([^)]*\)\s*$/, "");
        return {
          id: tag.id,
          value: showTagCounts ? tag.label : cleanedLabel,
        };
      }),
      allowExclusion: true,
      allowEmptySelection: true,
      maximum: undefined,
    });

    return filters;
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    // Build sort options following the user's discover section order
    const order = getDiscoverSectionOrder();
    const hidden = getHiddenSections();
    const sortLabelMap = new Map(SORT_OPTIONS.map((o) => [o.id, o.label]));
    const options: SortingOption[] = [];

    for (const sectionId of order) {
      if (hidden.has(sectionId)) continue;
      if (sectionId === "related" && !getEnableRelatedSetting()) continue;
      if (sectionId === "top_reread" && !getEnableRereadSectionSetting())
        continue;
      const sortId = DISCOVER_TO_SORT_MAP[sectionId];
      if (!sortId) continue;
      const label = sortLabelMap.get(sortId);
      if (label) options.push({ id: sortId, label });
    }

    // Ensure at least 'date' is present if everything was hidden
    if (options.length === 0) {
      options.push({ id: "date", label: "Date Added" });
    }

    return options;
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: PaginationMetadata | undefined,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const searchStart = Date.now();
    try {
      let currentPage = metadata?.page ?? 1;
      let effectiveSort = this.resolveSortOrder(query, sortingOption);
      if (effectiveSort === "related" && !getEnableRelatedSetting())
        effectiveSort = "date";
      if (effectiveSort === "top_reread" && !getEnableRereadSectionSetting())
        effectiveSort = "date";
      // Increment non-carousel counter when user requests non-related search pages.
      if (effectiveSort !== "related") {
        try {
          this.incrementNonCarouselCounter();
        } catch {
          /* ignore */
        }
      }
      let trimmedTitle = query.title?.trim() ?? "";

      // Detect OR groups typed in the search bar (e.g. "yuri OR maid" or "yuri || maid")
      // Extract them as additionalOrGroups and strip OR from the title so the API
      // doesn't receive a literal OR string it doesn't understand.
      const titleOrGroups: string[][] = [];
      if (/\s*\|\|\s*|\s+OR\s+/i.test(trimmedTitle)) {
        // Split on comma/semicolon to handle multiple OR groups in one query
        const clauseParts = trimmedTitle
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
        const remainingParts: string[] = [];
        for (const clause of clauseParts) {
          if (/\s*\|\|\s*|\s+OR\s+/i.test(clause)) {
            const orParts = this.dedupeQueryTokens(
              clause
                .split(/\s*\|\|\s*|\s+OR\s+/i)
                .map(
                  (s) =>
                    this.buildTagTokens(
                      [{ id: s.trim(), title: "" }],
                      false,
                    )[0] ?? "",
                )
                .filter(Boolean),
            );
            if (orParts.length > 1) {
              titleOrGroups.push(orParts);
            } else if (orParts.length === 1) {
              remainingParts.push(orParts[0]);
            }
          } else {
            remainingParts.push(clause);
          }
        }
        trimmedTitle = remainingParts.join(" ").trim();
      }

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
        pagesConstraint,
        dateConstraint,
      } = this.buildFilterTokens(query.filters);
      let sawTagsFilter = false;

      // Always persist search filter values to state (even on first search)
      if (query.filters) {
        for (const filter of query.filters) {
          if (filter.id === "length" && typeof filter.value === "string") {
            setSearchFilterLength(filter.value);
          } else if (
            filter.id === "favorites" &&
            typeof filter.value === "string"
          ) {
            setSearchFilterFavorites(filter.value);
          } else if (
            filter.id === "daysOld" &&
            typeof filter.value === "string"
          ) {
            setSearchFilterDate(filter.value);
          } else if (
            filter.id === "relatedLanguage" &&
            typeof filter.value === "string"
          ) {
            setSearchFilterRelatedLanguage(filter.value);
            setRelatedLanguageSetting(filter.value);
          } else if (filter.id === "tags") {
            sawTagsFilter = true;
            const tagsValue = filter.value as
              | Record<string, "included" | "excluded">
              | undefined;
            const nextTags = { ...(tagsValue ?? {}) };
            // Strip leftover apply-manga-filter key from old state
            delete nextTags["__apply_manga_filter_tags__"];
            setSearchFilterTags(nextTags);
          }
        }
        if (!sawTagsFilter) {
          setSearchFilterTags({});
        }
        // Force the app to re-read filter defaults on next getSearchFilters call
        this.searchFiltersDirty = true;
        this.debouncedInvalidateSearchFilters();
      } else {
        setSearchFilterTags({});
      }

      // If user selected 'Related' sort, return related section items instead
      if (effectiveSort === "related") {
        const relatedSection = await this.getRelatedSection(metadata);
        return {
          items: this.discoverItemsToSearchResults(relatedSection.items),
          metadata: relatedSection.metadata,
        };
      }

      // If user selected 'Last Read' sort, return last read section items
      if (effectiveSort === "last_read") {
        const lastReadSection = await this.getLastReadSection(metadata);
        return {
          items: this.discoverItemsToSearchResults(lastReadSection.items),
          metadata: lastReadSection.metadata,
        };
      }

      // If user selected 'Top Reread' sort, return top reread section items
      if (effectiveSort === "top_reread") {
        const topRereadSection = await this.getTopRereadSection(metadata);
        return {
          items: this.discoverItemsToSearchResults(topRereadSection.items),
          metadata: topRereadSection.metadata,
        };
      }

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
      const tagsValueRaw: TagsFilterValue = isTagsFilterValue(tagsFilter?.value)
        ? tagsFilter.value
        : {};
      const tagsValue: TagsFilterValue = { ...tagsValueRaw };
      // Strip leftover apply-manga-filter key from old state
      delete tagsValue["__apply_manga_filter_tags__"];

      const includedTags: Tag[] = [];
      const excludedTags: Tag[] = [];

      // Process tags based on their inclusion/exclusion state
      for (const [tagId, state] of Object.entries(tagsValue)) {
        if (/\|\||\s+OR\s+/i.test(tagId)) continue;
        const normalizedTagId = tagId.replaceAll("-", " ");
        if (state === "excluded") {
          excludedTags.push({ id: normalizedTagId, title: "" });
        } else if (state === "included") {
          includedTags.push({ id: normalizedTagId, title: "" });
        }
      }

      const tagTokens = this.dedupeQueryTokens([
        ...this.buildTagTokens(includedTags, false),
        ...this.buildTagTokens(excludedTags, true),
      ]);
      const sortOrder = effectiveSort;
      const searchQuery = this.buildQueryString(trimmedTitle, [
        ...filterTokens,
        ...tagTokens,
      ]);
      const searchSessionKey = JSON.stringify({
        query: searchQuery,
        sort: sortOrder,
        orGroups: titleOrGroups,
      });
      const hideRead = getHideReadSetting();
      const readCache = hideRead ? getReadCache() : null;
      const strictFavoritesEnabled =
        getStrictFavoritesFilterSetting() &&
        hasFavoritesConstraint(favoritesConstraint);

      const pagesExact = pagesConstraint?.exact;
      const pagesMin = pagesConstraint?.min;
      const pagesMax = pagesConstraint?.max;

      if (
        this.searchBufferSessionKey !== searchSessionKey ||
        (metadata?.page ?? 1) <= 1
      ) {
        this.searchBufferSessionKey = searchSessionKey;
        this.searchBufferGalleries = [];
        this.searchBufferNextPage = metadata?.page ?? 1;
        this.searchBufferNumPages = metadata?.numPages;
        this.searchConsecutiveEmpty = 0;
      }

      currentPage = metadata?.page ?? this.searchBufferNextPage;

      let response: QueryResponse | undefined;
      let items: SearchResultItem[] = [];
      let safetyCounter = 0;
      let bufferedGalleries = [...this.searchBufferGalleries];
      let knownNumPages = this.searchBufferNumPages ?? metadata?.numPages;
      let nextPage = currentPage;

      let consecutiveEmptyFiltered = 0;
      const appendSearchCandidates = async (
        pageCandidates: Gallery[],
        source: string,
        pageLabel: number | string,
      ) => {
        if (pageCandidates.length === 0) return;
        const hydratedCandidates = await this.hydrateLiteGalleries(
          pageCandidates,
          pageCandidates.length,
        );
        items.push(
          ...hydratedCandidates.map((gallery) =>
            this.mapGalleryToSearchResult(gallery),
          ),
        );
        logDebug(
          "search:hydrate",
          `page=${pageLabel}`,
          `source=${source}`,
          `candidates=${pageCandidates.length}`,
          `hydrated=${hydratedCandidates.length}`,
          `itemsTotal=${items.length}`,
        );
      };
      logDebug(
        "search:start",
        `sort=${sortOrder}`,
        `page=${currentPage}`,
        `query=${searchQuery}`,
        `titleOrGroups=${titleOrGroups.length}`,
        `favorites=${favoritesConstraint ? `${favoritesConstraint.min ?? "-"}:${favoritesConstraint.max ?? "-"}` : "off"}`,
        `pages=${pagesExact ?? `${pagesMin ?? "-"}:${pagesMax ?? "-"}`}`,
        `date=${dateConstraint ? `${dateConstraint.newerThanDays ?? "-"}:${dateConstraint.olderThanDays ?? "-"}` : "off"}`,
        `hideRead=${hideRead}`,
      );
      if (bufferedGalleries.length > 0) {
        logDebug(
          "search:buffer",
          `page=${currentPage}`,
          `buffered=${bufferedGalleries.length}`,
        );
        const bufferedCandidates = bufferedGalleries.slice(
          0,
          SEARCH_PAGE_SIZE - items.length,
        );
        bufferedGalleries = bufferedGalleries.slice(bufferedCandidates.length);
        await appendSearchCandidates(bufferedCandidates, "buffer", currentPage);
      }
      while (
        items.length < SEARCH_PAGE_SIZE &&
        safetyCounter < MAX_SEARCH_PAGES
      ) {
        try {
          response = await this.fetchSearchWithOrExpansion(
            searchQuery,
            currentPage,
            sortOrder,
            titleOrGroups,
          );
        } catch (e) {
          // CloudflareError must bubble up for the framework challenge UI
          if (e instanceof CloudflareError) throw e;
          // Network or interceptor error during fetch — keep any items found so far
          // and continue pagination after a brief pause for transient 429/Cloudflare
          if (e instanceof Error) {
            console.error("Search fetch failed:", e.message, e);
            if (
              e.message.includes("429") ||
              e.message.includes("Cloudflare") ||
              e.message.includes("Non-JSON")
            ) {
              await this.pause(150);
              currentPage += 1;
              safetyCounter++;
              continue;
            }
          } else {
            console.error("Search fetch failed:", e);
          }
          break;
        }

        if (!response || !response.result) {
          console.log("Search returned null/undefined response");
          break;
        }

        knownNumPages = response.num_pages;
        nextPage = currentPage + 1;

        const galleries = response.result;
        const itemCountBefore = items.length;

        const favoritesSource = strictFavoritesEnabled
          ? await this.hydrateLiteGalleries(galleries, galleries.length, {
              force: true,
            })
          : galleries;

        const filteredForFavorites = hasFavoritesConstraint(favoritesConstraint)
          ? favoritesSource.filter((g) => {
              if (!strictFavoritesEnabled && g.isLite) return true;
              return matchesFavoritesConstraint(g, favoritesConstraint);
            })
          : favoritesSource;
        logDebug(
          "search:page",
          `page=${currentPage}`,
          `raw=${galleries.length}`,
          `afterFavorites=${filteredForFavorites.length}`,
        );

        logDebug(
          "search:strict",
          `page=${currentPage}`,
          `afterStrictFavorites=${filteredForFavorites.length}`,
          `strictEnabled=${strictFavoritesEnabled}`,
          `activeRange=${favoritesConstraint?.min ?? "-"}:${favoritesConstraint?.max ?? "-"}`,
        );

        const filteredForRead =
          hideRead && readCache
            ? filteredForFavorites.filter(
                (g) => !readCache.has(g.id.toString()),
              )
            : filteredForFavorites;

        const filteredForPages =
          pagesExact !== undefined ||
          pagesMin !== undefined ||
          pagesMax !== undefined
            ? filteredForRead.filter((g) => {
                if (g.isLite) return true;
                if (pagesExact !== undefined) return g.num_pages === pagesExact;
                if (pagesMin !== undefined && g.num_pages < pagesMin)
                  return false;
                if (pagesMax !== undefined && g.num_pages > pagesMax)
                  return false;
                return true;
              })
            : filteredForRead;
        logDebug(
          "search:filters",
          `page=${currentPage}`,
          `afterRead=${filteredForRead.length}`,
          `afterPages=${filteredForPages.length}`,
        );

        const filteredForDate = dateConstraint
          ? filteredForPages.filter((g) => {
              if (g.isLite) return true;
              const uploadedMs = g.upload_date * 1000;
              if (dateConstraint.newerThanDays !== undefined) {
                const cutoff =
                  Date.now() -
                  dateConstraint.newerThanDays * 24 * 60 * 60 * 1000;
                if (uploadedMs < cutoff) return false;
              }
              if (dateConstraint.olderThanDays !== undefined) {
                const olderThan =
                  Date.now() -
                  dateConstraint.olderThanDays * 24 * 60 * 60 * 1000;
                if (uploadedMs > olderThan) return false;
              }
              return true;
            })
          : filteredForPages;
        logDebug(
          "search:date",
          `page=${currentPage}`,
          `afterDate=${filteredForDate.length}`,
          `remainingSlots=${SEARCH_PAGE_SIZE - items.length}`,
        );

        const remainingSlots = SEARCH_PAGE_SIZE - items.length;
        if (remainingSlots > 0) {
          const pageCandidates = filteredForDate.slice(0, remainingSlots);
          const leftoverCandidates = filteredForDate.slice(remainingSlots);
          if (leftoverCandidates.length > 0) {
            bufferedGalleries.push(...leftoverCandidates);
          }
          await appendSearchCandidates(pageCandidates, "page", currentPage);
        }

        // Track consecutive pages where filtering removes everything
        if (items.length === itemCountBefore && galleries.length > 0) {
          consecutiveEmptyFiltered++;
        } else {
          consecutiveEmptyFiltered = 0;
        }

        const reachedEnd = currentPage >= response.num_pages;
        const rawResultsEmpty = galleries.length === 0;
        if (
          items.length >= SEARCH_PAGE_SIZE ||
          reachedEnd ||
          rawResultsEmpty ||
          consecutiveEmptyFiltered >= 15
        ) {
          break;
        }

        currentPage = nextPage;
        safetyCounter += 1;
      }

      items = items.slice(0, SEARCH_PAGE_SIZE);
      const hasNextPage =
        bufferedGalleries.length > 0 ||
        (typeof knownNumPages === "number" && nextPage <= knownNumPages);

      // Track consecutive empty pages to prevent infinite loops
      if (items.length === 0 && hasNextPage) {
        this.searchConsecutiveEmpty++;
      } else {
        this.searchConsecutiveEmpty = 0;
      }

      // Continue pagination when filters remove all items but more pages exist.
      // Strict favorites/date filters can legitimately burn through several
      // pages before finding enough hydrated matches, so use a wider cap.
      const continueOffset = hasNextPage && this.searchConsecutiveEmpty < 6;

      this.searchBufferSessionKey = searchSessionKey;
      this.searchBufferGalleries = bufferedGalleries;
      this.searchBufferNextPage = nextPage;
      this.searchBufferNumPages = knownNumPages;
      if (!continueOffset) {
        this.searchBufferGalleries = [];
      }

      logDebug(
        "search:return",
        `items=${items.length}`,
        `hasNext=${hasNextPage}`,
        `continue=${continueOffset}`,
        `nextPage=${continueOffset ? nextPage : "none"}`,
        `buffered=${bufferedGalleries.length}`,
        `elapsedMs=${Date.now() - searchStart}`,
      );

      recordDisplayedTiles(items);
      console.log(
        `[NHentai] Search done: ${items.length} items, sort=${sortingOption?.id ?? "default"}, ${Date.now() - searchStart}ms`,
      );
      return {
        items,
        metadata: continueOffset
          ? {
              page: nextPage,
              numPages: knownNumPages,
            }
          : undefined,
      };
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
      console.error("[NHentai Search] Unexpected error", e, {
        query,
        metadata,
        sorting: sortingOption,
      });
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const gallery = await this.fetchGallery(mangaId);

    // Mark as read when viewing details if setting is enabled
    if (getMarkReadOnViewSetting()) {
      const readTags = gallery.tags
        .filter((t) => t.type === "tag")
        .map((t) => t.name)
        .slice(0, 12);
      markMangaAsRead(
        gallery.id.toString(),
        gallery.title.pretty || gallery.title.english || gallery.title.japanese,
        readTags,
      );
      incrementMarkReadOnDescCount();
      addDescMarkedReadId(gallery.id.toString());
    }

    // Track statistics (non-blocking)
    try {
      ensureInstallDate();
      incrementDisplayedManga(mangaId);
      recordReadingSession();
      recordPageCount(gallery.num_pages);
      const tagNames = gallery.tags
        .filter(
          (t) => t.type === "tag" || t.type === "male" || t.type === "female",
        )
        .map((t) => t.name);
      if (tagNames.length > 0) recordTagCounts(tagNames);
    } catch {
      /* stats tracking should never break main flow */
    }

    const secondaryTitles = [
      gallery.title.english,
      gallery.title.japanese,
      gallery.title.pretty,
    ].filter((title): title is string => !!title);

    const displayOptions = getDisplayOptionsSetting();
    const dateFmt = getDateFormatSetting();
    const uploadDate = new Date(gallery.upload_date * 1000);
    const languageSlug = this.extractLanguageSlug(gallery.tags);
    const languageAbbrev = getLanguageAbbreviationFromSlug(languageSlug);
    const parts: string[] = [];
    // Include two-letter language code in description if enabled (or by default if no setting)
    if (displayOptions.includes("show_lang_desc")) {
      parts.push(languageAbbrev);
    }

    const isRead = isMangaRead(gallery.id.toString());
    const showReadLetter = displayOptions.includes("hide_read_letter"); // Note: Despite the name, this now means "show" when present
    const readPrefix = isRead && showReadLetter ? "r" : "";
    if (
      displayOptions.length === 0 ||
      displayOptions.includes("show_page_count")
    ) {
      parts.push(`${readPrefix}${gallery.num_pages}p`);
    }

    // Only show favorites if > 0
    if (gallery.num_favorites > 0) {
      let favs = gallery.num_favorites.toString();
      if (gallery.num_favorites >= 1_000_000) {
        favs = `${Math.round(gallery.num_favorites / 1_000_000)}M`;
      } else if (gallery.num_favorites >= 1000) {
        favs = `${Math.round(gallery.num_favorites / 1000)}k`;
      }
      parts.push(favs);
    }

    const uploadHours = uploadDate.getHours();
    const uploadMins = uploadDate.getMinutes();
    const uploadSuffix = uploadHours >= 12 ? "PM" : "AM";
    const uploadH12 = ((uploadHours + 11) % 12) + 1;
    const uploadMinsStr = uploadMins.toString().padStart(2, "0");
    const uploadTimeStr = `${uploadH12}:${uploadMinsStr}${uploadSuffix}`;

    let dateAbsolute = "";
    if (displayOptions.includes("desc_show_date")) {
      dateAbsolute = `${formatDateByPattern(uploadDate, dateFmt)} @ ${uploadTimeStr}`;
    }
    const dateRelative = displayOptions.includes("desc_relative_date")
      ? this.relativeTime(uploadDate)
      : "";

    // Ensure relative appears before absolute in description top line
    if (dateRelative) parts.push(dateRelative);
    if (dateAbsolute) parts.push(dateAbsolute);

    // Add gallery ID to end of first line if enabled
    if (displayOptions.includes("show_id")) {
      parts.push(gallery.id.toString());
    }

    const removeSpaces = getRemoveSeparatorSpacesSetting();
    const separator = removeSpaces ? "|" : " | ";
    const infoLine = parts.join(separator);
    const topTags = this.getTopTags(gallery);
    let tagsLine = "";
    if (topTags.length > 0) {
      tagsLine = topTags.join(", ");
    }

    const parodies = gallery.tags
      .filter((t) => t.type === "parody")
      .map((t) => t.name.replace(/_/g, " ").trim())
      .filter((name) => name.length > 0);
    const characters = gallery.tags
      .filter((t) => t.type === "character")
      .map((t) => t.name.replace(/_/g, " ").trim())
      .filter((name) => name.length > 0);

    const extraLines: string[] = [];
    if (displayOptions.includes("parodies_bottom")) {
      // Hide "Parodies: original" when "original" is the only parody
      const nonOriginalParodies = parodies.filter(
        (p) => p.toLowerCase() !== "original",
      );
      if (nonOriginalParodies.length > 0)
        extraLines.push(`Parodies: ${parodies.join(", ")}`);
      if (characters.length > 0)
        extraLines.push(`Characters: ${characters.join(", ")}`);
    }

    let synopsis = infoLine;
    // Tags should appear immediately after the info line
    if (tagsLine) {
      synopsis += `\n${tagsLine}`;
    }
    // Parodies/Characters immediately after tags (no extra blank line)
    if (extraLines.length > 0) {
      synopsis += `\n${extraLines.join("\n")}`;
    }

    const excludedTags = new Set(topTags);
    // When parodies/characters are shown in description, exclude them from scroller
    if (displayOptions.includes("parodies_bottom")) {
      for (const p of parodies) excludedTags.add(p.toLowerCase());
      for (const c of characters) excludedTags.add(c.toLowerCase());
    }
    const tagSections = this.createTagSections(gallery, excludedTags);

    return {
      mangaId: gallery.id.toString(),
      mangaInfo: {
        primaryTitle: gallery.title.pretty,
        secondaryTitles: Array.from(new Set(secondaryTitles)),
        thumbnailUrl: this.buildCoverUrl(gallery),
        synopsis,
        rating: 0,
        status: "COMPLETED",
        contentRating: ContentRating.ADULT,
        tagGroups: tagSections,
        shareUrl: `${DOMAIN}/g/${gallery.id}`,
      },
    };
  }

  // State keys for related caching/persistence and counters
  private readonly RELATED_POOL_STATE_KEY = "nhentai.relatedPool";
  private readonly RELATED_POOL_HISTORY_KEY = "nhentai.relatedPoolHistory";
  private readonly RELATED_POOL_HISTORY_INDEX_KEY =
    "nhentai.relatedPoolHistoryIndex";
  private readonly RELATED_POOL_SEEN_IDS_KEY = "nhentai.relatedPoolSeenIds";
  private readonly PRESERVED_RELATED_STATE_KEY = "nhentai.relatedPreserved";
  private readonly NONCAROUSEL_PAGE_COUNT_KEY = "nhentai.nonCarouselPageCount";

  // Lazy loading configuration
  private readonly LAZY_BATCH_SIZE = 4; // Load 4 history items at a time (reduced from 8 to avoid 429s)
  private readonly RELATED_PER_HISTORY = 5; // Max related per history item

  // Gallery cache with persistence
  private galleryCache = new Map<string, { gallery: Gallery; ts: number }>();
  private galleryCacheDirty = false;
  private galleryPending = new Map<string, Promise<Gallery>>();
  private relatedPoolCache:
    | { id: number; tag: string; cycleIndex: number }[]
    | undefined;
  private relatedPoolLastHistoryIndex = 0;
  private relatedPoolSeenIds = new Set<number>();
  private relatedPoolHistoryIds = new Set<number>(); // Track history IDs to exclude from relatedIds
  // Session-based page tracking: maps item ID → page number when first displayed
  // Used to hide items after the configured related age window.
  private relatedFirstSeenPage = new Map<number, number>();

  // Failure-based error recovery
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private searchConsecutiveEmpty = 0; // Track consecutive empty pages to prevent infinite loops
  private searchBufferSessionKey = "";
  private searchBufferGalleries: Gallery[] = [];
  private searchBufferNextPage = 1;
  private searchBufferNumPages: number | undefined;

  private restoreGalleryCache(): void {
    try {
      const saved = Application.getState(GALLERY_CACHE_STATE_KEY) as
        | { entries: [string, { gallery: Gallery; ts: number }][] }
        | undefined;
      if (!saved?.entries) return;

      const now = Date.now();
      let restoredCount = 0;
      for (const [id, entry] of saved.entries) {
        // Skip expired entries
        if (now - entry.ts > GALLERY_CACHE_TTL_MS) continue;
        this.galleryCache.set(id, entry);
        restoredCount++;
      }
      if (restoredCount > 0) {
        console.log(`[NHentai] Restored ${restoredCount} cached galleries`);
      }
    } catch {
      // Ignore restore failures
    }
  }

  private scheduleGalleryCacheSave(): void {
    // Note: setTimeout is not available in Paperback's sandbox
    // Just save immediately since we're already batching by dirty flag
    this.galleryCacheDirty = true;
    this.saveGalleryCache();
  }

  private saveGalleryCache(): void {
    if (!this.galleryCacheDirty) return;
    try {
      // Convert map to array, sorted by timestamp (newest first), limited to max size
      const entries = Array.from(this.galleryCache.entries())
        .sort((a, b) => b[1].ts - a[1].ts)
        .slice(0, GALLERY_CACHE_MAX_SIZE);
      Application.setState({ entries }, GALLERY_CACHE_STATE_KEY);
      this.galleryCacheDirty = false;
    } catch {
      // Ignore save failures
    }
  }

  private getCachedGallery(id: string): Gallery | undefined {
    const entry = this.galleryCache.get(id);
    if (!entry) return undefined;
    // Check if expired
    if (Date.now() - entry.ts > GALLERY_CACHE_TTL_MS) {
      this.galleryCache.delete(id);
      return undefined;
    }
    // Move to end (LRU refresh)
    this.galleryCache.delete(id);
    this.galleryCache.set(id, entry);
    return entry.gallery;
  }

  private setCachedGallery(id: string, gallery: Gallery): void {
    this.galleryCache.set(id, { gallery, ts: Date.now() });
    // Prune if over size limit
    if (this.galleryCache.size > 500) {
      const oldestKey = this.galleryCache.keys().next().value;
      if (oldestKey) this.galleryCache.delete(oldestKey);
    }
    this.scheduleGalleryCacheSave();
  }

  private async loadGalleryCached(id: string): Promise<Gallery> {
    const cached = this.getCachedGallery(id);
    if (cached) return cached;
    try {
      const gallery = await this.fetchGallery(id);
      this.setCachedGallery(id, gallery);
      return gallery;
    } catch {
      throw new Error(`Failed to load gallery ${id}`);
    }
  }

  private incrementNonCarouselCounter(): void {
    try {
      const current =
        (Application.getState(this.NONCAROUSEL_PAGE_COUNT_KEY) as
          | number
          | undefined) ?? 0;
      Application.setState(current + 1, this.NONCAROUSEL_PAGE_COUNT_KEY);
    } catch {
      /* ignore */
    }
  }

  private async fetchRelatedPool(
    neededCount = 20,
  ): Promise<{ id: number; tag: string; cycleIndex: number }[]> {
    try {
      // Get ordered read history (newest first)
      const history = getReadCache().ordered;

      if (history.length === 0) {
        logDebug("fetchRelatedPool: No read history");
        return [];
      }

      // Initialize pool if needed
      if (!this.relatedPoolCache) {
        this.relatedPoolCache = [];
        this.relatedPoolLastHistoryIndex = 0;
        // Keep seenIds empty initially - base manga are added first, then marked seen
        // historyIds is used separately to prevent base manga from appearing via relatedIds
        this.relatedPoolSeenIds = new Set<number>();
        this.relatedPoolHistoryIds = new Set<number>(
          history
            .map((hid) => parseInt(hid, 10))
            .filter((id) => !Number.isNaN(id)),
        );

        // Try to restore from persisted state
        try {
          const persistedPool = Application.getState(
            this.RELATED_POOL_STATE_KEY,
          ) as { id: number; tag: string; cycleIndex: number }[] | undefined;
          const persistedIndex = Application.getState(
            this.RELATED_POOL_HISTORY_INDEX_KEY,
          ) as number | undefined;
          const persistedSeenIds = Application.getState(
            this.RELATED_POOL_SEEN_IDS_KEY,
          ) as number[] | undefined;

          if (
            persistedPool &&
            persistedPool.length > 0 &&
            typeof persistedIndex === "number"
          ) {
            // Validate that history hasn't changed at processed positions
            let valid = true;
            for (let i = 0; i < Math.min(persistedIndex, history.length); i++) {
              // Check for base manga [rN] tag format
              const poolItem = persistedPool.find(
                (p) => p.cycleIndex === i + 1 && p.tag.startsWith("[r"),
              );
              if (poolItem && poolItem.id.toString() !== history[i]) {
                valid = false;
                break;
              }
            }

            if (valid) {
              this.relatedPoolCache = persistedPool;
              this.relatedPoolLastHistoryIndex = persistedIndex;
              // Restore seenIds from persisted state only (not merged with history)
              this.relatedPoolSeenIds = new Set(persistedSeenIds ?? []);
              logDebug(
                `fetchRelatedPool: Restored pool with ${persistedPool.length} items, index ${persistedIndex}`,
              );
            }
          }
        } catch {
          // Ignore state errors
        }
      }

      // Check if we need to load more
      while (
        this.relatedPoolCache.length < neededCount &&
        this.relatedPoolLastHistoryIndex < history.length
      ) {
        await this.expandRelatedPool(history);
      }

      // Persist once after all expansions (not per-batch)
      this.persistRelatedPool();

      return this.relatedPoolCache;
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
      console.error("[NHentai] fetchRelatedPool failed", e);
      return this.relatedPoolCache ?? [];
    }
  }

  private async expandRelatedPool(history: string[]): Promise<void> {
    const startIndex = this.relatedPoolLastHistoryIndex;
    const endIndex = Math.min(
      startIndex + this.LAZY_BATCH_SIZE,
      history.length,
    );

    if (startIndex >= history.length) {
      logDebug("expandRelatedPool: All history processed");
      return;
    }

    logDebug(
      `expandRelatedPool: Processing history ${startIndex}-${endIndex} of ${history.length}`,
    );
    logDebug(
      "expandRelatedPool: before",
      `pool=${this.relatedPoolCache?.length ?? 0}`,
      `seen=${this.relatedPoolSeenIds.size}`,
      `historyIds=${this.relatedPoolHistoryIds.size}`,
    );

    const batch = history.slice(startIndex, endIndex);

    // Load history galleries in parallel, tracking original batch position.
    // Language filtering is deferred to getRelatedSection() at display time
    // to avoid expensive parallel gallery fetches that trigger 429s.
    const historyGalleries = await Promise.all(
      batch.map(async (hid, batchIndex) => {
        try {
          const g = await this.loadGalleryCached(hid);
          if (!g?.id) return null;
          return { id: g.id, historyId: hid, batchIndex };
        } catch {
          return null;
        }
      }),
    );

    // Filter valid galleries
    const validGalleries = historyGalleries.filter(
      (g): g is { id: number; historyId: string; batchIndex: number } =>
        g !== null,
    );

    // Scrape related IDs with adaptive concurrency — start at 2 parallel
    // requests, fall back to sequential on any 429/Cloudflare error.
    const relatedResults: {
      historyId: string;
      historyGalleryId: number;
      relatedIds: number[];
      batchIndex: number;
    }[] = [];
    let concurrency = 2;
    let i = 0;
    while (i < validGalleries.length) {
      const chunk = validGalleries.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(async (hg) => {
          try {
            const relatedIds = await this.scrapeRelatedManga(hg.historyId);
            return {
              historyId: hg.historyId,
              historyGalleryId: hg.id,
              relatedIds,
              batchIndex: hg.batchIndex,
              hitRateLimit: false,
            };
          } catch (e) {
            if (e instanceof CloudflareError) throw e;
            const msg = getErrorMessage(e);
            const isRateLimit =
              msg.includes("429") ||
              msg.includes("Cloudflare") ||
              msg.includes("Non-JSON");
            if (isRateLimit) {
              logDebug("expandRelatedPool: 429 detected, reducing concurrency");
            }
            return {
              historyId: hg.historyId,
              historyGalleryId: hg.id,
              relatedIds: [] as number[],
              batchIndex: hg.batchIndex,
              hitRateLimit: isRateLimit,
            };
          }
        }),
      );
      const hadRateLimit = chunkResults.some((r) => r.hitRateLimit);
      if (hadRateLimit) {
        concurrency = 1; // Fall back to sequential for remaining items
        await this.pause(150);
      }
      relatedResults.push(
        ...chunkResults.map((entry) => ({
          historyId: entry.historyId,
          historyGalleryId: entry.historyGalleryId,
          relatedIds: entry.relatedIds,
          batchIndex: entry.batchIndex,
        })),
      );
      i += chunk.length;
    }

    // Process each history item and add to pool.
    // Language filtering is NOT done here — getRelatedSection() handles it
    // at display time. This avoids loading every related gallery just to
    // check its language, which caused 429 errors on NHentai.
    for (const r of relatedResults) {
      const cycleIndex = startIndex + r.batchIndex + 1;

      // Add the read manga as [rN]
      if (!this.relatedPoolSeenIds.has(r.historyGalleryId)) {
        this.relatedPoolCache!.push({
          id: r.historyGalleryId,
          tag: `[r${cycleIndex}]`,
          cycleIndex,
        });
        this.relatedPoolSeenIds.add(r.historyGalleryId);
      }

      // Add related manga (unfiltered — language filtering is deferred)
      let relatedCount = 0;
      for (const rid of r.relatedIds) {
        if (relatedCount >= this.RELATED_PER_HISTORY) break;
        if (this.relatedPoolSeenIds.has(rid)) continue;
        if (this.relatedPoolHistoryIds.has(rid)) continue; // Skip other base manga

        relatedCount++;
        this.relatedPoolCache!.push({
          id: rid,
          tag: `[${relatedCount}]`,
          cycleIndex,
        });
        this.relatedPoolSeenIds.add(rid);
      }
      logDebug(
        "expandRelatedPool: cycle",
        `cycle=${cycleIndex}`,
        `base=${r.historyGalleryId}`,
        `relatedFetched=${r.relatedIds.length}`,
        `relatedAdded=${relatedCount}`,
      );
    }

    // IMPORTANT: Always advance to endIndex, not startIndex + validGalleries.length
    // This ensures we don't re-process failed items or get stuck in a loop
    this.relatedPoolLastHistoryIndex = endIndex;
    logDebug(
      `expandRelatedPool: Pool now has ${this.relatedPoolCache!.length} items`,
    );
    logDebug(
      "expandRelatedPool: after",
      `pool=${this.relatedPoolCache!.length}`,
      `seen=${this.relatedPoolSeenIds.size}`,
      `lastHistoryIndex=${this.relatedPoolLastHistoryIndex}`,
    );
  }

  /** Persist related pool state once (called after the expansion while-loop). */
  private persistRelatedPool(): void {
    try {
      Application.setState(this.relatedPoolCache, this.RELATED_POOL_STATE_KEY);
      Application.setState(
        this.relatedPoolLastHistoryIndex,
        this.RELATED_POOL_HISTORY_INDEX_KEY,
      );
      Application.setState(
        Array.from(this.relatedPoolSeenIds),
        this.RELATED_POOL_SEEN_IDS_KEY,
      );
    } catch {
      // Ignore state errors
    }
  }

  invalidateRelatedPool(): void {
    this.relatedPoolCache = undefined;
    this.relatedPoolLastHistoryIndex = 0;
    this.relatedPoolSeenIds = new Set<number>();
    this.relatedPoolHistoryIds = new Set<number>();
    this.relatedFirstSeenPage = new Map<number, number>();

    try {
      Application.setState(undefined, this.RELATED_POOL_STATE_KEY);
      Application.setState(undefined, this.RELATED_POOL_HISTORY_INDEX_KEY);
      Application.setState(undefined, this.RELATED_POOL_SEEN_IDS_KEY);
    } catch {
      // Ignore
    }

    logDebug("Related pool invalidated");
  }

  private async scrapeRelatedManga(mangaId: string): Promise<number[]> {
    try {
      // Check cache first (24hr TTL)
      const cache =
        (Application.getState(RELATED_IDS_CACHE_KEY) as
          | Record<string, { ids: number[]; ts: number }>
          | undefined) ?? {};
      const cached = cache[mangaId];
      if (cached && Date.now() - cached.ts < RELATED_CACHE_TTL_MS) {
        logDebug("Using cached related IDs for", mangaId);
        return cached.ids;
      }

      const response = await this.fetchJson<V2RelatedResponse>({
        url: `${API_V2_URL}/galleries/${encodeURIComponent(mangaId)}/related`,
        method: "GET",
      });
      const relatedIds = (response.result ?? [])
        .map((entry) => entry.id)
        .filter(
          (id): id is number =>
            Number.isFinite(id) && id.toString() !== mangaId,
        );

      // Cache the result with timestamp (prune to 500 entries max)
      cache[mangaId] = { ids: relatedIds, ts: Date.now() };
      const entries = Object.entries(cache);
      if (entries.length > 500) {
        entries.sort((a, b) => b[1].ts - a[1].ts);
        const pruned = Object.fromEntries(entries.slice(0, 500));
        Application.setState(pruned, RELATED_IDS_CACHE_KEY);
      } else {
        Application.setState(cache, RELATED_IDS_CACHE_KEY);
      }

      logDebug("Loaded", relatedIds.length, "related IDs for", mangaId);
      return relatedIds;
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
      logDebug("Failed to load related manga for", mangaId, e);
      return [];
    }
  }

  async getRelatedSection(
    metadata: { page?: number; offset?: number } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    if (!getEnableRelatedSetting()) return { items: [], metadata: undefined };

    const offset = metadata?.offset ?? 0;
    const relatedCarouselTiles = this.RELATED_PER_HISTORY + 1;
    const limit =
      offset === 0 ? relatedCarouselTiles : STANDARD_SECTION_PAGE_SIZE;
    const minItems = MIN_CAROUSEL_TILES;

    try {
      const history = getReadCache().ordered;
      if (history.length === 0) {
        logDebug("getRelatedSection: No history");
        return { items: [], metadata: undefined };
      }

      let neededItems = offset + limit + 40;
      let pool = await this.fetchRelatedPool(neededItems);

      if (pool.length === 0) {
        logDebug("getRelatedSection: Empty pool");
        return { items: [], metadata: undefined };
      }

      // Apply hideReadInRelated filter and remove over-viewed items
      const hideReadInRelated = getHideReadInRelatedSetting();
      const readCache = hideReadInRelated ? getReadCache() : null;
      // When mark-read-on-desc is ON, exclude those manga from Related (they go to Last Read only)
      const descMarkedIds = getMarkReadOnViewSetting()
        ? getDescMarkedReadIds()
        : null;

      const filterPool = (p: typeof pool) => {
        let filteredByRead = 0;
        let filteredByDesc = 0;
        let filteredByAge = 0;
        const cycleLastIndex = new Map<number, number>();
        for (let index = 0; index < p.length; index++) {
          cycleLastIndex.set(p[index].cycleIndex, index);
        }
        const nextPool = p.filter((item) => {
          if (
            hideReadInRelated &&
            readCache &&
            readCache.has(item.id.toString())
          ) {
            filteredByRead++;
            return false;
          }
          if (descMarkedIds && descMarkedIds.has(item.id.toString())) {
            filteredByDesc++;
            return false;
          }
          const cycleEndIndex = cycleLastIndex.get(item.cycleIndex);
          if (
            cycleEndIndex !== undefined &&
            offset >= cycleEndIndex + RELATED_AGE_WINDOW_TILES
          ) {
            filteredByAge++;
            return false;
          }
          return true;
        });
        logDebug(
          "getRelatedSection: filter",
          `in=${p.length}`,
          `out=${nextPool.length}`,
          `read=${filteredByRead}`,
          `desc=${filteredByDesc}`,
          `age=${filteredByAge}`,
        );
        return nextPool;
      };
      pool = filterPool(pool);

      // Re-index [rN] tags sequentially after filtering so they start from [r1]
      let rCounter = 0;
      for (const item of pool) {
        if (item.tag.startsWith("[r")) {
          rCounter++;
          item.tag = `[r${rCounter}]`;
        }
      }

      for (
        let tries = 0;
        tries < 3 &&
        pool.length < offset + minItems &&
        this.relatedPoolLastHistoryIndex < history.length;
        tries++
      ) {
        neededItems += 80;
        pool = filterPool(await this.fetchRelatedPool(neededItems));
        // Re-index again after expansion
        rCounter = 0;
        for (const item of pool) {
          if (item.tag.startsWith("[r")) {
            rCounter++;
            item.tag = `[r${rCounter}]`;
          }
        }
      }

      logDebug(
        "getRelatedSection: Pool size",
        pool.length,
        "offset",
        offset,
        "limit",
        limit,
      );
      logDebug(
        "getRelatedSection: order",
        summarizeRelatedPoolOrder(
          pool.slice(offset, offset + Math.min(limit * 2, pool.length)),
        ),
      );

      if (
        pool.length < offset + minItems &&
        this.relatedPoolLastHistoryIndex < history.length
      ) {
        pool = filterPool(await this.fetchRelatedPool(offset + limit + 120));
        // Re-index expanded pool
        rCounter = 0;
        for (const item of pool) {
          if (item.tag.startsWith("[r")) {
            rCounter++;
            item.tag = `[r${rCounter}]`;
          }
        }

        if (pool.length <= offset) {
          return { items: [], metadata: undefined };
        }
      }

      const items: DiscoverSectionItem[] = [];
      const relatedLang = getRelatedLanguageSetting();
      const displayOptions = getDisplayOptionsSetting();
      const showRelatedOrder = displayOptions.includes("show_related_order");
      const seenIds = new Set<number>();
      let cursor = Math.min(offset, pool.length);
      let expansions = 0;
      const batchSize = Math.max(limit, relatedCarouselTiles);

      while (items.length < limit) {
        if (cursor >= pool.length) {
          if (
            this.relatedPoolLastHistoryIndex >= history.length ||
            expansions >= 3
          ) {
            break;
          }

          neededItems += 80;
          pool = filterPool(await this.fetchRelatedPool(neededItems));
          rCounter = 0;
          for (const item of pool) {
            if (item.tag.startsWith("[r")) {
              rCounter++;
              item.tag = `[r${rCounter}]`;
            }
          }
          expansions++;

          if (cursor >= pool.length) {
            continue;
          }
        }

        const nextCursor = Math.min(cursor + batchSize, pool.length);
        const currentSlice = pool.slice(cursor, nextCursor);
        logDebug(
          "getRelatedSection: slice",
          `cursor=${cursor}`,
          `sliceEnd=${nextCursor}`,
          summarizeRelatedPoolOrder(currentSlice),
        );
        cursor = nextCursor;

        const galleryPromises = currentSlice
          .filter((item) => !seenIds.has(item.id))
          .map(async (item) => {
            try {
              const gallery = await this.loadGalleryCached(item.id.toString());
              return { item, gallery };
            } catch (e) {
              logDebug("Failed to load gallery for related", item.id, e);
              return null;
            }
          });

        const results = await Promise.all(galleryPromises);

        for (const result of results) {
          if (!result) continue;
          const { item, gallery } = result;
          seenIds.add(item.id);

          const languageSlug = this.extractLanguageSlug(gallery.tags);
          if (relatedLang !== "all" && languageSlug !== relatedLang) continue;

          const title =
            gallery.title.pretty ??
            gallery.title.english ??
            gallery.title.japanese ??
            "";
          const baseSubtitle = this.createSubtitle(gallery, {
            forceShowNonPreferredLanguage: true,
            rereadCount: getRereadCount(gallery.id.toString()),
          });
          const subtitle = showRelatedOrder
            ? `${item.tag} ${baseSubtitle}`
            : baseSubtitle;

          items.push({
            type: "simpleCarouselItem",
            mangaId: normalizeBridgeString(gallery.id, item.id.toString()),
            title: normalizeBridgeString(title, `Gallery ${item.id}`),
            subtitle: normalizeBridgeString(subtitle),
            imageUrl: normalizeBridgeString(this.buildCoverUrl(gallery)),
            metadata: undefined,
          });

          incrementRelatedViewCount(item.id);
          if (items.length >= limit) {
            break;
          }
        }

        if (items.length >= minItems && offset === 0) {
          break;
        }
      }

      const hasMoreInPool = cursor < pool.length;
      const hasMoreHistory = this.relatedPoolLastHistoryIndex < history.length;
      const hasMore = hasMoreInPool || hasMoreHistory;
      logDebug(
        "getRelatedSection: Returning",
        items.length,
        "items, hasMore:",
        hasMore,
        "(pool:",
        hasMoreInPool,
        "history:",
        hasMoreHistory,
        ")",
      );
      logDebug(
        "getRelatedSection: returnedOrder",
        items
          .map((item) => {
            const mangaId = "mangaId" in item ? item.mangaId : "unknown";
            const subtitle = "subtitle" in item ? (item.subtitle ?? "") : "";
            return `${mangaId}:${subtitle}`;
          })
          .join(" | "),
      );
      recordDisplayedTiles(items);

      return {
        items,
        metadata: items.length > 0 && hasMore ? { offset: cursor } : undefined,
      };
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
      console.error("[NHentai Related] Failed", e);
      return { items: [], metadata: undefined };
    }
  }

  async getLastReadSection(
    metadata: { page?: number; offset?: number } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    try {
      const offset = metadata?.offset ?? 0;
      // For carousel (offset = 0), show fewer tiles; for expanded view, show more
      const limit =
        offset === 0 ? SPECIAL_SECTION_CAROUSEL_TILES : LAST_READ_PAGE_SIZE;

      // Get ordered read history (newest first)
      const history = getReadCache().ordered;
      if (history.length === 0) {
        return { items: [], metadata: undefined };
      }

      // Slice the history for this page
      const slice = history.slice(offset, offset + limit);
      if (slice.length === 0) {
        return { items: [], metadata: undefined };
      }

      // Fetch gallery details for each ID in parallel
      const items: DiscoverSectionItem[] = [];
      const galleryResults = await Promise.all(
        slice.map(async (id) => {
          try {
            const gallery = await this.fetchGallery(id);
            if (!gallery) return null;
            return this.mapGalleryToDiscoverItem(gallery);
          } catch (e) {
            logDebug("[NHentai Last Read] Failed to load gallery", id, e);
            return null;
          }
        }),
      );
      items.push(
        ...galleryResults.filter((r): r is DiscoverSectionItem => r !== null),
      );

      const hasMore = offset + limit < history.length;
      recordDisplayedTiles(items);
      return {
        items,
        metadata:
          items.length > 0 && hasMore ? { offset: offset + limit } : undefined,
      };
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
      console.error("[NHentai Last Read] Failed", e);
      return { items: [], metadata: undefined };
    }
  }

  async getTopRereadSection(
    metadata: { page?: number; offset?: number } | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    try {
      const offset = metadata?.offset ?? 0;
      // For carousel (offset = 0), show fewer tiles; for expanded view, show more
      const limit =
        offset === 0
          ? SPECIAL_SECTION_CAROUSEL_TILES
          : STANDARD_SECTION_PAGE_SIZE;

      const allReread = getAllRereadManga();
      if (allReread.length === 0) {
        return { items: [], metadata: undefined };
      }

      const slice = allReread.slice(offset, offset + limit);
      if (slice.length === 0) {
        return { items: [], metadata: undefined };
      }

      const items: DiscoverSectionItem[] = [];
      const galleryResults = await Promise.all(
        slice.map(async (entry) => {
          try {
            const gallery = await this.fetchGallery(entry.mangaId);
            if (!gallery) return null;
            const title =
              gallery.title?.pretty ||
              gallery.title?.english ||
              gallery.title?.japanese ||
              `Gallery ${entry.mangaId}`;
            return {
              type: "simpleCarouselItem" as const,
              mangaId: normalizeBridgeString(gallery.id, entry.mangaId),
              imageUrl: normalizeBridgeString(this.buildCoverUrl(gallery)),
              title: normalizeBridgeString(title, `Gallery ${entry.mangaId}`),
              subtitle: normalizeBridgeString(
                this.createSubtitle(gallery, {
                  rereadCount: entry.count,
                  isTopReread: true,
                }),
              ),
              contentRating: ContentRating.ADULT,
              metadata: undefined,
            };
          } catch (e) {
            logDebug(
              "[NHentai Top Reread] Failed to load gallery",
              entry.mangaId,
              e,
            );
            return null;
          }
        }),
      );
      items.push(
        ...(galleryResults.filter((r) => r !== null) as DiscoverSectionItem[]),
      );

      const hasMore = offset + limit < allReread.length;
      recordDisplayedTiles(items);
      return {
        items,
        metadata:
          items.length > 0 && hasMore ? { offset: offset + limit } : undefined,
      };
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
      console.error("[NHentai Top Reread] Failed", e);
      return { items: [], metadata: undefined };
    }
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const gallery = await this.fetchGallery(sourceManga.mangaId);
    const languageSlug = this.extractLanguageSlug(gallery.tags);

    const chapter: Chapter = {
      chapterId: gallery.id.toString(),
      sourceManga,
      title:
        gallery.title?.pretty ||
        gallery.title?.english ||
        gallery.title?.japanese ||
        "",
      volume: 1,
      chapNum: 1,
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

    // Persist read state — use parent manga id only to avoid double-counting
    const readTags = gallery.tags
      .filter((t) => t.type === "tag")
      .map((t) => t.name)
      .slice(0, 12);
    markMangaAsRead(
      chapter.sourceManga.mangaId,
      gallery.title.pretty || gallery.title.english || gallery.title.japanese,
      readTags,
    );
    // If this manga was previously only desc-marked-read, it's now actually read
    // so remove it from the exclusion list so it appears in Related section
    removeDescMarkedReadId(chapter.sourceManga.mangaId);

    const details: ChapterDetails = {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };

    return details;
  }

  getMangaShareUrl(mangaId: string): string {
    return `${DOMAIN}/g/${mangaId}`;
  }

  checkCloudflareStatus(status: number): void {
    if (status === 503 || status === 403) {
      throw new CloudflareError({ url: DOMAIN, method: "GET" });
    }
  }

  private parseRetryAfterMs(
    headers: Record<string, string>,
  ): number | undefined {
    const retryAfter = headers["retry-after"] ?? headers["Retry-After"];
    if (!retryAfter) return undefined;

    const numericSeconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(numericSeconds)) {
      return Math.max(0, numericSeconds * 1000);
    }

    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) {
      return Math.max(0, dateMs - Date.now());
    }

    return undefined;
  }

  private computeBackoffDelayMs(
    attempt: number,
    status: number,
    headers: Record<string, string>,
  ): number {
    const retryAfterMs = this.parseRetryAfterMs(headers);
    if (retryAfterMs !== undefined) {
      const cap = status === 429 ? 4_000 : 10_000;
      return Math.min(cap, Math.max(300, retryAfterMs));
    }

    const baseMs =
      status === 403 || status === 429 || status === 503 ? 600 : 300;
    const expMs = baseMs * Math.pow(2, attempt);
    const jitterMs = Math.floor(Math.random() * 250);
    const maxMs = status === 429 ? 4_000 : 10_000;
    return Math.min(maxMs, expMs + jitterMs);
  }

  private async fetchSearch(
    query: string,
    page: number,
    sort: string,
  ): Promise<QueryResponse> {
    const normalizedQuery = this.normalizeQueryString(query);
    const cacheKey = `${sort}|${page}|${normalizedQuery}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL_MS) {
      return this.cloneQueryResponse(cached.response);
    }

    const pending = this.searchPending.get(cacheKey);
    if (pending) {
      return pending.then((response) => this.cloneQueryResponse(response));
    }

    const request: Request = {
      url: `${API_V2_URL}/search?query=${encodeURIComponent(normalizedQuery)}&page=${page}&sort=${encodeURIComponent(sort)}`,
      method: "GET",
    };

    const fetchPromise = this.fetchJson<V2SearchResponse>(request).then(
      async (response) => {
        const hydrated = this.mapV2SearchResponseToQueryResponse(response);
        this.searchCache.set(cacheKey, {
          response: this.cloneQueryResponse(hydrated),
          ts: Date.now(),
        });
        return hydrated;
      },
    );

    this.searchPending.set(cacheKey, fetchPromise);
    return fetchPromise.finally(() => {
      this.searchPending.delete(cacheKey);
    });
  }

  private mapV2SearchResponseToQueryResponse(
    response: V2SearchResponse,
  ): QueryResponse {
    const list = response.result ?? [];
    return {
      result: list.map((item) => this.mapV2ListItemToGallery(item)),
      num_pages: response.num_pages,
      per_page: response.per_page,
      error: response.error,
    };
  }

  private mapV2ListItemToGallery(item: V2GalleryListItem): Gallery {
    return {
      id: item.id,
      media_id: item.media_id,
      isLite: true,
      title: {
        english: item.english_title ?? null,
        japanese: item.japanese_title ?? null,
        pretty:
          item.english_title ?? item.japanese_title ?? `Gallery ${item.id}`,
      },
      images: {
        pages: [],
        cover: {
          path: item.thumbnail,
          t: this.getImageTypeFromPath(item.thumbnail),
        },
        thumbnail: {
          path: item.thumbnail,
          t: this.getImageTypeFromPath(item.thumbnail),
        },
      },
      tags: [],
      num_pages: item.num_pages ?? 0, // Use page count from search API
      num_favorites: 0, // Only available from gallery detail API
      upload_date: 0, // Only available from gallery detail API
    };
  }

  private async hydrateLiteGalleries(
    galleries: Gallery[],
    maxToHydrate = Number.POSITIVE_INFINITY,
    options?: { force?: boolean },
  ): Promise<Gallery[]> {
    if (galleries.length === 0) {
      return galleries;
    }

    // Check if hydration is needed based on display settings
    // Hydration fetches full gallery data (num_favorites, upload_date) which has lower rate limit (45/min)
    // Skip if we don't need favorites in subtitle AND don't need upload_date for subtitle
    const displayOptions = getDisplayOptionsSetting();
    const needsFavorites = displayOptions.includes("show_favorite_count");
    const needsUploadDate =
      displayOptions.includes("subtitle_date") ||
      displayOptions.includes("subtitle_relative");

    if (!options?.force && !needsFavorites && !needsUploadDate) {
      // Skip hydration - search API provides enough data (num_pages) for basic subtitles
      return galleries;
    }

    const result = [...galleries];
    const hydrateLimit = Number.isFinite(maxToHydrate)
      ? Math.max(0, Math.floor(maxToHydrate))
      : result.length;
    const liteIndexes: number[] = [];

    for (
      let i = 0;
      i < result.length && liteIndexes.length < hydrateLimit;
      i++
    ) {
      if (result[i].isLite) {
        liteIndexes.push(i);
      }
    }

    if (liteIndexes.length === 0) {
      return result;
    }

    // Early return tracking for repeated 429 errors
    let consecutive429s = 0;
    let successfulHydrations = 0;
    const MAX_CONSECUTIVE_429S = 3; // Stop retrying after 3 consecutive 429s with no success

    const CONCURRENCY = 5;
    for (let i = 0; i < liteIndexes.length; i += CONCURRENCY) {
      const batchIndexes = liteIndexes.slice(i, i + CONCURRENCY);
      const hydratedBatch = await Promise.all(
        batchIndexes.map(async (index) => {
          const gallery = result[index];
          try {
            const hydrated = await this.fetchGallery(gallery.id.toString());
            if (hydrated) {
              consecutive429s = 0; // Reset on success
              successfulHydrations++;
            }
            return hydrated;
          } catch (e) {
            const msg = getErrorMessage(e);
            if (msg.includes("429")) {
              consecutive429s++;
            }
            return null;
          }
        }),
      );

      for (let j = 0; j < hydratedBatch.length; j++) {
        const hydrated = hydratedBatch[j];
        if (hydrated) {
          result[batchIndexes[j]] = hydrated;
        }
      }

      // Early return if we're hitting rate limits repeatedly with no success
      if (
        consecutive429s >= MAX_CONSECUTIVE_429S &&
        successfulHydrations === 0
      ) {
        console.log(
          `[NHentai] Hydration stopped early: ${consecutive429s} consecutive 429 errors with no successful fetches. ` +
            `Returning ${result.filter((g) => !g.isLite).length} hydrated + ${result.filter((g) => g.isLite).length} lite galleries.`,
        );
        break;
      }
    }

    return result;
  }

  /**
   * Fetch search results with OR expansion. When include tags contain OR groups
   * (e.g. "yuri OR anal"), fetches each alternative independently, unions within
   * each OR group, then intersects across groups. This reduces M^N requests
   * (cartesian product) to N*M requests (linear per group).
   *
   * Fetches one page per alternative — the outer loop handles pagination.
   */
  private async fetchSearchWithOrExpansion(
    baseQuery: string,
    page: number,
    sort: string,
    additionalOrGroups: string[][] = [],
  ): Promise<QueryResponse> {
    const settingsOrGroups = getIncludeOrGroups();
    const orGroups = [...settingsOrGroups, ...additionalOrGroups]
      .map((group) => this.dedupeQueryTokens(group))
      .filter((group) => group.length > 1);
    if (orGroups.length === 0) {
      return this.fetchSearch(baseQuery, page, sort);
    }

    // For a single OR group, use simple union (no intersection needed)
    if (orGroups.length === 1) {
      return this.fetchOrGroupUnion(baseQuery, orGroups[0], page, sort);
    }

    // Multiple OR groups: fetch each group independently, then intersect.
    // (A|B) AND (C|D) → G1 = union(base+A, base+B), G2 = union(base+C, base+D)
    // Result = G1 ∩ G2 (sorted by upload_date or interleaved by popularity)
    const allGalleries = new Map<number, Gallery>();
    let maxPages = page;
    let perPage = 25;
    const groupResponses = await Promise.all(
      orGroups.map((group) =>
        this.fetchOrGroupUnion(baseQuery, group, page, sort),
      ),
    );
    const groupResults = groupResponses.map((response) => {
      maxPages = Math.max(maxPages, response.num_pages);
      perPage = response.per_page;
      const ids = new Set<number>();
      for (const gallery of response.result ?? []) {
        ids.add(gallery.id);
        allGalleries.set(gallery.id, gallery);
      }
      return ids;
    });

    // Intersect across all OR groups
    if (groupResults.length === 0) {
      return { result: [], num_pages: 0, per_page: perPage };
    }
    let intersection = groupResults[0];
    for (let i = 1; i < groupResults.length; i++) {
      const next = new Set<number>();
      for (const id of intersection) {
        if (groupResults[i].has(id)) next.add(id);
      }
      intersection = next;
    }

    const merged = [...intersection]
      .map((id) => allGalleries.get(id)!)
      .filter(Boolean);

    if (sort === "date") {
      merged.sort((a, b) => b.upload_date - a.upload_date);
    }
    return { result: merged, num_pages: maxPages, per_page: perPage };
  }

  /**
   * Fetch all alternatives in a single OR group and union results.
   * Runs in batches of 2 to stay under NHentai rate limits.
   */
  private async fetchOrGroupUnion(
    baseQuery: string,
    alternatives: string[],
    page: number,
    sort: string,
  ): Promise<QueryResponse> {
    logDebug(
      `[NHentai OR] Fetching OR group union: ${alternatives.length} alternatives`,
    );
    const BATCH_SIZE = 2;
    const results: Array<QueryResponse | null> = [];
    for (let i = 0; i < alternatives.length; i += BATCH_SIZE) {
      const batch = alternatives.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (alt) => {
          const q = this.normalizeQueryString(
            [baseQuery, alt]
              .filter((s) => s.length > 0 && s !== EMPTY_QUERY)
              .join(" "),
          );
          try {
            const result = await this.fetchSearch(q, page, sort);
            logDebug(
              `[NHentai OR] alt="${alt}" query="${q}" -> ${result.result?.length ?? 0} results`,
            );
            return result;
          } catch (e) {
            logDebug(`[NHentai OR] alt="${alt}" fetch FAILED:`, e);
            return null;
          }
        }),
      );
      results.push(...batchResults);
    }

    const perAlternativeResults: Gallery[][] = [];
    let maxPages = 0;
    let perPage = 25;

    for (const response of results) {
      if (!response?.result) continue;
      maxPages = Math.max(maxPages, response.num_pages);
      perPage = response.per_page;
      perAlternativeResults.push([...response.result]);
    }

    const merged = interleaveGalleryLists(perAlternativeResults);
    logDebug(
      `[NHentai OR] Union complete: ${merged.length} unique results from ${results.filter((r) => r?.result).length}/${results.length} successful fetches`,
    );

    return { result: merged, num_pages: maxPages, per_page: perPage };
  }

  private async fetchGallery(mangaId: string): Promise<Gallery> {
    // Check persistent cache first
    const cached = this.getCachedGallery(mangaId);
    if (cached) {
      return cached;
    }

    // Check if there's already a pending request for this gallery
    const pending = this.galleryPending.get(mangaId);
    if (pending) {
      return pending;
    }

    const request: Request = {
      url: `${API_V2_URL}/galleries/${mangaId}`,
      method: "GET",
    };

    const fetchPromise = this.fetchJson<V2GalleryDetailResponse>(request)
      .then((detail) => this.mapV2GalleryDetailToGallery(detail))
      .then((gallery) => {
        this.setCachedGallery(mangaId, gallery);
        return gallery;
      })
      .finally(() => {
        this.galleryPending.delete(mangaId);
      });

    this.galleryPending.set(mangaId, fetchPromise);
    return fetchPromise;
  }

  private mapV2GalleryDetailToGallery(
    detail: V2GalleryDetailResponse,
  ): Gallery {
    const toImage = (path: string | undefined): GalleryImage => ({
      path,
      t: this.getImageTypeFromPath(path),
    });

    const pages = (detail.pages ?? []).map((page) => ({
      path: page.path,
      thumbnail: page.thumbnail,
      t: this.getImageTypeFromPath(page.path),
    }));

    const uploadDate =
      typeof detail.upload_date === "number" &&
      detail.upload_date > 2_000_000_000_000
        ? Math.floor(detail.upload_date / 1000)
        : detail.upload_date;

    return {
      id: detail.id,
      media_id: detail.media_id,
      isLite: false,
      title: {
        english: detail.title?.english ?? null,
        japanese: detail.title?.japanese ?? null,
        pretty:
          detail.title?.pretty ??
          detail.title?.english ??
          detail.title?.japanese ??
          `Gallery ${detail.id}`,
      },
      images: {
        pages,
        cover: toImage(detail.cover?.path),
        thumbnail: toImage(detail.thumbnail?.path),
      },
      tags: detail.tags ?? [],
      num_pages:
        typeof detail.num_pages === "number" ? detail.num_pages : pages.length,
      num_favorites:
        typeof detail.num_favorites === "number" ? detail.num_favorites : 0,
      upload_date: typeof uploadDate === "number" ? uploadDate : 0,
    };
  }

  private getImageTypeFromPath(path: string | undefined): string {
    if (!path) return "j";
    const slash = path.lastIndexOf("/");
    const dot = path.lastIndexOf(".");
    if (dot === -1 || dot < slash) return "j";
    const ext = path.slice(dot + 1).toLowerCase();
    switch (ext) {
      case "jpg":
      case "jpeg":
        return "j";
      case "png":
        return "p";
      case "gif":
        return "g";
      case "webp":
        return "w";
      default:
        return "j";
    }
  }

  private async fetchText(request: Request): Promise<ResponseAndText> {
    const [response, data] = await Application.scheduleRequest(request);
    return {
      response,
      text: Application.arrayBufferToUTF8String(data),
    };
  }

  private async pause(ms: number): Promise<void> {
    if (ms <= 0) return;

    // Application.sleep uses seconds and yields the runtime while waiting.
    await Application.sleep(ms / 1000);
  }

  private async fetchJson<T>(request: Request): Promise<T> {
    const endpointClass = classifyEndpoint(request.url);

    // Use withRateLimit to serialize requests and enforce spacing
    return withRateLimit(endpointClass, async () => {
      const maxAttempts = 3;
      let lastError: unknown;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const { response, text } = await this.fetchText(request);
          const trimmed = text.trim();
          const status = response.status;
          const isHtml = trimmed.startsWith("<");
          const isRateLimited =
            status === 429 || status === 403 || status === 503;
          const isRetryableServerError = status >= 500;

          if (isRateLimited || isRetryableServerError || isHtml) {
            if (attempt < maxAttempts - 1) {
              // On 429, use backoff delay
              const waitMs = this.computeBackoffDelayMs(
                attempt,
                status,
                response.headers,
              );
              console.log(
                `[NHentai] HTTP ${status} for ${request.url} (attempt ${attempt + 1}/${maxAttempts}), waiting ${waitMs}ms before retry`,
              );
              await this.pause(waitMs);
              continue;
            }

            if (status === 403 || status === 503) {
              this.checkCloudflareStatus(status);
            }

            throw new Error(
              `[NHentai] HTTP ${status} for ${request.url} after ${maxAttempts} attempts`,
            );
          }

          if (status < 200 || status >= 300) {
            throw new Error(`[NHentai] HTTP ${status} for ${request.url}`);
          }

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
        } catch (error) {
          // CloudflareError must bubble up immediately so the framework
          // can present the Cloudflare challenge to the user.
          if (error instanceof CloudflareError) throw error;
          lastError = error;
          if (attempt < maxAttempts - 1) {
            await this.pause((attempt + 1) * 250);
            continue;
          }
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error(`[NHentai] Failed to fetch JSON from ${request.url}`);
    });
  }

  private async refreshCdnConfig(): Promise<void> {
    try {
      const response = await this.fetchJson<V2CdnResponse>({
        url: `${API_V2_URL}/cdn`,
        method: "GET",
      });

      const imageServers = (response.image_servers ?? [])
        .map((server) => server?.trim())
        .filter((server): server is string => !!server);
      const thumbServers = (response.thumb_servers ?? [])
        .map((server) => server?.trim())
        .filter((server): server is string => !!server);

      if (imageServers.length > 0) {
        this.cdnImageServers = imageServers;
      }
      if (thumbServers.length > 0) {
        this.cdnThumbServers = thumbServers;
      }

      this.cdnConfigTs = Date.now();
      try {
        if (this.cdnImageServers) {
          Application.setState(
            this.cdnImageServers,
            CDN_IMAGE_SERVERS_STATE_KEY,
          );
        }
        if (this.cdnThumbServers) {
          Application.setState(
            this.cdnThumbServers,
            CDN_THUMB_SERVERS_STATE_KEY,
          );
        }
        Application.setState(this.cdnConfigTs, CDN_TS_STATE_KEY);
      } catch {
        // Ignore state persistence failures.
      }
    } catch (error) {
      logDebug("Failed to refresh CDN config", error);
    }
  }

  private async getPopularTags(): Promise<TagDefinition[]> {
    if (
      this.popularTagsCache &&
      this.popularTagsCacheTs &&
      Date.now() - this.popularTagsCacheTs < POPULAR_TAGS_CACHE_TTL_MS
    ) {
      return this.popularTagsCache;
    }

    // Try restoring from persisted state (survives app restart)
    if (!this.popularTagsCache) {
      try {
        const persisted = Application.getState(POPULAR_TAGS_STATE_KEY) as
          | TagDefinition[]
          | undefined;
        const persistedTs = Application.getState(POPULAR_TAGS_TS_STATE_KEY) as
          | number
          | undefined;
        if (
          Array.isArray(persisted) &&
          persisted.length > 0 &&
          typeof persistedTs === "number" &&
          Date.now() - persistedTs < POPULAR_TAGS_CACHE_TTL_MS
        ) {
          this.popularTagsCache = persisted;
          this.popularTagsCacheTs = persistedTs;
          return persisted;
        }
      } catch {
        /* ignore */
      }
    }

    if (!this.popularTagsFetch) {
      this.popularTagsFetch = this.fetchPopularTagsFromRemote()
        .then((tags) => {
          const sorted = tags.slice().sort((a, b) => {
            const diff =
              this.parseTagCountValue(b.count) -
              this.parseTagCountValue(a.count);
            if (diff !== 0) return diff;
            return a.label.localeCompare(b.label);
          });

          if (sorted.length > 0) {
            this.popularTagsCache = sorted;
            this.popularTagsCacheTs = Date.now();
            // Persist to state so cache survives app restart
            try {
              Application.setState(sorted, POPULAR_TAGS_STATE_KEY);
              Application.setState(
                this.popularTagsCacheTs,
                POPULAR_TAGS_TS_STATE_KEY,
              );
            } catch {
              /* ignore */
            }
          }
          return sorted;
        })
        .catch((error) => {
          console.error("Failed to fetch NHentai popular tags", error);
          return [];
        })
        .finally(() => {
          this.popularTagsFetch = undefined;
        });
    }

    return this.popularTagsFetch;
  }

  private async fetchPopularTagsFromRemote(): Promise<TagDefinition[]> {
    const fetchedTagsAndCount: TagDefinition[] = [];
    const seen = new Set<string>();
    let maxPages = 5;

    for (let page = 1; page <= maxPages && page <= 5; page++) {
      try {
        const response = await this.fetchJson<V2TagListResponse>({
          url: `${API_V2_URL}/tags/tag?sort=popular&page=${page}&per_page=100`,
          method: "GET",
        });

        if (typeof response.num_pages === "number" && response.num_pages > 0) {
          maxPages = response.num_pages;
        }

        for (const entry of response.result ?? []) {
          const slug = entry.slug?.toLowerCase();
          if (!slug || seen.has(slug)) continue;

          const countValue =
            typeof entry.count === "number" && Number.isFinite(entry.count)
              ? entry.count
              : 0;
          const countLabel = this.formatTagCount(countValue);
          fetchedTagsAndCount.push({
            id: slug,
            label: `${entry.name} - (${countLabel})`,
            count: countLabel,
          });
          seen.add(slug);
        }
      } catch (error) {
        console.error("Unable to load NHentai popular tags", error);
        return [];
      }
    }

    return fetchedTagsAndCount;
  }

  private formatTagCount(count: number): string {
    if (count >= 1_000_000) {
      const value = count / 1_000_000;
      return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10}M`;
    }
    if (count >= 1_000) {
      const value = count / 1_000;
      return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10}K`;
    }
    return count.toString();
  }

  private parseTagCountValue(count: string): number {
    const normalized = count.trim().toLowerCase().replace(/,/g, "");
    const match = normalized.match(/^(\d+(?:\.\d+)?)([km])?$/);
    if (!match) return parseFloat(normalized) || 0;
    const value = parseFloat(match[1]) || 0;
    const suffix = match[2];
    if (suffix === "m") return value * 1_000_000;
    if (suffix === "k") return value * 1_000;
    return value;
  }

  private buildQueryString(
    title?: string,
    filterTokens: string[] = [],
    options?: { skipDefaultLanguage?: boolean },
  ): string {
    const tokens: string[] = [...filterTokens];
    if (title && title.length > 0) {
      tokens.push(title);
    }
    const languageToken = getLanguageToken();
    if (!options?.skipDefaultLanguage && languageToken) {
      tokens.push(`language:${languageToken}`);
    }
    const extraArguments = getExtraArgumentsSetting().trim();
    if (extraArguments.length > 0) {
      tokens.push(extraArguments);
    }

    return this.normalizeQueryString(tokens.join(" "));
  }

  private buildFilterTokens(filters: SearchQuery["filters"] | undefined): {
    tokens: string[];
    favoritesConstraint?: { min?: number; max?: number };
    pagesConstraint?: { exact?: number; min?: number; max?: number };
    dateConstraint?: { newerThanDays?: number; olderThanDays?: number };
  } {
    const tokens: string[] = [];
    let favoritesConstraint: { min?: number; max?: number } | undefined;
    let pagesConstraint = parsePagesExpression(getPagesExpressionSetting());
    let dateConstraint:
      | { newerThanDays?: number; olderThanDays?: number }
      | undefined;

    const lengthToken = this.getDropdownValue(filters, "length");
    const favoritesToken = this.getDropdownValue(filters, "favorites");
    const dateToken = this.getDropdownValue(filters, "daysOld");

    // Pages (search dropdown overrides settings, including explicit "all")
    const lengthOptionToken = this.getOptionToken(
      lengthToken,
      LENGTH_FILTER_OPTIONS,
    );
    if (lengthToken !== undefined && lengthToken !== "all") {
      pagesConstraint = {};
      if (lengthOptionToken) {
        const match = lengthOptionToken.match(/^(>=|<=|>|<)?(\d+)$/);
        if (match) {
          const op = match[1];
          const val = Number(match[2]);
          if (!Number.isNaN(val)) {
            if (op === ">") pagesConstraint.min = val + 1;
            else if (op === ">=") pagesConstraint.min = val;
            else if (op === "<") pagesConstraint.max = val - 1;
            else if (op === "<=") pagesConstraint.max = val;
            else pagesConstraint = { exact: val, min: val, max: val };
          }
        }
      }
    }

    // Favorites (search dropdown overrides settings; if dropdown is "all" fall back to settings)
    const favoritesOptionToken = this.getOptionToken(
      favoritesToken,
      FAVORITES_FILTER_OPTIONS,
    );
    if (favoritesToken !== undefined && favoritesToken !== "all") {
      favoritesConstraint = undefined;
    }

    if (favoritesOptionToken) {
      tokens.push(`favorites:${favoritesOptionToken}`);
      const favoritesMatch = favoritesOptionToken.match(/^(>=|<=|>|<)?(\d+)$/);
      if (favoritesMatch) {
        const operator = favoritesMatch[1];
        const value = Number(favoritesMatch[2]);
        if (!Number.isNaN(value)) {
          if (operator === ">=" || operator === ">") {
            favoritesConstraint = {
              ...(favoritesConstraint ?? {}),
              min: operator === ">" ? value + 1 : value,
            };
          } else if (operator === "<=" || operator === "<") {
            favoritesConstraint = {
              ...(favoritesConstraint ?? {}),
              max: operator === "<" ? value - 1 : value,
            };
          }
        }
      }
    } else if (favoritesToken === undefined || favoritesToken === "all") {
      const favoritesThreshold = getFavoritesThresholdSetting();
      const favoritesThresholdMax = getFavoritesThresholdMaxSetting();
      if (
        favoritesThreshold !== undefined ||
        favoritesThresholdMax !== undefined
      ) {
        favoritesConstraint = {
          min: favoritesThreshold,
          max: favoritesThresholdMax,
        };
        if (favoritesThreshold !== undefined) {
          tokens.push(`favorites:>=${favoritesThreshold}`);
        }
        if (favoritesThresholdMax !== undefined) {
          tokens.push(`favorites:<=${favoritesThresholdMax}`);
        }
      }
    }

    // Date filters (search dropdown overrides settings)
    // NHentai API: uploaded:<Xd = newer than X days, uploaded:>Xd = older than X days
    const hasDateFilter = filters?.some((f) => f.id === "daysOld");
    if (dateToken && dateToken !== "all") {
      const preset = DATE_FILTER_PRESETS.find((p) => p.id === dateToken);
      if (preset?.days !== undefined) {
        dateConstraint = { newerThanDays: preset.days };
        tokens.push(`uploaded:<${preset.days}d`);
      }
    } else if (!hasDateFilter || dateToken === "all") {
      const daysRange = getDaysOldFilterSetting();
      let newest =
        typeof daysRange.newest === "number" ? daysRange.newest : undefined;
      let oldest =
        typeof daysRange.oldest === "number" ? daysRange.oldest : undefined;
      if (newest !== undefined && oldest !== undefined && newest < oldest) {
        [newest, oldest] = [oldest, newest];
      }

      if (typeof newest === "number") {
        dateConstraint = {
          ...(dateConstraint ?? {}),
          newerThanDays: newest,
        };
        // uploaded:<Xd means "newer than X days"
        tokens.push(`uploaded:<${newest}d`);
      }
      if (typeof oldest === "number") {
        dateConstraint = {
          ...(dateConstraint ?? {}),
          olderThanDays: oldest,
        };
        // uploaded:>Xd means "older than X days"
        tokens.push(`uploaded:>${oldest}d`);
      }
    }

    // Pages tokens (add after date so tokens order stays predictable)
    if (pagesConstraint.exact !== undefined) {
      tokens.push(`pages:=${pagesConstraint.exact}`);
    } else {
      if (pagesConstraint.min !== undefined)
        tokens.push(`pages:>=${pagesConstraint.min}`);
      if (pagesConstraint.max !== undefined)
        tokens.push(`pages:<=${pagesConstraint.max}`);
    }

    return { tokens, favoritesConstraint, pagesConstraint, dateConstraint };
  }

  private getDropdownValue(
    filters: SearchQuery["filters"] | undefined,
    id: string,
  ): string | undefined {
    if (!filters) return undefined;
    const filter = filters.find((entry) => entry.id === id);
    return typeof filter?.value === "string" ? filter.value : undefined;
  }

  private mapGalleryToDiscoverItem(gallery: Gallery): DiscoverSectionItem {
    const subtitle = this.createTileSubtitle(gallery).trim();
    return {
      type: "simpleCarouselItem",
      mangaId: normalizeBridgeString(gallery.id, "0"),
      imageUrl: normalizeBridgeString(this.buildCoverUrl(gallery)),
      title: normalizeBridgeString(
        gallery.title?.pretty ||
          gallery.title?.english ||
          gallery.title?.japanese,
        `Gallery ${gallery.id}`,
      ),
      subtitle: subtitle.length > 0 ? subtitle : undefined,
      contentRating: ContentRating.ADULT,
      metadata: undefined,
    };
  }

  private mapGalleryToSearchResult(gallery: Gallery): SearchResultItem {
    const subtitle = this.createTileSubtitle(gallery).trim();
    return {
      mangaId: normalizeBridgeString(gallery.id, "0"),
      imageUrl: normalizeBridgeString(this.buildCoverUrl(gallery)),
      title: normalizeBridgeString(
        gallery.title?.pretty ||
          gallery.title?.english ||
          gallery.title?.japanese,
        `Gallery ${gallery.id}`,
      ),
      subtitle: subtitle.length > 0 ? subtitle : undefined,
      contentRating: ContentRating.ADULT,
      metadata: undefined,
    };
  }

  private createTileSubtitle(gallery: Gallery): string {
    return this.createSubtitle(gallery, {
      rereadCount: getRereadCount(gallery.id.toString()),
    });
  }

  private discoverItemsToSearchResults(
    items: DiscoverSectionItem[],
  ): SearchResultItem[] {
    return items
      .filter(
        (
          item,
        ): item is Extract<
          DiscoverSectionItem,
          { type: "simpleCarouselItem" }
        > => item.type === "simpleCarouselItem",
      )
      .map(
        ({ mangaId, title, subtitle, imageUrl, metadata, contentRating }) => ({
          mangaId: normalizeBridgeString(mangaId),
          title: normalizeBridgeString(title, "Gallery"),
          subtitle:
            subtitle === undefined
              ? undefined
              : normalizeBridgeString(subtitle, ""),
          imageUrl: normalizeBridgeString(imageUrl),
          metadata,
          contentRating,
        }),
      );
  }

  private pickMediaServer(
    servers: string[] | undefined,
    mediaId: string,
    fallbackPrefix: "i" | "t",
  ): string {
    const numericId = parseInt(mediaId, 10);
    const fallback = `https://${fallbackPrefix}${((Number.isFinite(numericId) ? numericId : 0) % 4) + 1}.nhentai.net`;
    if (!servers || servers.length === 0) return fallback;
    const index = (Number.isFinite(numericId) ? numericId : 0) % servers.length;
    const server = servers[index]?.trim();
    return server && server.length > 0 ? server.replace(/\/+$/, "") : fallback;
  }

  private buildAbsoluteMediaUrl(
    relativePath: string,
    mediaId: string,
    kind: "image" | "thumb",
  ): string {
    const normalizedPath = relativePath.replace(/^\/+/, "");
    const host =
      kind === "image"
        ? this.pickMediaServer(this.cdnImageServers, mediaId, "i")
        : this.pickMediaServer(this.cdnThumbServers, mediaId, "t");
    return `${host}/${normalizedPath}`;
  }

  private buildCoverUrl(gallery: Gallery): string {
    const quality = getThumbnailQualitySetting();
    const mediaId = gallery.media_id;

    logDebug(
      "Building cover URL for gallery:",
      gallery.id,
      "media_id:",
      mediaId,
      "quality:",
      quality,
    );

    if (quality === "high") {
      // High: use full first page image from i{N}.nhentai.net
      // Example: //i2.nhentai.net/galleries/3744798/1.webp
      const firstPage = gallery.images.pages[0];
      if (firstPage?.path) {
        const url = this.buildAbsoluteMediaUrl(
          firstPage.path,
          mediaId,
          "image",
        );
        logDebug("High quality URL:", url);
        return url;
      }

      if (firstPage) {
        const extension = this.getImageExtension(firstPage);
        const host = this.pickMediaServer(this.cdnImageServers, mediaId, "i");
        const url = `${host}/galleries/${mediaId}/1.${extension}`;
        logDebug("High quality fallback URL:", url);
        return url;
      }
    }

    // Low: thumb.webp (smallest thumbnail)
    // Example: //t4.nhentai.net/galleries/3746773/thumb.webp
    if (quality === "low") {
      if (gallery.images.thumbnail.path) {
        const url = this.buildAbsoluteMediaUrl(
          gallery.images.thumbnail.path,
          mediaId,
          "thumb",
        );
        logDebug("Low quality (thumb path) URL:", url);
        return url;
      }

      const host = this.pickMediaServer(this.cdnThumbServers, mediaId, "t");
      const url = `${host}/galleries/${mediaId}/thumb.webp`;
      logDebug("Low quality (thumb) URL:", url);
      return url;
    }

    // Normal (default): cover.webp (medium quality cover)
    // Example: //t1.nhentai.net/galleries/3746773/cover.webp
    if (gallery.images.cover.path) {
      const url = this.buildAbsoluteMediaUrl(
        gallery.images.cover.path,
        mediaId,
        "thumb",
      );
      logDebug("Normal quality (cover path) URL:", url);
      return url;
    }

    const host = this.pickMediaServer(this.cdnThumbServers, mediaId, "t");
    const url = `${host}/galleries/${mediaId}/cover.webp`;
    logDebug("Normal quality (cover) URL:", url);
    return url;
  }

  private buildPageUrl(
    gallery: Gallery,
    index: number,
    image: GalleryImage,
  ): string {
    if (image.path) {
      const url = this.buildAbsoluteMediaUrl(
        image.path,
        gallery.media_id,
        "image",
      );
      logDebug("Page URL for index", index, ":", url, "from path");
      return url;
    }

    const extension = this.getImageExtension(image);
    const mediaId = gallery.media_id;
    const host = this.pickMediaServer(this.cdnImageServers, mediaId, "i");

    const url = `${host}/galleries/${mediaId}/${index}.${extension}`;
    logDebug("Page URL for index", index, ":", url, "extension:", extension);
    return url;
  }

  private getImageExtension(image: GalleryImage): string {
    if (image.path) {
      const dot = image.path.lastIndexOf(".");
      const slash = image.path.lastIndexOf("/");
      if (dot > slash && dot >= 0) {
        return image.path.slice(dot + 1).toLowerCase();
      }
    }
    if (image.t) {
      return IMAGE_TYPE_MAP[image.t] ?? "jpg";
    }
    return "jpg";
  }

  private createSubtitle(
    gallery: Gallery,
    options?: {
      forceShowNonPreferredLanguage?: boolean;
      rereadCount?: number;
      isTopReread?: boolean;
    },
  ): string {
    const isRead = isMangaRead(gallery.id.toString());
    const displayOptions = getDisplayOptionsSetting();
    const showReadLetter = displayOptions.includes("hide_read_letter"); // Note: Despite the name, this now means "show" when present
    const readPrefix = isRead && showReadLetter ? "r" : "";
    const languageSlug = this.extractLanguageSlug(gallery.tags);
    const showRereadEverywhere = displayOptions.includes("show_reread_count");
    const rereadCount = options?.rereadCount;
    const showReread =
      rereadCount !== undefined &&
      rereadCount > 1 &&
      (options?.isTopReread || showRereadEverywhere);

    // Format as "7r55p" when reread count is shown alongside pages.
    const hasPageCount = gallery.num_pages > 0;
    const pagesStr = hasPageCount
      ? showReread
        ? `${rereadCount}${readPrefix}${gallery.num_pages}p`
        : `${readPrefix}${gallery.num_pages}p`
      : "";

    let favStr = "";
    if (gallery.num_favorites > 0) {
      if (
        displayOptions.includes("abbreviate_favorites") &&
        gallery.num_favorites >= 1000
      ) {
        favStr =
          gallery.num_favorites >= 1_000_000
            ? `${Math.round(gallery.num_favorites / 1_000_000)}M`
            : `${Math.round(gallery.num_favorites / 1000)}k`;
      } else {
        favStr = gallery.num_favorites.toString();
      }
    }

    const hasUploadDate = gallery.upload_date > 0;
    const uploadDate = new Date(gallery.upload_date * 1000);
    const dateFormatSetting = getDateFormatSetting();
    const showRelative = displayOptions.includes("subtitle_relative");
    const showAbsolute = displayOptions.includes("subtitle_date");

    let relativeStr = "";
    if (showRelative && hasUploadDate) {
      relativeStr = this.relativeTime(uploadDate);
    }

    let absoluteStr = "";
    if (showAbsolute && hasUploadDate) {
      absoluteStr = formatDateByPattern(uploadDate, dateFormatSetting);
    }

    const showLangTip = displayOptions.includes("show_lang_tip");

    // In Related section, show language if it differs from preferred language
    // even when show_lang_tip is disabled
    const preferredLangs = getLanguageSetting();
    const langMismatch =
      languageSlug &&
      !preferredLangs.includes(languageSlug) &&
      !preferredLangs.includes("all");

    const subtitleParts: string[] = [];
    // Show language in subtitle if:
    // 1. User enabled show_lang_tip, OR
    // 2. We're in Related section (forceShowNonPreferredLanguage) AND language differs from preferred
    if (
      showLangTip ||
      (options?.forceShowNonPreferredLanguage && langMismatch)
    ) {
      const languageAbbrev = getLanguageAbbreviationFromSlug(languageSlug);
      if (languageAbbrev && languageAbbrev !== "UNK") {
        subtitleParts.push(languageAbbrev.toUpperCase());
      }
    }
    if (pagesStr) subtitleParts.push(pagesStr);
    if (favStr) subtitleParts.push(favStr);
    // Ensure relative date appears before absolute date in subtitle
    if (showRelative && relativeStr) subtitleParts.push(relativeStr);
    if (showAbsolute && absoluteStr) subtitleParts.push(absoluteStr);

    // Keep subtitles visible for lightweight search/discover payloads
    // which may not include page/favorite/date details.
    if (subtitleParts.length === 0 && gallery.num_pages > 0) {
      subtitleParts.push(`${readPrefix}${gallery.num_pages}p`);
    }

    if (subtitleParts.length === 0) {
      if (gallery.isLite) {
        return "";
      }
      subtitleParts.push(readPrefix ? `${readPrefix}0p` : "0p");
    }

    // Get remove spaces setting
    const removeSpaces = getRemoveSeparatorSpacesSetting();
    const separator = removeSpaces ? "|" : " | ";

    return subtitleParts.join(separator);
  }

  private extractLanguageSlug(tags: GalleryTag[]): string | undefined {
    const available = this.getNonTranslatedLanguageSlugs(tags);
    if (available.length === 0) {
      return undefined;
    }

    const preferenceOrder = this.getLanguagePreferenceOrder();
    for (const slug of preferenceOrder) {
      if (available.includes(slug)) {
        return slug;
      }
    }

    return available[0];
  }

  private getNonPreferredLanguageSlugs(tags: GalleryTag[]): string[] {
    const preferredSlug = this.extractLanguageSlug(tags);
    const available = this.getNonTranslatedLanguageSlugs(tags);
    if (!preferredSlug) {
      return available;
    }
    return available.filter((slug) => slug !== preferredSlug);
  }

  private getNonTranslatedLanguageSlugs(tags: GalleryTag[]): string[] {
    const seen = new Set<string>();
    const slugs: string[] = [];

    for (const tag of tags) {
      if (tag.type !== "language") {
        continue;
      }

      const slug = tag.name?.toLowerCase().trim();
      if (!slug || slug === "translated" || seen.has(slug)) {
        continue;
      }

      seen.add(slug);
      slugs.push(slug);
    }

    return slugs;
  }

  private getLanguagePreferenceOrder(): string[] {
    const fromSettings = getLanguageSetting()
      .map((value) => value.toLowerCase().trim())
      .filter((value) => value.length > 0 && value !== "all");
    const order = fromSettings.length > 0 ? [...fromSettings] : ["english"];

    if (!order.includes("english")) {
      order.push("english");
    }

    return order;
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
    if (!tags || tags.length === 0) return [];
    const tokens: string[] = [];
    for (const t of tags) {
      const raw = (t.id ?? t.title ?? "").toString().trim();
      if (!raw || /\|\||\s+OR\s+/i.test(raw)) continue;
      if (raw.includes(":")) {
        const parts = raw.split(":");
        const type = parts[0];
        const name = parts.slice(1).join(":").replace(/-/g, " ");
        if (!name || /\|\||\s+OR\s+/i.test(name)) continue;
        const needsQuotes = /\s|[^a-z0-9_-]/i.test(name);
        tokens.push(
          `${excluded ? "-" : ""}${type}:${needsQuotes ? `"${name}"` : name}`,
        );
      } else {
        const normalized = raw.replace(/-/g, " ");
        if (!normalized || /\|\||\s+OR\s+/i.test(normalized)) continue;
        const needsQuotes = /\s|[^a-z0-9_-]/i.test(normalized);
        tokens.push(
          `${excluded ? "-" : ""}tag:${needsQuotes ? `"${normalized}"` : normalized}`,
        );
      }
    }
    return tokens;
  }

  private splitQueryTerms(segment: string): string[] {
    const matches = segment.match(
      /-?[a-z]+:"[^"]+"|-?[a-z]+:[^\s"]+|"[^"]+"|\S+/gi,
    );
    return matches?.map((token) => token.trim()).filter(Boolean) ?? [];
  }

  private categorizeQueryToken(
    token: string,
  ): "constraint" | "content" | "language" {
    const lower = token.toLowerCase();
    if (
      lower.startsWith("pages:") ||
      lower.startsWith("favorites:") ||
      lower.startsWith("uploaded:")
    ) {
      return "constraint";
    }
    if (lower.startsWith("language:") || lower.startsWith("-language:")) {
      return "language";
    }
    return "content";
  }

  private canonicalizeQueryToken(token: string): string {
    return token
      .replace(/\s+OR\s+/gi, " OR ")
      .replace(/\s+/g, " ")
      .replace(/:\s+/g, ":")
      .replace(/"/g, "")
      .trim()
      .toLowerCase();
  }

  private dedupeQueryTokens(tokens: string[]): string[] {
    const seen = new Set<string>();
    const deduped: string[] = [];

    for (const token of tokens) {
      const trimmed = token.trim();
      if (!trimmed) continue;
      const canonical = this.canonicalizeQueryToken(trimmed);
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      deduped.push(trimmed);
    }

    return deduped;
  }

  private normalizeQueryString(query: string): string {
    const buckets: Record<"constraint" | "content" | "language", string[]> = {
      constraint: [],
      content: [],
      language: [],
    };

    for (const token of this.splitQueryTerms(query)) {
      const bucket = this.categorizeQueryToken(token);
      buckets[bucket].push(token);
    }

    const normalized = this.dedupeQueryTokens([
      ...buckets.constraint,
      ...buckets.content,
      ...buckets.language,
    ]).join(" ");

    return normalized.length > 0 ? normalized : EMPTY_QUERY;
  }

  private cloneQueryResponse(response: QueryResponse): QueryResponse {
    return {
      ...response,
      result: response.result?.slice(),
    };
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

  private getTopTags(gallery: Gallery): string[] {
    if (!getAddTagsToDescriptionSetting()) {
      return [];
    }
    const sorted = [...gallery.tags].sort((a, b) => b.count - a.count);
    const tags = sorted.filter((t) => t.type === "tag");

    // Tag distribution: scroller capped at 5 until description reaches 15
    //   ≤4:  all in description, 0 scroller
    //   5:   1 in scroller
    //   6-8: scroller = total-5 (1,2,3)
    //   9-20: scroller = min(5, floor(total*0.4))
    //   >20: scroller = total-15 (description capped at 15)
    const totalTags = tags.length;
    let scrollerCount: number;
    if (totalTags <= 4) {
      scrollerCount = 0;
    } else if (totalTags === 5) {
      scrollerCount = 1;
    } else if (totalTags <= 8) {
      scrollerCount = totalTags - 5;
    } else if (totalTags <= 20) {
      scrollerCount = Math.min(5, Math.floor(totalTags * 0.4));
    } else {
      scrollerCount = totalTags - 15;
    }
    let limit = totalTags - scrollerCount;

    // If any would-be scroller tag has a long name (>14 chars), cap scroller at 4
    // Only apply when scroller already has >= 3 tags to avoid collapsing small scrollers
    if (scrollerCount >= 3 && scrollerCount > 4) {
      const scrollerTags = tags.slice(limit);
      if (scrollerTags.some((t) => t.name.replace(/_/g, " ").length > 14)) {
        scrollerCount = 4;
        limit = totalTags - scrollerCount;
      }
    }
    // Hard cap: description never receives more than 15 tags regardless of formula
    if (limit > 15) limit = 15;

    return tags.slice(0, limit).map((t) => t.name.toLowerCase());
  }

  private createTagSections(
    gallery: Gallery,
    excludedTags?: Set<string>,
  ): TagSection[] {
    const sections: TagSection[] = [];
    const grouped = new Map<string, TagSection>();
    const tagCountsById = new Map<string, number>();
    const nonPreferredLanguageTags = this.getNonPreferredLanguageSlugs(
      gallery.tags,
    ).map((slug) => ({
      id: `language:${slug}`,
      title: getLanguageAbbreviationFromSlug(slug).toUpperCase(),
    }));

    for (const tag of gallery.tags) {
      if (tag.type === "language") {
        continue;
      }

      // Skip tags that were promoted to the description
      const normalizedTagName = tag.name
        .toLowerCase()
        .replace(/_/g, " ")
        .trim();
      if (excludedTags && excludedTags.has(normalizedTagName)) {
        continue;
      }

      const sectionId = this.resolveSectionId(tag.type);
      const sectionTitle = this.resolveSectionTitle(tag.type);
      const existing = grouped.get(sectionId);
      const tagEntry: Tag = {
        id: this.buildTagIdentifier(tag),
        title: this.formatTagTitle(tag.name),
      };
      tagCountsById.set(tagEntry.id, tag.count ?? 0);

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

    for (const section of grouped.values()) {
      section.tags.sort((a, b) => {
        const countDiff =
          (tagCountsById.get(b.id) ?? 0) - (tagCountsById.get(a.id) ?? 0);
        if (countDiff !== 0) return countDiff;
        return a.title.localeCompare(b.title);
      });
    }

    if (nonPreferredLanguageTags.length > 0) {
      const tagsSection = grouped.get("tags");
      if (tagsSection) {
        tagsSection.tags = [...nonPreferredLanguageTags, ...tagsSection.tags];
      } else {
        grouped.set("tags", {
          id: "tags",
          title: "Tags",
          tags: [...nonPreferredLanguageTags],
        });
      }
    }

    // Order sections: Tags first, then others (categories/doujinshi last), ID at end
    const tagsSection = grouped.get("tags");
    if (tagsSection && tagsSection.tags.length > 0) {
      sections.push(tagsSection);
    }

    // Add other sections except tags and categories
    for (const [key, section] of grouped) {
      if (key !== "tags" && key !== "categories" && section.tags.length > 0) {
        sections.push(section);
      }
    }

    // Categories (doujinshi, manga, etc.) always at the end of tag sections
    const categoriesSection = grouped.get("categories");
    if (categoriesSection && categoriesSection.tags.length > 0) {
      sections.push(categoriesSection);
    }

    const displayOptions = getDisplayOptionsSetting();
    if (!displayOptions.includes("desc_show_date")) {
      const uploadDate = new Date(gallery.upload_date * 1000);
      const hours = uploadDate.getHours();
      const mins = uploadDate.getMinutes().toString().padStart(2, "0");
      const period = hours >= 12 ? "PM" : "AM";
      const hour12 = ((hours + 11) % 12) + 1;
      const formattedDate = formatDateByPattern(
        uploadDate,
        getDateFormatSetting(),
      );
      sections.push({
        id: "upload_date",
        title: "Date",
        tags: [
          {
            id: `date_${gallery.id}`,
            title: `${formattedDate} @ ${hour12}:${mins}${period}`,
          },
        ],
      });
    }

    // When "Show ID in Description" is OFF, add gallery ID to the scroller
    if (!displayOptions.includes("show_id")) {
      sections.push({
        id: "gallery_id",
        title: "ID",
        tags: [{ id: `id_${gallery.id}`, title: gallery.id.toString() }],
      });
    }

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
    return name.replace(/_/g, " ");
  }

  private relativeTime(date: Date): string {
    const now = Date.now();
    const diffMs = now - date.getTime();
    const sec = Math.floor(diffMs / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    const years = day / 365;
    // Format as years if over 999 days or 1+ year
    if (day > 999 || years >= 1) return `${years.toFixed(1)}y`;
    if (day > 0) return `${day}d`;
    if (hr > 0) return `${hr}h`;
    if (min > 0) return `${min}m`;
    return `${sec}s`;
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

    return getDefaultSearchSortSetting();
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

function getReadCache(): ReadHistory {
  if (!readHistory) {
    let stored = Application.getState(READ_STATE_KEY) as string[] | undefined;

    // If no stored read history exists under the current key, try migrating from
    // previously-used keys so users don't lose their read state when keys change.
    if (!stored || stored.length === 0) {
      const legacyKeys = [
        "nhentai.viewedHistory",
        "nhentai.viewHistory",
        "nhentai.readCache",
        "nhentai.read",
        "nhentai.read_history",
      ];
      for (const key of legacyKeys) {
        const legacy = Application.getState(key) as string[] | undefined;
        if (legacy && legacy.length > 0) {
          // Migrate the legacy data to the current key (idempotent)
          Application.setState(legacy, READ_STATE_KEY);
          // Optionally mark which key we migrated from for debugging
          Application.setState(true, `${READ_STATE_KEY}.migratedFrom.${key}`);
          stored = legacy;
          break;
        }
      }
    }

    readHistory = new ReadHistory(stored ?? []);
  }
  return readHistory;
}

function persistReadCache(): void {
  // Persist the ordered history, not the set
  if (readHistory) {
    Application.setState(readHistory.toArray(), READ_STATE_KEY);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function recordDisplayedTiles(items: readonly any[]): void {
  for (const item of items) {
    try {
      const id = (item as { mangaId?: string }).mangaId;
      if (typeof id === "string") incrementDisplayedManga(id);
    } catch {
      /* non-critical stats */
    }
  }
}

function isMangaRead(mangaId: string): boolean {
  return getReadCache().has(mangaId);
}

function markMangaAsRead(
  mangaId: string,
  title?: string | null,
  tags?: string[],
): void {
  // Don't mark as read if incognito/pause mode is enabled
  if (getIncognitoModeSetting()) {
    return;
  }

  const history = getReadCache();
  const isFirstRead = history.markRead(mangaId);
  if (isFirstRead) {
    persistReadCache();
    // Invalidate related pool so it rebuilds with new history
    try {
      (globalThis as NHentaiGlobalHooks).__nhentaiInvalidateRelatedPool?.();
    } catch {
      /* ignore */
    }
  }
  recordMangaReadCount(mangaId, title, isFirstRead, tags);
}

export function exportReadHistoryDebug(): void {
  try {
    const timestamp = Date.now();
    const legacyKeys = [
      "nhentai.viewedHistory",
      "nhentai.viewHistory",
      "nhentai.readCache",
      "nhentai.read",
      "nhentai.read_history",
    ];

    const canonical =
      (Application.getState(READ_STATE_KEY) as string[] | undefined) ?? [];
    const legacyFound: Record<string, { count: number; sample: string[] }> = {};

    for (const k of legacyKeys) {
      const v = (Application.getState(k) as string[] | undefined) ?? [];
      if (Array.isArray(v) && v.length > 0) {
        legacyFound[k] = { count: v.length, sample: v.slice(0, 10) };
      }
    }

    const migratedFrom: string[] = [];
    for (const k of legacyKeys) {
      const flag = Application.getState(
        `${READ_STATE_KEY}.migratedFrom.${k}`,
      ) as boolean | undefined;
      if (flag) migratedFrom.push(k);
    }

    const snapshot = {
      timestamp: new Date(timestamp).toISOString(),
      canonical: {
        key: READ_STATE_KEY,
        count: canonical.length,
        sample: canonical.slice(0, 20),
      },
      legacy: legacyFound,
      migratedFrom: migratedFrom,
      note: "Oldest read date cannot be determined because timestamps are not stored with read-history entries.",
    };

    Application.setState(snapshot, `${READ_STATE_KEY}.export.${timestamp}`);

    console.log(
      "[NHentai ReadHistory Export] Snapshot saved at:",
      `${READ_STATE_KEY}.export.${timestamp}`,
    );
    console.log(
      "[NHentai ReadHistory Export] Summary:",
      JSON.stringify(snapshot, null, 2),
    );
  } catch (e) {
    console.error("[NHentai ReadHistory Export] Failed", e);
  }
}

export function consolidateLegacyReadHistory(performCleanup = false): void {
  try {
    const legacyKeys = [
      "nhentai.viewedHistory",
      "nhentai.viewHistory",
      "nhentai.readCache",
      "nhentai.read",
      "nhentai.read_history",
    ];

    const ctx: Record<string, string[]> = {};
    for (const k of legacyKeys) {
      const v = (Application.getState(k) as string[] | undefined) ?? [];
      if (Array.isArray(v) && v.length > 0) ctx[k] = v;
    }

    if (Object.keys(ctx).length === 0) {
      console.log(
        "[NHentai ReadHistory Consolidate] No legacy read-history data found.",
      );
      return;
    }

    const canonical =
      (Application.getState(READ_STATE_KEY) as string[] | undefined) ?? [];
    const merged: string[] = [];
    const seen = new Set<string>();

    // Keep canonical items first (preserve order)
    for (const id of canonical) {
      if (!seen.has(id)) {
        merged.push(id);
        seen.add(id);
      }
    }

    // Append legacy items (preserve their order) if not seen
    for (const k of Object.keys(ctx)) {
      for (const id of ctx[k]) {
        if (!seen.has(id)) {
          merged.push(id);
          seen.add(id);
        }
      }
    }

    const timestamp = Date.now();
    Application.setState(merged, READ_STATE_KEY);
    Application.setState(
      { backedUp: ctx, timestamp: new Date(timestamp).toISOString() },
      `${READ_STATE_KEY}.legacyBackup.${timestamp}`,
    );

    console.log(
      `[NHentai ReadHistory Consolidate] Merged ${merged.length} entries and backed up legacy keys to ${READ_STATE_KEY}.legacyBackup.${timestamp}`,
    );

    if (performCleanup) {
      for (const k of Object.keys(ctx)) {
        Application.setState(undefined, k);
      }
      console.log("[NHentai ReadHistory Consolidate] Legacy keys cleared.");
    }
  } catch (e) {
    console.error("[NHentai ReadHistory Consolidate] Failed", e);
  }
}

export const NHentai = new NHentaiExtension();
