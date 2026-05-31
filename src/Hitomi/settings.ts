import { SearchFilter } from "@paperback/types/lib/compat/0.8/searchFilters";

export type LanguageId =
  | "all"
  | "english"
  | "japanese"
  | "korean"
  | "chinese"
  | "spanish"
  | "thai"
  | "vietnamese";

export type DisplayOptionId =
  | "hide_read"
  | "hide_read_letter"
  | "show_lang_tip"
  | "show_page_count"
  | "subtitle_date"
  | "subtitle_relative"
  | "desc_show_date"
  | "desc_relative_date"
  | "parodies_bottom"
  | "show_tags_in_desc"
  | "show_related_order"
  | "abbreviate_tag_counts"
  | "show_tag_counts"
  | "show_manga_id_in_description"
  | "show_reread_count";

const LANGUAGE_STATE_KEY = "hitomi.settings.language";
const HIDE_READ_STATE_KEY = "hitomi.settings.hideRead";
const EXTRA_ARGS_STATE_KEY = "hitomi.settings.extraArgs";
const INCLUDE_TAGS_STATE_KEY = "hitomi.settings.includeTags";
const EXCLUDE_TAGS_STATE_KEY = "hitomi.settings.excludeTags";
const PAGES_EXPR_STATE_KEY = "hitomi.settings.pagesExpr";
const THUMBNAIL_QUALITY_KEY = "hitomi.settings.thumbQuality";
const PROMOTE_TAGS_STATE_KEY = "hitomi.settings.promoteTags";
const ADD_TAGS_STATE_KEY = "hitomi.settings.addTagsToDescription";
const DATE_FORMAT_STATE_KEY = "hitomi.dateFormat";
const DATE_SEPARATOR_STATE_KEY = "hitomi.dateSeparator";
const VIEWED_HISTORY_STATE_KEY = "hitomi.viewedHistory";
const DISPLAY_OPTIONS_STATE_KEY = "hitomi.displayOptions";
const ENABLE_RELATED_STATE_KEY = "hitomi.enableRelated";
const INCOGNITO_STATE_KEY = "hitomi.incognitoMode";
const REMOVE_SEPARATOR_SPACES_STATE_KEY = "hitomi.removeSeparatorSpaces";
const MARK_READ_ON_VIEW_STATE_KEY = "hitomi.settings.markReadOnView";
const DESC_MARKED_READ_IDS_KEY = "hitomi.descMarkedReadIds";
const MAX_PAGINATION_STATE_KEY = "hitomi.settings.maxPagination";
const DEV_REQUESTS_PER_SECOND_KEY = "hitomi.dev.requestsPerSecond";
const DEV_BUFFER_INTERVAL_KEY = "hitomi.dev.bufferInterval";
const DEV_TIMEOUT_KEY = "hitomi.dev.timeout";
const DEV_GG_TTL_KEY = "hitomi.dev.ggTtl";
const DATE_DAYS_STATE_KEY = "hitomi.daysOldFilter";
const HIDE_READ_IN_RELATED_STATE_KEY = "hitomi.settings.hideReadInRelated";
const PREFERRED_IMAGE_FORMAT_STATE_KEY = "hitomi.settings.preferredImageFormat";
const FUZZY_SEARCH_TAGS_KEY = "hitomi.fuzzySearchTags";
const ONLY_FUZZY_UNKNOWN_TAGS_KEY = "hitomi.onlyFuzzyUnknownTags";
const ENABLE_REREAD_SECTION_KEY = "hitomi.settings.enableRereadSection";
const DISCOVER_SECTION_ORDER_KEY = "hitomi.settings.discoverSectionOrder.v2";
const DISCOVER_SECTION_HIDDEN_KEY = "hitomi.settings.discoverSectionHidden.v2";
const DISCOVER_SECTION_ORDER_RESET_FLAG_KEY =
  "hitomi.settings.discoverSectionOrder.reset.v2";
const LEGACY_DISCOVER_SECTION_ORDER_KEYS = [
  "hitomi.settings.discoverSectionOrder",
  "hitomi.settings.discoverSectionOrder.v1",
];
const LEGACY_DISCOVER_SECTION_HIDDEN_KEYS = [
  "hitomi.settings.discoverSectionHidden",
  "hitomi.settings.discoverSectionHidden.v1",
];
const DISCOVER_CAROUSEL_TILES_KEY = "hitomi.settings.discoverCarouselTiles";
const DISCOVER_PAGE_TILES_KEY = "hitomi.settings.discoverPageTiles";
const SEARCH_PAGE_TILES_KEY = "hitomi.settings.searchPageTiles";

// Statistics keys
const STATS_INSTALL_DATE_KEY = "hitomi.stats.installDate";
const STATS_DISPLAYED_MANGA_KEY = "hitomi.stats.displayedManga";
const STATS_DISPLAYED_DISTINCT_KEY = "hitomi.stats.displayedDistinct";
const STATS_DISPLAYED_TOTAL_DISTINCT_KEY = "hitomi.stats.displayedTotalDistinct";
const STATS_DISPLAYED_IDS_KEY = "hitomi.stats.displayedIds";
const STATS_SESSIONS_KEY = "hitomi.stats.sessions";
const STATS_PAGE_COUNTS_KEY = "hitomi.stats.pageCounts";
const STATS_TAG_COUNTS_KEY = "hitomi.stats.tagCounts";
const STATS_TOTAL_READ_KEY = "hitomi.stats.totalRead";
const STATS_DATA_RECEIVED_KEY = "hitomi.stats.dataReceived";
const STATS_DATA_RECEIVED_DAILY_KEY = "hitomi.stats.dataReceivedDaily";
const STATS_READ_COUNT_MAP_KEY = "hitomi.stats.readCounts";
const STATS_SCREEN_TIME_KEY = "hitomi.stats.screenTime";
const STATS_SCREEN_TIME_ENABLED_KEY = "hitomi.stats.screenTimeEnabled";
const STATS_TRACKING_ENABLED_KEY = "hitomi.stats.trackingEnabled";
const STATS_STREAK_GRACE_KEY = "hitomi.stats.streakGrace";
const STATS_MARK_READ_ON_DESC_COUNT_KEY = "hitomi.stats.markReadOnDescCount";
const STATS_REREAD_TIMESTAMPS_KEY = "hitomi.stats.rereadTimestamps";
const STATS_SCREEN_TIME_SESSION_TIMESTAMPS_KEY =
  "hitomi.stats.screenTimeSessionTimestamps";
const SCREEN_TIME_SESSION_COOLDOWN_MS = 60 * 1000; // 1 minute

type ReadCountEntry = { count: number; title?: string; tags?: string[] };
type ReadCountMap = Record<string, ReadCountEntry>;
type ScreenTimeMap = Record<string, number>; // YYYY-MM-DD -> minutes
type DataReceivedMap = Record<string, number>; // YYYY-MM-DD -> bytes

// Search filter persistence keys
const SEARCH_FILTER_LENGTH_KEY = "hitomi.searchFilter.length";
const SEARCH_FILTER_DATE_KEY = "hitomi.searchFilter.date";
const SEARCH_FILTER_TAGS_KEY = "hitomi.searchFilter.tags";
const SEARCH_FILTER_MANGA_SYNCED_TAGS_KEY =
  "hitomi.searchFilter.mangaSyncedTags";

export const DEFAULT_MARK_READ_ON_VIEW = false;
export const DEFAULT_MAX_PAGINATION = false;

export const LANGUAGE_OPTIONS: {
  id: LanguageId;
  label: string;
  token?: string;
}[] = [
  { id: "all", label: "All Languages" },
  { id: "english", label: "English", token: "english" },
  { id: "japanese", label: "Japanese", token: "japanese" },
  { id: "korean", label: "Korean", token: "korean" },
  { id: "chinese", label: "Chinese", token: "chinese" },
  { id: "spanish", label: "Spanish", token: "spanish" },
  { id: "thai", label: "Thai", token: "thai" },
  { id: "vietnamese", label: "Vietnamese", token: "vietnamese" },
];

// Helper to get current date example with separator
function getCurrentDateExampleFull(format: string, char: string): string {
  const now = new Date();
  const d = now.getDate();
  const m = now.getMonth() + 1;
  const yy = now.getFullYear().toString().slice(-2);
  const yyyy = now.getFullYear().toString();
  const dd = d.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");

  const examples: Record<string, string> = {
    mm_dd_yy: `${mm}${char}${dd}${char}${yy}`,
    dd_mm_yyyy: `${dd}${char}${mm}${char}${yyyy}`,
    yyyy_mm_dd: `${yyyy}${char}${mm}${char}${dd}`,
    m_d_yy: `${m}${char}${d}${char}${yy}`,
    mm_yy: `${mm}${char}${yy}`,
    yy_mm: `${yy}${char}${mm}`,
    m_yy: `${m}${char}${yy}`,
    yy_m: `${yy}${char}${m}`,
  };
  return examples[format] || "";
}

// Get date format options with dynamic current date (using selected separator)
export function getDateFormatOptionsWithSeparator(
  separatorId?: DateSeparatorId,
): { id: string; label: string }[] {
  const sep =
    DATE_SEPARATOR_OPTIONS.find(
      (s) => s.id === (separatorId ?? getDateSeparatorSetting()),
    )?.char ?? ".";
  return [
    {
      id: "mm_dd_yy",
      label: `${getCurrentDateExampleFull("mm_dd_yy", sep)} - MM${sep}DD${sep}YY`,
    },
    {
      id: "dd_mm_yyyy",
      label: `${getCurrentDateExampleFull("dd_mm_yyyy", sep)} - DD${sep}MM${sep}YYYY`,
    },
    {
      id: "yyyy_mm_dd",
      label: `${getCurrentDateExampleFull("yyyy_mm_dd", sep)} - YYYY${sep}MM${sep}DD`,
    },
    {
      id: "m_d_yy",
      label: `${getCurrentDateExampleFull("m_d_yy", sep)} - M${sep}D${sep}YY`,
    },
    {
      id: "mm_yy",
      label: `${getCurrentDateExampleFull("mm_yy", sep)} - MM${sep}YY`,
    },
    {
      id: "yy_mm",
      label: `${getCurrentDateExampleFull("yy_mm", sep)} - YY${sep}MM`,
    },
    {
      id: "m_yy",
      label: `${getCurrentDateExampleFull("m_yy", sep)} - M${sep}YY`,
    },
    {
      id: "yy_m",
      label: `${getCurrentDateExampleFull("yy_m", sep)} - YY${sep}M`,
    },
  ];
}

export const DATE_FORMAT_OPTIONS = [
  { id: "mm_dd_yy", label: "01.20.26 - MM.DD.YY" },
  { id: "dd_mm_yyyy", label: "20.01.2026 - DD.MM.YYYY" },
  { id: "yyyy_mm_dd", label: "2026.01.20 - YYYY.MM.DD" },
  { id: "m_d_yy", label: "1.20.26 - M.D.YY" },
  { id: "mm_yy", label: "01.26 - MM.YY" },
  { id: "yy_mm", label: "26.01 - YY.MM" },
  { id: "m_yy", label: "1.26 - M.YY" },
  { id: "yy_m", label: "26.1 - YY.M" },
];

export type DateSeparatorId = "period" | "dash" | "slash" | "comma" | "space";

// Helper to get current date example
function getCurrentDateExample(char: string): string {
  const now = new Date();
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  const yy = now.getFullYear().toString().slice(-2);
  return `${mm}${char}${dd}${char}${yy}`;
}

export const DATE_SEPARATOR_OPTIONS: {
  id: DateSeparatorId;
  label: string;
  char: string;
}[] = [
  { id: "period", label: `${getCurrentDateExample(".")} - Period`, char: "." },
  { id: "dash", label: `${getCurrentDateExample("-")} - Dash`, char: "-" },
  { id: "slash", label: `${getCurrentDateExample("/")} - Slash`, char: "/" },
  { id: "comma", label: `${getCurrentDateExample(",")} - Comma`, char: "," },
  { id: "space", label: `${getCurrentDateExample(" ")} - Space`, char: " " },
];

export type ThumbnailQuality = "low" | "high";

export const THUMBNAIL_QUALITY_OPTIONS: {
  id: ThumbnailQuality;
  label: string;
}[] = [
  { id: "low", label: "Low" },
  { id: "high", label: "High" },
];

export type PreferredImageFormat = "webp" | "avif";

export const PREFERRED_IMAGE_FORMAT_OPTIONS: {
  id: PreferredImageFormat;
  label: string;
}[] = [
  { id: "webp", label: "WebP (Lower Crash Risk)" },
  { id: "avif", label: "AVIF (Higher Quality)" },
];

export const DISPLAY_OPTION_VALUES: { id: DisplayOptionId; label: string }[] = [
  { id: "hide_read_letter", label: "Hide 'r' Read Indicator" },
  { id: "show_lang_tip", label: "Show Language in Subtitle" },
  { id: "show_page_count", label: "Show Page Count" },
  { id: "subtitle_date", label: "Show Date in Subtitle" },
  { id: "subtitle_relative", label: "Show Relative Date in Subtitle" },
  { id: "desc_show_date", label: "Show Date in Description" },
  { id: "desc_relative_date", label: "Show Relative Date in Description" },
  { id: "parodies_bottom", label: "List Parodies/Characters in Description" },
  { id: "show_tags_in_desc", label: "Show Tags in Description" },
  { id: "show_related_order", label: "Show Related Order ([1], [2], etc.)" },
  { id: "show_tag_counts", label: "Show Tag Counts" },
  {
    id: "abbreviate_tag_counts",
    label: 'Show Tag Count Abbreviations ("11k")',
  },
  { id: "show_manga_id_in_description", label: "Show manga ID in description" },
  { id: "show_reread_count", label: "Show Reread Count Everywhere" },
];

export type HitomiSearchSortId =
  | "date_added"
  | "date_published"
  | "popular_today"
  | "popular_week"
  | "popular_month"
  | "popular_year"
  | "random"
  | "last_read"
  | "related"
  | "top_reread";

export const HITOMI_SEARCH_SORT_OPTIONS: {
  id: HitomiSearchSortId;
  label: string;
}[] = [
  { id: "date_added", label: "Date Added" },
  { id: "date_published", label: "Date Published" },
  { id: "popular_today", label: "Popular Today" },
  { id: "popular_week", label: "Popular Week" },
  { id: "popular_month", label: "Popular Month" },
  { id: "popular_year", label: "Popular Year" },
  { id: "random", label: "Random" },
  { id: "last_read", label: "Last Read" },
  { id: "related", label: "Related" },
  { id: "top_reread", label: "Top Reread" },
];

export const DATE_FILTER_PRESETS: {
  id: string;
  label: string;
  days?: number;
}[] = [
  { id: "all", label: "All Time" },
  { id: "30", label: "< 30 days", days: 30 },
  { id: "90", label: "< 90 days", days: 90 },
  { id: "180", label: "< 180 days", days: 180 },
  { id: "365", label: "< 1 year", days: 365 },
  { id: "730", label: "< 2 years", days: 730 },
  { id: "1460", label: "< 4 years", days: 1460 },
];

export const DATE_FILTER_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "week", label: "Past Week" },
  { id: "month", label: "Past Month" },
  { id: "year", label: "Past Year" },
];

const DEFAULT_LANGUAGE: LanguageId[] = ["english"];
const DEFAULT_HIDE_READ = true;
const DEFAULT_EXTRA_ARGS = "";
const DEFAULT_INCLUDE_TAGS = "";
const DEFAULT_EXCLUDE_TAGS = "";
const DEFAULT_PAGES_EXPR = "";
const DEFAULT_PREFERRED_IMAGE_FORMAT: PreferredImageFormat = "webp";
const _DEFAULT_THUMB_QUALITY = "high" as const;
const DEFAULT_DATE_FORMAT = "mm_dd_yy" as const;
const DEFAULT_DATE_SEPARATOR = "period" as DateSeparatorId;
const DEFAULT_VIEWED_HISTORY: string[] = [];
const DEFAULT_DISPLAY_OPTIONS: DisplayOptionId[] = [
  "hide_read_letter", // Show read indicator 'r' - ON by default
  "show_page_count", // Show page count in subtitle - ON by default
  "desc_show_date", // Show full date in description - ON by default
  "desc_relative_date", // Show relative date in description - ON by default
  "parodies_bottom", // List parodies/characters in description - ON by default
  "show_tags_in_desc",
  "show_related_order", // Show [r1], [1], etc. in related manga subtitle - ON by default
  "show_tag_counts",
  "abbreviate_tag_counts",
  "show_manga_id_in_description",
];
const DEFAULT_ENABLE_RELATED = true;
const DEFAULT_REMOVE_SEPARATOR_SPACES = false;
export const DEFAULT_DATE_MIN_DAYS: number | undefined = undefined;
export const DEFAULT_DATE_MAX_DAYS: number | undefined = undefined;
const DEFAULT_INCOGNITO = false;
const DEFAULT_HIDE_READ_IN_RELATED = false;
export const DEFAULT_DISCOVER_CAROUSEL_TILES = 6;
export const DEFAULT_DISCOVER_PAGE_TILES = 12;
export const DEFAULT_SEARCH_PAGE_TILES = 12;
export const TAG_CACHE_REFRESH_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export type DateFormatId = (typeof DATE_FORMAT_OPTIONS)[number]["id"];

export function getLanguageSetting(): LanguageId[] {
  const value = Application.getState(LANGUAGE_STATE_KEY);
  if (Array.isArray(value) && value.length > 0) return value as LanguageId[];
  if (typeof value === "string") return [value as LanguageId];
  return DEFAULT_LANGUAGE;
}

export function setLanguageSetting(value: LanguageId[]) {
  Application.setState(value, LANGUAGE_STATE_KEY);
}

export function getLanguageToken(id: LanguageId): string | undefined {
  return LANGUAGE_OPTIONS.find((option) => option.id === id)?.token;
}

export function getHideReadSetting(): boolean {
  const stored = Application.getState(HIDE_READ_STATE_KEY) as
    | boolean
    | undefined;
  return typeof stored === "boolean" ? stored : DEFAULT_HIDE_READ;
}

export function setHideReadSetting(value: boolean) {
  Application.setState(value, HIDE_READ_STATE_KEY);
}

export function getMarkReadOnViewSetting(): boolean {
  return (
    (Application.getState(MARK_READ_ON_VIEW_STATE_KEY) as boolean) ??
    DEFAULT_MARK_READ_ON_VIEW
  );
}

export function setMarkReadOnViewSetting(value: boolean): void {
  Application.setState(value, MARK_READ_ON_VIEW_STATE_KEY);
}

let descMarkedReadIds: Set<string> | undefined;

export function getDescMarkedReadIds(): Set<string> {
  if (!descMarkedReadIds) {
    const stored = Application.getState(DESC_MARKED_READ_IDS_KEY) as
      | string[]
      | undefined;
    descMarkedReadIds = new Set(stored ?? []);
  }
  return descMarkedReadIds;
}

export function addDescMarkedReadId(mangaId: string): void {
  const ids = getDescMarkedReadIds();
  if (ids.has(mangaId)) return;
  ids.add(mangaId);
  Application.setState([...ids], DESC_MARKED_READ_IDS_KEY);
}

export function removeDescMarkedReadId(mangaId: string): void {
  const ids = getDescMarkedReadIds();
  if (!ids.has(mangaId)) return;
  ids.delete(mangaId);
  Application.setState([...ids], DESC_MARKED_READ_IDS_KEY);
}

export function getMaxPaginationSetting(): boolean {
  return (
    (Application.getState(MAX_PAGINATION_STATE_KEY) as boolean) ??
    DEFAULT_MAX_PAGINATION
  );
}

export function setMaxPaginationSetting(value: boolean): void {
  Application.setState(value, MAX_PAGINATION_STATE_KEY);
}

function clampStepperValue(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const normalized: unknown =
    Array.isArray(value) && value.length > 0 ? (value as unknown[])[0] : value;
  let parsed = NaN;
  if (typeof normalized === "number") {
    parsed = normalized;
  } else if (typeof normalized === "string") {
    parsed = Number.parseInt(normalized, 10);
  } else if (typeof normalized === "boolean") {
    parsed = normalized ? 1 : 0;
  }
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export function getDiscoverCarouselTilesSetting(): number {
  return clampStepperValue(
    Application.getState(DISCOVER_CAROUSEL_TILES_KEY),
    1,
    16,
    DEFAULT_DISCOVER_CAROUSEL_TILES,
  );
}

export function setDiscoverCarouselTilesSetting(value: number): void {
  Application.setState(
    clampStepperValue(value, 1, 16, DEFAULT_DISCOVER_CAROUSEL_TILES),
    DISCOVER_CAROUSEL_TILES_KEY,
  );
}

export function getDiscoverPageTilesSetting(): number {
  return clampStepperValue(
    Application.getState(DISCOVER_PAGE_TILES_KEY),
    1,
    48,
    DEFAULT_DISCOVER_PAGE_TILES,
  );
}

export function setDiscoverPageTilesSetting(value: number): void {
  Application.setState(
    clampStepperValue(value, 1, 48, DEFAULT_DISCOVER_PAGE_TILES),
    DISCOVER_PAGE_TILES_KEY,
  );
}

export function getSearchPageTilesSetting(): number {
  return clampStepperValue(
    Application.getState(SEARCH_PAGE_TILES_KEY),
    1,
    48,
    DEFAULT_SEARCH_PAGE_TILES,
  );
}

export function setSearchPageTilesSetting(value: number): void {
  Application.setState(
    clampStepperValue(value, 1, 48, DEFAULT_SEARCH_PAGE_TILES),
    SEARCH_PAGE_TILES_KEY,
  );
}

// Search filter persistence getters/setters
export function getSearchFilterLength(): string {
  return (Application.getState(SEARCH_FILTER_LENGTH_KEY) as string) ?? "all";
}

export function setSearchFilterLength(value: string): void {
  Application.setState(value, SEARCH_FILTER_LENGTH_KEY);
}

export function getSearchFilterDate(): string {
  return (Application.getState(SEARCH_FILTER_DATE_KEY) as string) ?? "all";
}

export function setSearchFilterDate(value: string): void {
  Application.setState(value, SEARCH_FILTER_DATE_KEY);
}

export function getSearchFilterTags(): Record<string, "included" | "excluded"> {
  const include = sanitizeTagList(getIncludeTagsSetting(), {
    exclude: false,
  }).tokens;
  const exclude = sanitizeTagList(getExcludeTagsSetting(), {
    exclude: true,
  }).tokens;
  const tags: Record<string, "included" | "excluded"> = {};

  for (const token of include) {
    const tagId = convertMangaFilterTokenToSearchFilterId(token);
    if (!tagId) continue;
    tags[tagId] = "included";
  }

  for (const token of exclude) {
    const tagId = convertMangaFilterTokenToSearchFilterId(token);
    if (!tagId) continue;
    tags[tagId] = "excluded";
  }

  return tags;
}

export function setSearchFilterTags(
  value: Record<string, "included" | "excluded">,
): void {
  void value;
  // No-op: Search filter tags default to Manga Filters.
  // Paperback's query.metadata handles temporary Search Filter UI overrides.
}

export function getExtraArgsSetting(): string {
  const includeRaw = getIncludeTagsSetting();
  const excludeRaw = getExcludeTagsSetting();

  if (hasSplitTagSettingsState()) {
    return buildTagArguments(includeRaw, excludeRaw);
  }

  return (
    (Application.getState(EXTRA_ARGS_STATE_KEY) as string) ?? DEFAULT_EXTRA_ARGS
  );
}

export function setExtraArgsSetting(value: string) {
  // Replace smart quotes with regular quotes for consistency
  let sanitized = value
    .replace(/['\u2018\u2019]/g, "'")
    .replace(/["\u201C\u201D]/g, '"');

  // Auto-quote multi-word tags that aren't already quoted
  // This helps users who type "-big breasts" instead of "-\"big breasts\""
  sanitized = sanitized.replace(
    /(-?)([a-z]+:)?([^",-][a-z0-9]+ [a-z0-9 ]+)(?=,|$)/gi,
    (match: string, neg: string, prefix: string, tagName: string) => {
      const trimmed = tagName.trim();
      // If it contains spaces and isn't already quoted, quote it
      if (trimmed.includes(" ") && !trimmed.startsWith('"')) {
        return `${neg || ""}${prefix || ""}"${trimmed}"`;
      }
      return match;
    },
  );

  Application.setState(sanitized, EXTRA_ARGS_STATE_KEY);

  // Sync split inputs for migration from legacy single field
  const { include, exclude } = splitLegacyExtraArgs(sanitized);
  Application.setState(include, INCLUDE_TAGS_STATE_KEY);
  Application.setState(exclude, EXCLUDE_TAGS_STATE_KEY);
  syncMangaFilterTagsToSearchFilterTags();
}

export function getIncludeTagsSetting(): string {
  const stored = Application.getState(INCLUDE_TAGS_STATE_KEY) as
    | string
    | undefined;
  if (typeof stored === "string") return stored;

  const legacy = Application.getState(EXTRA_ARGS_STATE_KEY) as
    | string
    | undefined;
  if (legacy) {
    const { include } = splitLegacyExtraArgs(legacy);
    Application.setState(include, INCLUDE_TAGS_STATE_KEY);
    return include;
  }

  return DEFAULT_INCLUDE_TAGS;
}

export function setIncludeTagsSetting(value: string) {
  const sanitized = sanitizeTagList(value, { exclude: false }).raw;
  Application.setState(sanitized, INCLUDE_TAGS_STATE_KEY);
  Application.setState(
    buildTagArguments(sanitized, getExcludeTagsSetting()),
    EXTRA_ARGS_STATE_KEY,
  );
  syncMangaFilterTagsToSearchFilterTags();
}

export function getExcludeTagsSetting(): string {
  const stored = Application.getState(EXCLUDE_TAGS_STATE_KEY) as
    | string
    | undefined;
  if (typeof stored === "string") return stored;

  const legacy = Application.getState(EXTRA_ARGS_STATE_KEY) as
    | string
    | undefined;
  if (legacy) {
    const { exclude } = splitLegacyExtraArgs(legacy);
    Application.setState(exclude, EXCLUDE_TAGS_STATE_KEY);
    return exclude;
  }

  return DEFAULT_EXCLUDE_TAGS;
}

export function setExcludeTagsSetting(value: string) {
  const sanitized = sanitizeTagList(value, { exclude: false }).raw;
  Application.setState(sanitized, EXCLUDE_TAGS_STATE_KEY);
  Application.setState(
    buildTagArguments(getIncludeTagsSetting(), sanitized),
    EXTRA_ARGS_STATE_KEY,
  );
  syncMangaFilterTagsToSearchFilterTags();
}

function syncMangaFilterTagsToSearchFilterTags(): void {
  // No-op: Handled dynamically by getSearchFilterTags()
}

export function getPagesExpressionSetting(): string {
  return (
    (Application.getState(PAGES_EXPR_STATE_KEY) as string) ?? DEFAULT_PAGES_EXPR
  );
}

export function sanitizePagesExpressionInput(value: string): string {
  return canonicalizePagesExpressionInput(value);
}

function canonicalizePagesExpressionInput(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return DEFAULT_PAGES_EXPR;

  const compact = trimmed.replace(/\s+/g, "");
  const prefixCmp = compact.match(/^(>=|>|<=|<)(\d+)$/);
  if (prefixCmp) {
    const op = prefixCmp[1];
    const n = Number(prefixCmp[2]);
    if (!Number.isNaN(n)) {
      return `${n}${op.startsWith(">") ? "+" : "-"}`;
    }
  }

  const postfixCmp = compact.match(/^(\d+)(>=|>|<=|<)$/);
  if (postfixCmp) {
    const n = Number(postfixCmp[1]);
    const op = postfixCmp[2];
    if (!Number.isNaN(n)) {
      return `${n}${op.startsWith(">") ? "+" : "-"}`;
    }
  }

  const parsed = parsePagesExpression(trimmed);
  if (Object.keys(parsed).length === 0) return DEFAULT_PAGES_EXPR;
  if (parsed.exact !== undefined) return `${parsed.exact}`;
  if (parsed.min !== undefined && parsed.max !== undefined) {
    return `${parsed.min}-${parsed.max}`;
  }
  if (parsed.min !== undefined) return `${parsed.min}+`;
  if (parsed.max !== undefined) return `${parsed.max}-`;
  return DEFAULT_PAGES_EXPR;
}

export function setPagesExpressionSetting(value: string) {
  Application.setState(
    sanitizePagesExpressionInput(value),
    PAGES_EXPR_STATE_KEY,
  );
}

export function getThumbnailQualitySetting(): ThumbnailQuality {
  const stored = Application.getState(THUMBNAIL_QUALITY_KEY) as
    | string
    | undefined;
  if (stored === "low" || stored === "high") return stored;
  return "high";
}

export function setThumbnailQualitySetting(value: ThumbnailQuality) {
  Application.setState(value, THUMBNAIL_QUALITY_KEY);
}

export function getAddTagsToDescriptionSetting(): boolean {
  return getDisplayOptionsSetting().includes("show_tags_in_desc");
}

export function setAddTagsToDescriptionSetting(value: boolean) {
  const current = getDisplayOptionsSetting();
  if (value && !current.includes("show_tags_in_desc")) {
    setDisplayOptionsSetting([...current, "show_tags_in_desc"]);
  } else if (!value && current.includes("show_tags_in_desc")) {
    setDisplayOptionsSetting(current.filter((o) => o !== "show_tags_in_desc"));
  }
}

// Backwards-compatible wrappers for older code that still use promoteTags
export function getPromoteTagsSetting(): boolean {
  return getAddTagsToDescriptionSetting();
}

export function setPromoteTagsSetting(value: boolean) {
  setAddTagsToDescriptionSetting(value);
}

export function getDateFormatSetting(): DateFormatId {
  const value = Application.getState(DATE_FORMAT_STATE_KEY) as
    | DateFormatId
    | undefined;
  if (value && DATE_FORMAT_OPTIONS.find((opt) => opt.id === value))
    return value;
  if (value && (value.includes("_") || value.includes("."))) {
    Application.setState(DEFAULT_DATE_FORMAT, DATE_FORMAT_STATE_KEY);
  }
  return DEFAULT_DATE_FORMAT;
}

export interface DaysOldRange {
  oldest?: number;
  newest?: number;
}

export function getDaysOldFilterSetting(): DaysOldRange {
  try {
    const stored = Application.getState(DATE_DAYS_STATE_KEY) as
      | (DaysOldRange & Record<string, unknown>)
      | undefined;

    if (stored && typeof stored === "object") {
      const oldest =
        typeof stored.oldest === "number" ? stored.oldest : undefined;
      const newest =
        typeof stored.newest === "number" ? stored.newest : undefined;
      const cleaned = { oldest, newest };
      Application.setState(cleaned, DATE_DAYS_STATE_KEY);
      return cleaned;
    }
  } catch {
    Application.setState({}, DATE_DAYS_STATE_KEY);
    return {};
  }

  return {};
}

export function setDaysOldFilterSetting(value: DaysOldRange) {
  Application.setState(value, DATE_DAYS_STATE_KEY);
}

// Backwards-compatible wrappers
export function getDateMinDaysSetting(): number | undefined {
  return getDaysOldFilterSetting().oldest;
}

export function setDateMinDaysSetting(value: number | undefined) {
  const cur = getDaysOldFilterSetting();
  setDaysOldFilterSetting({ ...cur, oldest: value });
}

export function getDateMaxDaysSetting(): number | undefined {
  return getDaysOldFilterSetting().newest;
}

export function setDateMaxDaysSetting(value: number | undefined) {
  const cur = getDaysOldFilterSetting();
  setDaysOldFilterSetting({ ...cur, newest: value });
}

export function setDateFormatSetting(value: DateFormatId) {
  Application.setState(value, DATE_FORMAT_STATE_KEY);
}

export function getDateSeparatorSetting(): DateSeparatorId {
  const value = Application.getState(DATE_SEPARATOR_STATE_KEY) as
    | DateSeparatorId
    | undefined;
  if (value && DATE_SEPARATOR_OPTIONS.find((opt) => opt.id === value))
    return value;
  return DEFAULT_DATE_SEPARATOR;
}

export function setDateSeparatorSetting(value: DateSeparatorId) {
  Application.setState(value, DATE_SEPARATOR_STATE_KEY);
}

export function getViewedHistory(): string[] {
  return (
    (Application.getState(VIEWED_HISTORY_STATE_KEY) as string[]) ??
    DEFAULT_VIEWED_HISTORY
  );
}

export function addToViewedHistory(id: string) {
  const history = getViewedHistory();
  const filtered = history.filter((item) => item !== id);
  filtered.unshift(id);
  const limited = filtered.slice(0, 100);
  Application.setState(limited, VIEWED_HISTORY_STATE_KEY);
}

export function resetViewedHistory() {
  const current = getViewedHistory();
  const remaining = current.slice(0, Math.max(0, current.length - 50));
  Application.setState(remaining, VIEWED_HISTORY_STATE_KEY);
}

export function getDisplayOptionsSetting(): DisplayOptionId[] {
  const stored = Application.getState(DISPLAY_OPTIONS_STATE_KEY) as
    | DisplayOptionId[]
    | undefined;

  // Return defaults only if nothing was ever stored
  if (!Array.isArray(stored)) return [...DEFAULT_DISPLAY_OPTIONS];

  // Filter out any invalid options that may have been saved from old versions
  const validIds = new Set(DISPLAY_OPTION_VALUES.map((opt) => opt.id));
  const filtered = stored.filter((id) => validIds.has(id));

  // Return the filtered array as-is (even if empty - user choice)
  return filtered;
}

export function setDisplayOptionsSetting(value: DisplayOptionId[]) {
  Application.setState(value, DISPLAY_OPTIONS_STATE_KEY);
}

export function getEnableRelatedSetting(): boolean {
  const value = Application.getState(ENABLE_RELATED_STATE_KEY);
  return typeof value === "boolean" ? value : DEFAULT_ENABLE_RELATED;
}

export function setEnableRelatedSetting(value: boolean) {
  Application.setState(value, ENABLE_RELATED_STATE_KEY);
}

export function getHideReadInRelatedSetting(): boolean {
  const value = Application.getState(HIDE_READ_IN_RELATED_STATE_KEY);
  return typeof value === "boolean" ? value : DEFAULT_HIDE_READ_IN_RELATED;
}

export function setHideReadInRelatedSetting(value: boolean): void {
  Application.setState(value, HIDE_READ_IN_RELATED_STATE_KEY);
}

export function getEnableRereadSectionSetting(): boolean {
  const value = Application.getState(ENABLE_REREAD_SECTION_KEY);
  return typeof value === "boolean" ? value : true;
}

export function setEnableRereadSectionSetting(value: boolean): void {
  Application.setState(value, ENABLE_REREAD_SECTION_KEY);
}

export function getDefaultSearchSortSetting(): HitomiSearchSortId {
  const valid = new Set(HITOMI_SEARCH_SORT_OPTIONS.map((option) => option.id));
  const order = getDiscoverSectionOrder();
  const hidden = getHiddenSections();
  const firstVisible = order.find(
    (id) => !hidden.has(id) && valid.has(id as HitomiSearchSortId),
  );
  if (firstVisible) return firstVisible as HitomiSearchSortId;
  return "date_added";
}

export function getPreferredImageFormatSetting(): PreferredImageFormat {
  const value = Application.getState(PREFERRED_IMAGE_FORMAT_STATE_KEY);
  if (value === "webp" || value === "webp-auto") return "webp";
  if (value === "avif" || value === "auto") return "avif";
  return DEFAULT_PREFERRED_IMAGE_FORMAT;
}

export function setPreferredImageFormatSetting(
  value: PreferredImageFormat,
): void {
  Application.setState(value, PREFERRED_IMAGE_FORMAT_STATE_KEY);
}

export function resetHitomiSettings() {
  // User-configurable settings — reset to defaults and immediately re-write
  // the default value so the UI reflects the reset without requiring restart.
  Application.setState([...DEFAULT_LANGUAGE], LANGUAGE_STATE_KEY);
  Application.setState(DEFAULT_HIDE_READ, HIDE_READ_STATE_KEY);
  Application.setState(DEFAULT_EXTRA_ARGS, EXTRA_ARGS_STATE_KEY);
  Application.setState(DEFAULT_INCLUDE_TAGS, INCLUDE_TAGS_STATE_KEY);
  Application.setState(DEFAULT_EXCLUDE_TAGS, EXCLUDE_TAGS_STATE_KEY);
  Application.setState(DEFAULT_PAGES_EXPR, PAGES_EXPR_STATE_KEY);
  Application.setState(_DEFAULT_THUMB_QUALITY, THUMBNAIL_QUALITY_KEY);
  Application.setState(false, PROMOTE_TAGS_STATE_KEY);
  Application.setState(false, ADD_TAGS_STATE_KEY);
  Application.setState(DEFAULT_DATE_FORMAT, DATE_FORMAT_STATE_KEY);
  Application.setState(DEFAULT_DATE_SEPARATOR, DATE_SEPARATOR_STATE_KEY);
  Application.setState([...DEFAULT_DISPLAY_OPTIONS], DISPLAY_OPTIONS_STATE_KEY);
  Application.setState(DEFAULT_ENABLE_RELATED, ENABLE_RELATED_STATE_KEY);
  Application.setState(
    DEFAULT_PREFERRED_IMAGE_FORMAT,
    PREFERRED_IMAGE_FORMAT_STATE_KEY,
  );
  Application.setState(DEFAULT_INCOGNITO, INCOGNITO_STATE_KEY);
  Application.setState(false, FUZZY_SEARCH_TAGS_KEY);
  Application.setState(true, ONLY_FUZZY_UNKNOWN_TAGS_KEY);
  Application.setState(
    DEFAULT_REMOVE_SEPARATOR_SPACES,
    REMOVE_SEPARATOR_SPACES_STATE_KEY,
  );
  Application.setState(DEFAULT_MARK_READ_ON_VIEW, MARK_READ_ON_VIEW_STATE_KEY);
  Application.setState({}, DATE_DAYS_STATE_KEY);
  Application.setState(
    DEFAULT_HIDE_READ_IN_RELATED,
    HIDE_READ_IN_RELATED_STATE_KEY,
  );
  Application.setState(true, ENABLE_REREAD_SECTION_KEY);
  Application.setState(
    DEFAULT_DISCOVER_CAROUSEL_TILES,
    DISCOVER_CAROUSEL_TILES_KEY,
  );
  Application.setState(DEFAULT_DISCOVER_PAGE_TILES, DISCOVER_PAGE_TILES_KEY);
  Application.setState(DEFAULT_SEARCH_PAGE_TILES, SEARCH_PAGE_TILES_KEY);
  // Discover section order & visibility
  Application.setState([...DEFAULT_SECTION_ORDER], DISCOVER_SECTION_ORDER_KEY);
  Application.setState([], DISCOVER_SECTION_HIDDEN_KEY);
  // Search filter persistence
  Application.setState("all", SEARCH_FILTER_LENGTH_KEY);
  Application.setState("all", SEARCH_FILTER_DATE_KEY);
  Application.setState({}, SEARCH_FILTER_TAGS_KEY);
  Application.setState([], SEARCH_FILTER_MANGA_SYNCED_TAGS_KEY);
  // NOTE: Statistics keys are NEVER reset here — use resetAllStatistics() instead
}

export function formatDateByPattern(
  date: Date,
  patternId: DateFormatId,
  separatorId?: DateSeparatorId,
): string {
  const separator =
    DATE_SEPARATOR_OPTIONS.find(
      (opt) => opt.id === (separatorId ?? getDateSeparatorSetting()),
    )?.char ?? ".";

  let format = `mm${separator}dd${separator}yy`;
  switch (patternId) {
    case "mm_dd_yy":
      format = `mm${separator}dd${separator}yy`;
      break;
    case "m_d_yy":
      format = `m${separator}d${separator}yy`;
      break;
    case "yyyy_mm_dd":
      format = `yyyy${separator}mm${separator}dd`;
      break;
    case "dd_mm_yyyy":
      format = `dd${separator}mm${separator}yyyy`;
      break;
    case "mm_yy":
      format = `mm${separator}yy`;
      break;
    case "yy_mm":
      format = `yy${separator}mm`;
      break;
    case "m_yy":
      format = `m${separator}yy`;
      break;
    case "yy_m":
      format = `yy${separator}m`;
      break;
    default:
      format = `mm${separator}dd${separator}yy`;
  }

  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const yy = y.toString().slice(-2);
  const dd = d.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const yyyy = y.toString();

  let result = format;
  result = result.replace(/yyyy/g, yyyy);
  result = result.replace(/yy/g, yy);
  result = result.replace(/mm/g, mm);
  result = result.replace(/dd/g, dd);
  result = result.replace(/\bm\b/g, m.toString());
  result = result.replace(/\bd\b/g, d.toString());
  return result;
}

export function parsePagesExpression(value: string): {
  min?: number;
  max?: number;
  exact?: number;
} {
  if (!value || typeof value !== "string") return {};
  const raw = value.trim();
  if (!raw) return {};
  const s = raw.replace(/\s+/g, "").replace(/[pg]/gi, "c");

  // Handle -5 format as "less than 5 pages" (max 5)
  const negativeMatch = s.match(/^-(\d+)$/);
  if (negativeMatch) {
    const num = parseInt(negativeMatch[1], 10);
    if (!Number.isNaN(num)) {
      return { max: num };
    }
  }

  const suffixMatch = s.match(/^(\d+)([+-])$/);
  if (suffixMatch) {
    const num = parseInt(suffixMatch[1], 10);
    if (!Number.isNaN(num)) {
      return suffixMatch[2] === "+" ? { min: num } : { max: num };
    }
  }

  const eqMatch = s.match(/^=?\s*(\d+)$/);
  if (eqMatch) {
    const exact = parseInt(eqMatch[1], 10);
    if (!Number.isNaN(exact)) return { min: exact, max: exact, exact };
  }

  if (/^>\d+$/.test(s)) {
    const num = parseInt(s.slice(1), 10);
    return { min: num };
  }
  if (/^>=\d+$/.test(s)) {
    const num = parseInt(s.slice(2), 10);
    return { min: num };
  }
  if (/^<\d+$/.test(s)) {
    const num = parseInt(s.slice(1), 10);
    return { max: num };
  }
  if (/^<=\d+$/.test(s)) {
    const num = parseInt(s.slice(2), 10);
    return { max: num };
  }

  // Postfix operator syntax: 5000>, 5000>=, 5000<, 5000<=
  const postfixCmpMatch = s.match(/^(\d+)(>=?|<=?)$/);
  if (postfixCmpMatch) {
    const num = parseInt(postfixCmpMatch[1], 10);
    const op = postfixCmpMatch[2];
    if (!Number.isNaN(num)) {
      if (op === ">") return { min: num };
      if (op === ">=") return { min: num };
      if (op === "<") return { max: num };
      if (op === "<=") return { max: num };
    }
  }

  // Advanced range syntax: 99>x>69, 99>=x>=69 (or with 'c' for count)
  // These express bounds on x: a>x>b means b < x < a
  const advRangeGT = s.match(/^(\d+)(>=?)c?(>=?)(\d+)$/);
  if (advRangeGT) {
    const left = parseInt(advRangeGT[1], 10);
    const right = parseInt(advRangeGT[4], 10);
    if (!Number.isNaN(left) && !Number.isNaN(right)) {
      const minVal = right;
      const maxVal = left;
      return { min: Math.min(minVal, maxVal), max: Math.max(minVal, maxVal) };
    }
  }

  // Alternative advanced range syntax: 57<x<67, 57<=x<=67
  const advRangeLT = s.match(/^(\d+)(<[=]?)c?(<[=]?)(\d+)$/);
  if (advRangeLT) {
    const left = parseInt(advRangeLT[1], 10);
    const right = parseInt(advRangeLT[4], 10);
    if (!Number.isNaN(left) && !Number.isNaN(right)) {
      const minVal = left;
      const maxVal = right;
      return { min: Math.min(minVal, maxVal), max: Math.max(minVal, maxVal) };
    }
  }

  const pattern = /^(\d+)c?(?:-|to)(\d+)$/i;
  const m = s.match(pattern);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    return { min: low, max: high };
  }

  const rangeMatch = s.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const a = parseInt(rangeMatch[1], 10);
    const b = parseInt(rangeMatch[2], 10);
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    return { min: low, max: high };
  }

  const nums = s.match(/\d+/g)?.map((n) => parseInt(n, 10)) || [];
  if (nums.length >= 2) {
    return { min: Math.min(...nums), max: Math.max(...nums) };
  }

  if (/^\d+$/.test(s)) {
    const num = parseInt(s, 10);
    return { min: num, max: num, exact: num };
  }

  return {};
}

export function applyCheckboxValue(
  state: { value: string[] },
  fallback: boolean,
): boolean {
  const selected = state.value?.[0];
  if (selected === "on") return true;
  if (selected === "off") return false;
  return fallback;
}

export type TagFilterValue = Record<string, "included" | "excluded">;

export function buildTagFilter(): SearchFilter {
  return {
    id: "tags",
    type: "multiselect",
    title: "Tags",
    options: [],
    value: {},
    allowExclusion: true,
    allowEmptySelection: true,
    maximum: undefined,
  } satisfies SearchFilter;
}

export function getIncognitoModeSetting(): boolean {
  const stored = Application.getState(INCOGNITO_STATE_KEY);
  return typeof stored === "boolean" ? stored : DEFAULT_INCOGNITO;
}

export function setIncognitoModeSetting(value: boolean): void {
  Application.setState(value, INCOGNITO_STATE_KEY);
}

export function getRemoveSeparatorSpacesSetting(): boolean {
  const stored = Application.getState(REMOVE_SEPARATOR_SPACES_STATE_KEY);
  return typeof stored === "boolean" ? stored : DEFAULT_REMOVE_SEPARATOR_SPACES;
}

export function setRemoveSeparatorSpacesSetting(value: boolean): void {
  Application.setState(value, REMOVE_SEPARATOR_SPACES_STATE_KEY);
}

function sanitizeTagList(
  raw: string,
  options: { exclude?: boolean } = {},
): { tokens: string[]; raw: string } {
  const cleaned = raw
    .replace(/['\u2018\u2019]/g, "'")
    .replace(/["\u201C\u201D]/g, '"');

  const parts = cleaned
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((tag) => {
      // Check if this tag contains OR expressions
      if (/\s*\|\|\s*|\s+OR\s+/i.test(tag)) {
        // Handle OR group - preserve the OR operator
        const orParts = tag
          .split(/\s*\|\|\s*|\s+OR\s+/i)
          .map((t) => t.trim())
          .filter(Boolean);
        const processed = orParts.map((orTag) => {
          // Remove leading -/+ from tag for normalization
          let normalized = orTag.replace(/^[-+]/, "");

          // Check if tag already has a type prefix (artist:, female:, male:, etc.)
          const prefixMatch = normalized.match(
            /^(artist|group|series|character|male|female|language|tag):(.+)$/i,
          );
          let prefix = "";
          if (prefixMatch) {
            prefix = prefixMatch[1].toLowerCase() + ":";
            normalized = prefixMatch[2].trim();
          }

          // Handle quoted strings
          if (normalized.startsWith('"') && normalized.endsWith('"')) {
            normalized = normalized.slice(1, -1);
          }

          // Quote multi-word tags for proper parsing
          const shouldQuote =
            normalized.includes(" ") && !/^".*"$/.test(normalized);
          return `${prefix}${shouldQuote ? `"${normalized}"` : normalized}`;
        });
        return `${options.exclude ? "-" : ""}${processed.join(" OR ")}`;
      } else {
        // Remove leading -/+ from tag for normalization
        let normalized = tag.replace(/^[-+]/, "");

        // Check if tag already has a type prefix (artist:, female:, male:, etc.)
        const prefixMatch = normalized.match(
          /^(artist|group|series|character|male|female|language|tag):(.+)$/i,
        );
        let prefix = ""; // NO automatic prefix - parseTagsFromQuery will detect type dynamically
        if (prefixMatch) {
          prefix = prefixMatch[1].toLowerCase() + ":";
          normalized = prefixMatch[2].trim();
        }

        // Handle quoted strings
        if (normalized.startsWith('"') && normalized.endsWith('"')) {
          normalized = normalized.slice(1, -1);
        }

        // Quote multi-word tags for proper parsing
        const shouldQuote =
          normalized.includes(" ") && !/^".*"$/.test(normalized);
        const finalTag = `${prefix}${shouldQuote ? `"${normalized}"` : normalized}`;
        return `${options.exclude ? "-" : ""}${finalTag}`;
      }
    });

  return { tokens: parts, raw: parts.join(", ") };
}

function hasSplitTagSettingsState(): boolean {
  return (
    Application.getState(INCLUDE_TAGS_STATE_KEY) !== undefined ||
    Application.getState(EXCLUDE_TAGS_STATE_KEY) !== undefined
  );
}

function convertMangaFilterTokenToSearchFilterId(
  token: string,
): string | undefined {
  if (!token || token.startsWith("-") || /\s+OR\s+/i.test(token))
    return undefined;

  let normalized = token.trim();
  const prefixMatch = normalized.match(
    /^(artist|group|series|character|male|female|language|tag):(.+)$/i,
  );
  if (prefixMatch) {
    if (prefixMatch[1].toLowerCase() !== "tag") return undefined;
    normalized = prefixMatch[2].trim();
  }

  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    normalized = normalized.slice(1, -1);
  }

  const slug = normalized
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .trim();
  return slug.length > 0 ? slug : undefined;
}

function buildTagArguments(include: string, exclude: string): string {
  const includeTokens = sanitizeTagList(include, { exclude: false }).tokens;
  const excludeTokens = sanitizeTagList(exclude, { exclude: true }).tokens;
  // Use comma separator to match parseTagsFromQuery which splits by comma
  return [...includeTokens, ...excludeTokens.map((token) => `-${token}`)]
    .join(", ")
    .trim();
}

function splitLegacyExtraArgs(value: string): {
  include: string;
  exclude: string;
} {
  const parts = value
    .split(/[\n]/)
    .flatMap((line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/))
    .map((p) => p.trim())
    .filter(Boolean);
  const include: string[] = [];
  const exclude: string[] = [];
  for (const part of parts) {
    if (part.startsWith("-")) exclude.push(part.slice(1));
    else include.push(part);
  }
  return { include: include.join(", "), exclude: exclude.join(", ") };
}

// ==============================
// Rate Limiter Settings
// ==============================

// Balanced defaults: fast enough for discover/search tile loading while
// still allowing dynamic backoff logic to react to 429/503 responses.
const DEFAULT_REQUESTS_PER_SECOND = 14;
const DEFAULT_BUFFER_INTERVAL = 0.1;
const DEFAULT_TIMEOUT = 30000; // ms
const DEFAULT_GG_TTL = 300; // seconds (5 minutes) - balance freshness vs requests

export interface RateLimiterSettings {
  requestsPerSecond: number;
  bufferInterval: number;
  timeout: number;
  ggTtl: number;
}

export function getRateLimiterSettings(): RateLimiterSettings {
  const storedRps = Application.getState(DEV_REQUESTS_PER_SECOND_KEY) as
    | number
    | undefined;
  const storedBuffer = Application.getState(DEV_BUFFER_INTERVAL_KEY) as
    | number
    | undefined;
  // Guard against stale low persisted settings which can serialize gallery
  // detail requests to ~1/sec and make sections appear stalled.
  const requestsPerSecond = Math.max(
    DEFAULT_REQUESTS_PER_SECOND,
    Number.isFinite(storedRps)
      ? (storedRps as number)
      : DEFAULT_REQUESTS_PER_SECOND,
  );
  const bufferInterval = Number.isFinite(storedBuffer)
    ? Math.max(0, Math.min(10, storedBuffer as number))
    : DEFAULT_BUFFER_INTERVAL;
  const timeout =
    (Application.getState(DEV_TIMEOUT_KEY) as number) ?? DEFAULT_TIMEOUT;
  const ggTtl =
    (Application.getState(DEV_GG_TTL_KEY) as number) ?? DEFAULT_GG_TTL;
  return { requestsPerSecond, bufferInterval, timeout, ggTtl };
}

export function setRequestsPerSecond(value: number): void {
  Application.setState(
    Math.max(1, Math.min(200, value)),
    DEV_REQUESTS_PER_SECOND_KEY,
  );
}

export function setBufferInterval(value: number): void {
  Application.setState(
    Math.max(0, Math.min(10, value)),
    DEV_BUFFER_INTERVAL_KEY,
  );
}

export function setRequestTimeout(value: number): void {
  Application.setState(
    Math.max(5000, Math.min(120000, value)),
    DEV_TIMEOUT_KEY,
  );
}

export function setGgTtl(value: number): void {
  Application.setState(Math.max(60, Math.min(3600, value)), DEV_GG_TTL_KEY);
}

export function resetRateLimiterSettings(): void {
  Application.setState(
    DEFAULT_REQUESTS_PER_SECOND,
    DEV_REQUESTS_PER_SECOND_KEY,
  );
  Application.setState(DEFAULT_BUFFER_INTERVAL, DEV_BUFFER_INTERVAL_KEY);
  Application.setState(DEFAULT_TIMEOUT, DEV_TIMEOUT_KEY);
  Application.setState(DEFAULT_GG_TTL, DEV_GG_TTL_KEY);
}

// ── Fuzzy Search Settings ──────────────────────────────────────────

export function getFuzzySearchTagsSetting(): boolean {
  return (
    (Application.getState(FUZZY_SEARCH_TAGS_KEY) as boolean | undefined) ??
    false
  );
}

export function setFuzzySearchTagsSetting(value: boolean): void {
  Application.setState(value, FUZZY_SEARCH_TAGS_KEY);
}

export function getOnlyFuzzyUnknownTagsSetting(): boolean {
  return (
    (Application.getState(ONLY_FUZZY_UNKNOWN_TAGS_KEY) as
      | boolean
      | undefined) ?? true
  );
}

export function setOnlyFuzzyUnknownTagsSetting(value: boolean): void {
  Application.setState(value, ONLY_FUZZY_UNKNOWN_TAGS_KEY);
}

// ── Statistics Settings ────────────────────────────────────────────

export interface ReadingSession {
  date: string; // ISO date string (YYYY-MM-DD)
  count: number; // galleries viewed that day
}

export function getStatsInstallDate(): string | undefined {
  return Application.getState(STATS_INSTALL_DATE_KEY) as string | undefined;
}

export function setStatsInstallDate(date: string): void {
  if (!getStatsInstallDate()) {
    Application.setState(date, STATS_INSTALL_DATE_KEY);
  }
}

export function ensureInstallDate(): void {
  if (!getStatsTrackingEnabledSetting()) return;
  if (!getStatsInstallDate()) {
    Application.setState(new Date().toISOString(), STATS_INSTALL_DATE_KEY);
  }
  // Seed totalRead from existing read cache if stat wasn't tracking yet
  if (getTotalMangaRead() === 0) {
    const readHistoryKeys = [
      "hitomi.readHistory",
      "hitomi.viewedHistory",
      "hitomi.viewHistory",
      "hitomi.readCache",
      "hitomi.read",
      "hitomi.read_history",
    ];
    const seeded = new Set<string>();
    for (const key of readHistoryKeys) {
      const readCacheRaw = Application.getState(key) as string[] | undefined;
      if (!Array.isArray(readCacheRaw)) continue;
      for (const id of readCacheRaw) {
        if (typeof id === "string" && id.length > 0) seeded.add(id);
      }
    }
    if (seeded.size > 0) {
      Application.setState(seeded.size, STATS_TOTAL_READ_KEY);
    }
  }
}

export function getDisplayedMangaCount(): number {
  const val = Application.getState(STATS_DISPLAYED_MANGA_KEY);
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return 0;
}

export function incrementDisplayedManga(mangaId?: string): void {
  if (!getStatsTrackingEnabledSetting()) return;
  Application.setState(getDisplayedMangaCount() + 1, STATS_DISPLAYED_MANGA_KEY);

  if (!mangaId) return;
  const ids = getDisplayedIds();
  const isNew = !ids.has(mangaId);
  if (isNew) {
    ids.add(mangaId);
    persistDisplayedIds(ids);
    Application.setState(
      getDisplayedDistinctTotal() + 1,
      STATS_DISPLAYED_TOTAL_DISTINCT_KEY,
    );
  }
  Application.setState(getDisplayedDistinctTotal(), STATS_DISPLAYED_DISTINCT_KEY);
}

function getDisplayedIds(): Set<string> {
  const raw = Application.getState(STATS_DISPLAYED_IDS_KEY) as
    | string[]
    | undefined;
  if (Array.isArray(raw)) return new Set(raw);
  return new Set();
}

function persistDisplayedIds(ids: Set<string>): void {
  // Keep the full distinct history so the counter can grow beyond the old cap.
  Application.setState(Array.from(ids), STATS_DISPLAYED_IDS_KEY);
}

function getDisplayedDistinctTotal(): number {
  const val = Application.getState(STATS_DISPLAYED_TOTAL_DISTINCT_KEY);
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return getDisplayedIds().size;
}

export function getDistinctDisplayedMangaCount(): number {
  const val = Application.getState(STATS_DISPLAYED_DISTINCT_KEY);
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return getDisplayedIds().size;
}

export function getReadingSessions(): ReadingSession[] {
  return (
    (Application.getState(STATS_SESSIONS_KEY) as
      | ReadingSession[]
      | undefined) ?? []
  );
}

function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

let screenTimeSessionTimestamps: Map<string, number> | undefined;

function getScreenTimeSessionTimestamps(): Map<string, number> {
  if (!screenTimeSessionTimestamps) {
    const raw = Application.getState(
      STATS_SCREEN_TIME_SESSION_TIMESTAMPS_KEY,
    ) as Record<string, unknown> | undefined;
    screenTimeSessionTimestamps = new Map<string, number>();
    if (raw && typeof raw === "object") {
      for (const [id, ts] of Object.entries(raw)) {
        if (typeof ts === "number" && Number.isFinite(ts) && ts > 0) {
          screenTimeSessionTimestamps.set(id, ts);
        }
      }
    }
  }
  return screenTimeSessionTimestamps;
}

function persistScreenTimeSessionTimestamps(map: Map<string, number>): void {
  const cutoff = Date.now() - SCREEN_TIME_SESSION_COOLDOWN_MS;
  const serialized: Record<string, number> = {};
  for (const [id, ts] of map) {
    if (ts >= cutoff) {
      serialized[id] = ts;
    }
  }
  Application.setState(serialized, STATS_SCREEN_TIME_SESSION_TIMESTAMPS_KEY);
}

export function recordReadingSession(sessionId?: string): void {
  if (!getStatsTrackingEnabledSetting()) return;
  const now = Date.now();
  if (sessionId) {
    const timestamps = getScreenTimeSessionTimestamps();
    const lastRecorded = timestamps.get(sessionId) ?? 0;
    if (now - lastRecorded < SCREEN_TIME_SESSION_COOLDOWN_MS) return;
    timestamps.set(sessionId, now);
    persistScreenTimeSessionTimestamps(timestamps);
  }

  const today = toLocalDateKey(new Date(now));
  const sessions = getReadingSessions();
  const existing = sessions.find((s) => s.date === today);
  if (existing) {
    existing.count++;
  } else {
    sessions.push({ date: today, count: 1 });
  }
  // Keep only last 90 days of sessions
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const cutoff = toLocalDateKey(cutoffDate);
  const trimmed = sessions.filter((s) => s.date >= cutoff);
  Application.setState(trimmed, STATS_SESSIONS_KEY);
  // Approximate screen time: count each reading session as 1 minute
  recordScreenTime(1);
}

// -- Streak Grace --

export function getStreakGraceDays(): number {
  return (
    (Application.getState(STATS_STREAK_GRACE_KEY) as number | undefined) ?? 0
  );
}

export function setStreakGraceDays(days: number): void {
  Application.setState(days, STATS_STREAK_GRACE_KEY);
}

export function getPageCounts(): Record<string, number> {
  const raw =
    (Application.getState(STATS_PAGE_COUNTS_KEY) as
      | Record<string, unknown>
      | undefined) ?? {};
  const normalized: Record<string, number> = {};
  for (const [bucket, value] of Object.entries(raw)) {
    const numeric = Number(value ?? 0);
    normalized[bucket] = Number.isFinite(numeric) ? numeric : 0;
  }
  return normalized;
}

export function recordPageCount(pages: number): void {
  if (!getStatsTrackingEnabledSetting()) return;
  const counts = getPageCounts();
  const bucket =
    pages <= 20
      ? "1-20"
      : pages <= 50
        ? "21-50"
        : pages <= 100
          ? "51-100"
          : pages <= 200
            ? "101-200"
            : "200+";
  counts[bucket] = (counts[bucket] ?? 0) + 1;
  Application.setState(counts, STATS_PAGE_COUNTS_KEY);
}

export function getTagCounts(): Record<string, number> {
  const raw =
    (Application.getState(STATS_TAG_COUNTS_KEY) as
      | Record<string, unknown>
      | undefined) ?? {};
  const normalized: Record<string, number> = {};
  for (const [tag, value] of Object.entries(raw)) {
    const numeric = Number(value ?? 0);
    normalized[tag] = Number.isFinite(numeric) ? numeric : 0;
  }
  return normalized;
}

export function recordTagCounts(tags: string[]): void {
  if (!getStatsTrackingEnabledSetting()) return;
  const counts = getTagCounts();
  for (const tag of tags) {
    const normalized = tag.toLowerCase().trim();
    if (normalized) {
      counts[normalized] = (counts[normalized] ?? 0) + 1;
    }
  }
  // Keep only top 200 tags to prevent unbounded growth
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const trimmed = Object.fromEntries(entries.slice(0, 200));
  Application.setState(trimmed, STATS_TAG_COUNTS_KEY);
}

export function getTotalMangaRead(): number {
  const val = Application.getState(STATS_TOTAL_READ_KEY);
  // Explicit numeric value takes precedence (including 0 after a reset)
  if (typeof val === "number") return val;
  // Legacy: boolean/string stored values
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "string") return parseInt(val, 10) || 0;
  // Never been set – fallback to read history array length
  const readHistory = Application.getState("hitomi.readHistory") as
    | string[]
    | undefined;
  return Array.isArray(readHistory) ? readHistory.length : 0;
}

export function incrementTotalMangaRead(): void {
  if (!getStatsTrackingEnabledSetting()) return;
  Application.setState(getTotalMangaRead() + 1, STATS_TOTAL_READ_KEY);
}

export function getMarkReadOnDescCount(): number {
  const val = Application.getState(STATS_MARK_READ_ON_DESC_COUNT_KEY);
  return typeof val === "number" ? val : 0;
}

export function incrementMarkReadOnDescCount(): void {
  if (!getStatsTrackingEnabledSetting()) return;
  Application.setState(
    getMarkReadOnDescCount() + 1,
    STATS_MARK_READ_ON_DESC_COUNT_KEY,
  );
}

function getReadCountMap(): ReadCountMap {
  const raw = Application.getState(STATS_READ_COUNT_MAP_KEY) as
    | ReadCountMap
    | undefined;
  if (raw && typeof raw === "object") return { ...raw };
  return {};
}

function persistReadCountMap(map: ReadCountMap): void {
  // Keep only top 500 entries by count to prevent unbounded growth
  const sorted = Object.entries(map)
    .filter(([, v]) => v && typeof v.count === "number" && v.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 500);
  const trimmed: ReadCountMap = {};
  for (const [id, value] of sorted) {
    trimmed[id] = value;
  }
  Application.setState(trimmed, STATS_READ_COUNT_MAP_KEY);
}

function normalizeStatsMangaId(mangaId: string): string {
  const normalized = String(mangaId ?? "").trim();
  if (!normalized) return "";
  if (/^\d+$/.test(normalized)) {
    return String(parseInt(normalized, 10));
  }
  return normalized;
}

// Per-manga timestamp tracking for reread cooldown (5 minutes)
const REREAD_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
let rereadTimestamps: Map<string, number> | undefined;

function getRereadTimestamps(): Map<string, number> {
  if (!rereadTimestamps) {
    const raw = Application.getState(STATS_REREAD_TIMESTAMPS_KEY) as
      | Record<string, unknown>
      | undefined;
    rereadTimestamps = new Map<string, number>();
    if (raw && typeof raw === "object") {
      for (const [id, ts] of Object.entries(raw)) {
        if (typeof ts === "number" && Number.isFinite(ts) && ts > 0) {
          rereadTimestamps.set(id, ts);
        }
      }
    }
  }
  return rereadTimestamps;
}

function persistRereadTimestamps(map: Map<string, number>): void {
  const serialized: Record<string, number> = {};
  for (const [id, ts] of map) {
    serialized[id] = ts;
  }
  Application.setState(serialized, STATS_REREAD_TIMESTAMPS_KEY);
}

export function recordMangaReadCount(
  mangaId: string,
  title?: string | null,
  isFirstRead = false,
  tags?: string[],
): void {
  if (!getStatsTrackingEnabledSetting()) return;
  const normalizedMangaId = normalizeStatsMangaId(mangaId);
  if (!normalizedMangaId) return;

  // Enforce 5-minute cooldown per manga between counted reads.
  // Ensure we record a timestamp even on the first read so an immediate
  // subsequent click within the cooldown window does not count as a reread.
  const timestamps = getRereadTimestamps();
  if (normalizedMangaId !== mangaId && timestamps.has(mangaId)) {
    const legacyTs = timestamps.get(mangaId) ?? 0;
    const canonicalTs = timestamps.get(normalizedMangaId) ?? 0;
    timestamps.set(normalizedMangaId, Math.max(legacyTs, canonicalTs));
    timestamps.delete(mangaId);
  }
  const lastRead = timestamps.get(normalizedMangaId) ?? 0;
  const now = Date.now();
  if (!isFirstRead) {
    if (now - lastRead < REREAD_COOLDOWN_MS) {
      return; // Skip counting — too soon since last read
    }
  }
  // Always update the timestamp to now so future reads respect the cooldown
  timestamps.set(normalizedMangaId, now);
  const cutoff = now - REREAD_COOLDOWN_MS;
  for (const [id, ts] of timestamps) {
    if (ts < cutoff) timestamps.delete(id);
  }
  if (timestamps.size > 500) {
    const oldest = [...timestamps.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, timestamps.size - 500);
    for (const [id] of oldest) {
      timestamps.delete(id);
    }
  }
  persistRereadTimestamps(timestamps);

  const map = getReadCountMap();
  const baseCount = Number(map[normalizedMangaId]?.count ?? 0);
  let existing = Number.isFinite(baseCount) ? baseCount : 0;
  if (normalizedMangaId !== mangaId && map[mangaId]) {
    const legacyCount = Number(map[mangaId]?.count ?? 0);
    existing += Number.isFinite(legacyCount) ? legacyCount : 0;
  }
  if (existing === 0 && !isFirstRead) {
    existing = 1;
  }
  const newCount = existing + 1;
  map[normalizedMangaId] = {
    count: newCount,
    title:
      title ??
      map[normalizedMangaId]?.title ??
      (normalizedMangaId !== mangaId ? map[mangaId]?.title : undefined),
    tags:
      tags ??
      map[normalizedMangaId]?.tags ??
      (normalizedMangaId !== mangaId ? map[mangaId]?.tags : undefined),
  };
  if (normalizedMangaId !== mangaId) {
    delete map[mangaId];
  }
  persistReadCountMap(map);

  if (isFirstRead) {
    incrementTotalMangaRead();
  }
}

export function getRereadStats(): {
  totalRereads: number;
  totalMangaReread: number;
  top: { mangaId: string; title?: string; count: number; tags?: string[] }[];
} {
  const map = getReadCountMap();
  let totalRereads = 0;
  let totalMangaReread = 0;
  const topSource: {
    mangaId: string;
    title?: string;
    count: number;
    tags?: string[];
  }[] = [];

  for (const [id, entry] of Object.entries(map)) {
    if (!entry || typeof entry.count !== "number") continue;
    if (entry.count > 1) {
      totalMangaReread++;
      totalRereads += entry.count - 1;
      topSource.push({
        mangaId: id,
        title: entry.title,
        count: entry.count,
        tags: entry.tags,
      });
    }
  }

  const top = topSource.sort(
    (a, b) => b.count - a.count || a.mangaId.localeCompare(b.mangaId),
  );

  return { totalRereads, totalMangaReread, top };
}

export function getAllRereadManga(): {
  mangaId: string;
  title?: string;
  count: number;
}[] {
  const map = getReadCountMap();
  const results: { mangaId: string; title?: string; count: number }[] = [];
  for (const [id, entry] of Object.entries(map)) {
    if (!entry || typeof entry.count !== "number") continue;
    if (entry.count > 1) {
      results.push({ mangaId: id, title: entry.title, count: entry.count });
    }
  }
  return results.sort(
    (a, b) => b.count - a.count || a.mangaId.localeCompare(b.mangaId),
  );
}

export function getRereadCount(mangaId: string): number {
  const normalizedMangaId = normalizeStatsMangaId(mangaId);
  if (!normalizedMangaId) return 0;
  const map = getReadCountMap();
  return map[normalizedMangaId]?.count ?? map[mangaId]?.count ?? 0;
}

function toLocalStatsDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getDataReceived(): number {
  const val = Application.getState(STATS_DATA_RECEIVED_KEY);
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return 0;
}

function getDataReceivedMap(): DataReceivedMap {
  const raw = Application.getState(STATS_DATA_RECEIVED_DAILY_KEY) as
    | DataReceivedMap
    | undefined;
  if (raw && typeof raw === "object") return { ...raw };
  return {};
}

export function getDataReceivedToday(): number {
  const map = getDataReceivedMap();
  const value = map[toLocalStatsDateKey()] ?? 0;
  return Number.isFinite(value) ? value : 0;
}

function persistDataReceivedMap(map: DataReceivedMap): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffKey = toLocalStatsDateKey(cutoff);
  const trimmed: DataReceivedMap = {};
  for (const [date, bytes] of Object.entries(map).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (date >= cutoffKey && Number.isFinite(bytes) && bytes > 0) {
      trimmed[date] = bytes;
    }
  }
  Application.setState(trimmed, STATS_DATA_RECEIVED_DAILY_KEY);
}

export function addDataReceived(bytes: number): void {
  if (!getStatsTrackingEnabledSetting()) return;
  if (bytes > 0) {
    Application.setState(getDataReceived() + bytes, STATS_DATA_RECEIVED_KEY);
    const map = getDataReceivedMap();
    const today = toLocalStatsDateKey();
    map[today] = (map[today] ?? 0) + bytes;
    persistDataReceivedMap(map);
  }
}

export function recordScreenTime(minutes: number): void {
  if (!getStatsTrackingEnabledSetting()) return;
  if (!getScreenTimeEnabledSetting()) return;
  if (minutes <= 0 || Number.isNaN(minutes)) return;
  const today = toLocalStatsDateKey();
  const map = getScreenTimeMap();
  map[today] = (map[today] ?? 0) + minutes;
  persistScreenTimeMap(map);
}

export function getScreenTimeMap(): ScreenTimeMap {
  const raw = Application.getState(STATS_SCREEN_TIME_KEY) as
    | ScreenTimeMap
    | undefined;
  if (raw && typeof raw === "object") return { ...raw };
  return {};
}

export function getTotalScreenTimeMinutes(): number {
  const map = getScreenTimeMap();
  return Object.values(map).reduce((sum, value) => {
    const n = typeof value === "number" ? value : Number(value ?? 0);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
}

function persistScreenTimeMap(map: ScreenTimeMap): void {
  const sortedEntries = Object.entries(map)
    .filter(([, minutes]) => typeof minutes === "number" && minutes > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  const trimmed: ScreenTimeMap = {};
  for (const [date, minutes] of sortedEntries) {
    trimmed[date] = minutes;
  }
  Application.setState(trimmed, STATS_SCREEN_TIME_KEY);
}

export function getScreenTimeLastNDays(
  days: number,
  weekOffset: number = 0,
): { date: string; minutes: number }[] {
  const map = getScreenTimeMap();
  const results: { date: string; minutes: number }[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = new Date(today);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(today.getDate() - daysSinceMonday - weekOffset * 7);
  for (let i = 0; i < days; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    // Use local date components to avoid UTC offset shifting days
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    results.push({ date: key, minutes: map[key] ?? 0 });
  }
  return results;
}

export function getScreenTimeLastNWeeks(): {
  weekStart: string;
  minutes: number;
}[] {
  const map = getScreenTimeMap();
  const results: { weekStart: string; minutes: number }[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setHours(0, 0, 0, 0);
  startOfThisWeek.setDate(today.getDate() - daysSinceMonday);

  // Determine earliest Monday from both install date and stored screen-time
  // keys. Older installs may have data that predates the current install key,
  // and missing install dates should not collapse history to only this week.
  const candidateDates: Date[] = [];
  const installDateStr = getStatsInstallDate();
  if (installDateStr) {
    const [iy, im, iday] = installDateStr.split("-").map(Number);
    candidateDates.push(new Date(iy, im - 1, iday));
  }
  for (const [key, minutes] of Object.entries(map)) {
    if (!minutes || minutes <= 0) continue;
    const [y, m, d] = key.split("-").map(Number);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      candidateDates.push(new Date(y, m - 1, d));
    }
  }

  let earliestMonday = new Date(startOfThisWeek);
  for (const candidate of candidateDates) {
    candidate.setHours(0, 0, 0, 0);
    const dow = candidate.getDay();
    const daysSinceCandidateMonday = (dow + 6) % 7;
    const candidateMonday = new Date(candidate);
    candidateMonday.setDate(candidate.getDate() - daysSinceCandidateMonday);
    if (candidateMonday < earliestMonday) earliestMonday = candidateMonday;
  }

  // Iterate from earliestMonday to startOfThisWeek inclusive
  let current = new Date(earliestMonday);
  while (current <= startOfThisWeek) {
    const weekStartKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(current);
      d.setDate(current.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      sum += map[key] ?? 0;
    }
    results.push({ weekStart: weekStartKey, minutes: sum });
    current = new Date(current);
    current.setDate(current.getDate() + 7);
  }
  return results;
}

// ── Screen Time Mode Persistence ───────────────────────────────────

const SCREEN_TIME_MODE_KEY = "hitomi.stats.screenTimeMode";
const SCREEN_TIME_WEEK_OFFSET_KEY = "hitomi.stats.screenTimeWeekOffset";

export function getScreenTimeEnabledSetting(): boolean {
  const value = Application.getState(STATS_SCREEN_TIME_ENABLED_KEY) as
    | boolean
    | undefined;
  return value !== false;
}

export function setScreenTimeEnabledSetting(enabled: boolean): void {
  Application.setState(enabled, STATS_SCREEN_TIME_ENABLED_KEY);
}

export function getStatsTrackingEnabledSetting(): boolean {
  const value = Application.getState(STATS_TRACKING_ENABLED_KEY) as
    | boolean
    | undefined;
  return value !== false;
}

export function setStatsTrackingEnabledSetting(enabled: boolean): void {
  Application.setState(enabled, STATS_TRACKING_ENABLED_KEY);
}

export function getScreenTimeMode(): "week" | "day" {
  const val = Application.getState(SCREEN_TIME_MODE_KEY);
  return val === "day" ? "day" : "week";
}

export function setScreenTimeMode(mode: "week" | "day"): void {
  Application.setState(mode, SCREEN_TIME_MODE_KEY);
}

export function getScreenTimeWeekOffset(): number {
  const v = Application.getState(SCREEN_TIME_WEEK_OFFSET_KEY);
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function setScreenTimeWeekOffset(offset: number): void {
  Application.setState(
    Math.max(0, Math.floor(offset)),
    SCREEN_TIME_WEEK_OFFSET_KEY,
  );
}

// ── Tag Display Limit ──────────────────────────────────────────────

const TAG_DISPLAY_LIMIT_KEY = "hitomi.stats.tagDisplayLimit";
const TAG_DISPLAY_STEPS = [75, 50, 25, 15, 10, 5, 3, 1];

const REREAD_DISPLAY_LIMIT_KEY = "hitomi.stats.rereadDisplayLimit";
const REREAD_DISPLAY_STEPS = [75, 50, 25, 15, 10, 5, 3, 1];

export function getTagDisplayLimit(): number {
  const raw = Application.getState(TAG_DISPLAY_LIMIT_KEY) as
    | number
    | string
    | boolean
    | undefined;
  const val = Number(raw);
  if (Number.isFinite(val) && val > 0) return Math.max(1, Math.trunc(val));
  return 75;
}

export function setTagDisplayLimit(limit: number): void {
  Application.setState(Math.max(1, Math.trunc(limit)), TAG_DISPLAY_LIMIT_KEY);
}

export function getTagDisplaySteps(): number[] {
  return TAG_DISPLAY_STEPS;
}

export function getRereadDisplayLimit(): number {
  const raw = Application.getState(REREAD_DISPLAY_LIMIT_KEY) as
    | number
    | string
    | boolean
    | undefined;
  const val = Number(raw);
  if (Number.isFinite(val) && val > 0) return Math.max(1, Math.trunc(val));
  return 10;
}

export function setRereadDisplayLimit(limit: number): void {
  Application.setState(
    Math.max(1, Math.trunc(limit)),
    REREAD_DISPLAY_LIMIT_KEY,
  );
}

export function getRereadDisplaySteps(): number[] {
  return REREAD_DISPLAY_STEPS;
}

// ── Average Page Count ─────────────────────────────────────────────

export function getAveragePageCount(): number {
  const counts = getPageCounts();
  let totalItems = 0;
  let weightedSum = 0;
  // Use midpoints for each bucket
  const midpoints: Record<string, number> = {
    "1-20": 10,
    "21-50": 35,
    "51-100": 75,
    "101-200": 150,
    "200+": 250,
  };
  for (const [bucket, count] of Object.entries(counts)) {
    const mid = midpoints[bucket] ?? 50;
    totalItems += count;
    weightedSum += mid * count;
  }
  return totalItems > 0 ? weightedSum / totalItems : 0;
}

export function resetAllStatistics(): void {
  Application.setState(undefined, STATS_INSTALL_DATE_KEY);
  Application.setState(undefined, STATS_DISPLAYED_MANGA_KEY);
  Application.setState(undefined, STATS_DISPLAYED_DISTINCT_KEY);
  Application.setState(undefined, STATS_DISPLAYED_TOTAL_DISTINCT_KEY);
  Application.setState(undefined, STATS_DISPLAYED_IDS_KEY);
  Application.setState(undefined, STATS_SESSIONS_KEY);
  Application.setState(undefined, STATS_PAGE_COUNTS_KEY);
  Application.setState(undefined, STATS_TAG_COUNTS_KEY);
  Application.setState(undefined, STATS_TOTAL_READ_KEY);
  Application.setState(undefined, STATS_DATA_RECEIVED_KEY);
  Application.setState(undefined, STATS_DATA_RECEIVED_DAILY_KEY);
  Application.setState(undefined, STATS_READ_COUNT_MAP_KEY);
  Application.setState(undefined, STATS_REREAD_TIMESTAMPS_KEY);
  Application.setState(undefined, STATS_SCREEN_TIME_KEY);
  Application.setState(undefined, STATS_STREAK_GRACE_KEY);
  Application.setState(undefined, SCREEN_TIME_MODE_KEY);
  Application.setState(undefined, SCREEN_TIME_WEEK_OFFSET_KEY);
  Application.setState(undefined, TAG_DISPLAY_LIMIT_KEY);
  Application.setState(undefined, REREAD_DISPLAY_LIMIT_KEY);
}

export interface StatCategory {
  id: string;
  title: string;
  keys: string[];
}

export const STAT_CATEGORIES: StatCategory[] = [
  {
    id: "tracking_since",
    title: "Tracking Since",
    keys: [STATS_INSTALL_DATE_KEY],
  },
  {
    id: "manga_displayed",
    title: "Manga Displayed",
    keys: [STATS_DISPLAYED_MANGA_KEY],
  },
  {
    id: "distinct_displayed",
    title: "Distinct Manga Displayed",
    keys: [STATS_DISPLAYED_DISTINCT_KEY, STATS_DISPLAYED_IDS_KEY],
  },
  {
    id: "total_read",
    title: "Total Manga Read",
    keys: [STATS_TOTAL_READ_KEY, STATS_MARK_READ_ON_DESC_COUNT_KEY],
  },
  {
    id: "total_reread",
    title: "Total Manga Reread",
    keys: [STATS_READ_COUNT_MAP_KEY, STATS_REREAD_TIMESTAMPS_KEY],
  },
  {
    id: "total_times_reread",
    title: "Total Times You Reread",
    keys: [STATS_REREAD_TIMESTAMPS_KEY],
  },
  { id: "avg_per_day", title: "Avg Manga Read Per Day", keys: [] },
  {
    id: "current_streak",
    title: "Current Streak",
    keys: [STATS_SESSIONS_KEY, STATS_STREAK_GRACE_KEY],
  },
  {
    id: "longest_streak",
    title: "Longest Streak",
    keys: [STATS_SESSIONS_KEY, STATS_STREAK_GRACE_KEY],
  },
  {
    id: "data_received",
    title: "Data Received",
    keys: [STATS_DATA_RECEIVED_KEY, STATS_DATA_RECEIVED_DAILY_KEY],
  },
  {
    id: "screen_time",
    title: "Total Screen Time",
    keys: [STATS_SCREEN_TIME_KEY, SCREEN_TIME_MODE_KEY],
  },
  {
    id: "page_distribution",
    title: "Page Count Distribution",
    keys: [STATS_PAGE_COUNTS_KEY],
  },
  {
    id: "tag_counts",
    title: "Top 75 Tags",
    keys: [STATS_TAG_COUNTS_KEY, TAG_DISPLAY_LIMIT_KEY],
  },
  {
    id: "top_rereads",
    title: "Top 75 Rereads",
    keys: [STATS_READ_COUNT_MAP_KEY, REREAD_DISPLAY_LIMIT_KEY],
  },
  {
    id: "screen_time_graphs",
    title: "Screen Time Graphs",
    keys: [STATS_SCREEN_TIME_KEY],
  },
];

export function resetSpecificStats(categoryIds: string[]): void {
  for (const catId of categoryIds) {
    const cat = STAT_CATEGORIES.find((c) => c.id === catId);
    if (cat) {
      for (const key of cat.keys) {
        // Use 0 for numeric counters so getTotalMangaRead() doesn't fallback to history
        if (
          key === STATS_TOTAL_READ_KEY ||
          key === STATS_DISPLAYED_MANGA_KEY ||
          key === STATS_DISPLAYED_DISTINCT_KEY
        ) {
          Application.setState(0, key);
        } else {
          Application.setState(undefined, key);
        }
      }
    }
  }
}

export function removeSpecificTags(tagNames: string[]): void {
  const counts = getTagCounts();
  for (const name of tagNames) {
    delete counts[name];
  }
  Application.setState(counts, STATS_TAG_COUNTS_KEY);
}

export function removeSpecificRereads(mangaIds: string[]): void {
  const map = getReadCountMap();
  for (const id of mangaIds) {
    delete map[id];
  }
  persistReadCountMap(map);
}

// -- Discover Section Order --

export interface DiscoverSectionDef {
  id: string;
  title: string;
  subtitle?: string;
}

export const ALL_DISCOVER_SECTIONS: DiscoverSectionDef[] = [
  { id: "date_added", title: "Date Added" },
  { id: "popular_today", title: "Popular Today" },
  { id: "popular_week", title: "Popular This Week" },
  { id: "popular_month", title: "Popular This Month" },
  {
    id: "last_read",
    title: "Last Read",
    subtitle: "Shows Your Read Manga From Latest To Oldest",
  },
  {
    id: "related",
    title: "Related",
    subtitle: "Shows All Your Read Manga, Each With 5 Similar Manga",
  },
  {
    id: "top_reread",
    title: "Top Reread",
    subtitle: "Shows Your Top Reread Manga From Most To Least Read",
  },
  { id: "date_published", title: "Date Published" },
  { id: "random", title: "Random" },
  { id: "popular_year", title: "Popular This Year" },
];

export const DEFAULT_SECTION_ORDER = ALL_DISCOVER_SECTIONS.map((s) => s.id);

function ensureDiscoverSectionOrderingReset(): void {
  const hasReset = Application.getState(
    DISCOVER_SECTION_ORDER_RESET_FLAG_KEY,
  ) as boolean | undefined;
  if (hasReset) return;

  for (const key of LEGACY_DISCOVER_SECTION_ORDER_KEYS) {
    Application.setState(undefined, key);
  }
  for (const key of LEGACY_DISCOVER_SECTION_HIDDEN_KEYS) {
    Application.setState(undefined, key);
  }
  Application.setState(true, DISCOVER_SECTION_ORDER_RESET_FLAG_KEY);
}

export function getDiscoverSectionOrder(): string[] {
  ensureDiscoverSectionOrderingReset();
  const stored = Application.getState(DISCOVER_SECTION_ORDER_KEY) as
    | string[]
    | undefined;
  if (!Array.isArray(stored) || stored.length === 0)
    return [...DEFAULT_SECTION_ORDER];
  const knownIds = new Set(ALL_DISCOVER_SECTIONS.map((s) => s.id));
  const valid = stored.filter((id) => knownIds.has(id));
  for (const def of ALL_DISCOVER_SECTIONS) {
    if (!valid.includes(def.id)) valid.push(def.id);
  }
  return valid;
}

export function setDiscoverSectionOrder(order: string[]): void {
  Application.setState(order, DISCOVER_SECTION_ORDER_KEY);
}

export function getHiddenSections(): Set<string> {
  ensureDiscoverSectionOrderingReset();
  const stored = Application.getState(DISCOVER_SECTION_HIDDEN_KEY) as
    | string[]
    | undefined;
  return new Set(Array.isArray(stored) ? stored : []);
}

export function setHiddenSections(hidden: Set<string>): void {
  Application.setState([...hidden], DISCOVER_SECTION_HIDDEN_KEY);
}
