export interface LanguageOption {
  id: string;
  label: string;
  abbreviation: string;
  token?: string;
  slugs: string[];
}

export interface SortOption {
  id: string;
  label: string;
}

const LANGUAGE_STATE_KEY = "nhentai.settings.language";
const EXTRA_ARGUMENTS_STATE_KEY = "nhentai.settings.extraArguments";
const INCLUDE_TAGS_STATE_KEY = "nhentai.settings.includeTags";
const EXCLUDE_TAGS_STATE_KEY = "nhentai.settings.excludeTags";
const HIDE_READ_STATE_KEY = "nhentai.settings.hideRead";
const DATE_FORMAT_STATE_KEY = "nhentai.settings.dateFormat";
const DATE_SEPARATOR_STATE_KEY = "nhentai.settings.dateSeparator";
const DISPLAY_OPTIONS_STATE_KEY = "nhentai.settings.displayOptions";
const ENABLE_RELATED_STATE_KEY = "nhentai.settings.enableRelated";
const RELATED_LANGUAGE_STATE_KEY = "nhentai.settings.relatedLanguage";
const PAGES_EXPR_STATE_KEY = "nhentai.settings.pagesExpr";
const THUMBNAIL_QUALITY_STATE_KEY = "nhentai.settings.thumbQuality";
const INCOGNITO_STATE_KEY = "nhentai.settings.incognitoMode";
const REMOVE_SEPARATOR_SPACES_STATE_KEY =
  "nhentai.settings.removeSeparatorSpaces";
const DATE_DAYS_STATE_KEY = "nhentai.settings.daysOldFilter";
const DATE_MIN_DAYS_STATE_KEY = "nhentai.settings.dateMinDays";
const DATE_MAX_DAYS_STATE_KEY = "nhentai.settings.dateMaxDays";
const FAVORITES_THRESHOLD_STATE_KEY = "nhentai.settings.favoritesThreshold";
const FAVORITES_THRESHOLD_MAX_STATE_KEY =
  "nhentai.settings.favoritesThresholdMax";

const MARK_READ_ON_VIEW_STATE_KEY = "nhentai.settings.markReadOnView";
const DESC_MARKED_READ_IDS_KEY = "nhentai.descMarkedReadIds";
const HIDE_READ_IN_RELATED_STATE_KEY = "nhentai.settings.hideReadInRelated";
const ENABLE_REREAD_SECTION_KEY = "nhentai.settings.enableRereadSection";
const STRICT_FAVORITES_FILTER_KEY = "nhentai.settings.strictFavoritesFilter";
const DISCOVER_SECTION_ORDER_KEY = "nhentai.settings.discoverSectionOrder";
const DISCOVER_SECTION_HIDDEN_KEY = "nhentai.settings.discoverSectionHidden";

// Search filter persistence keys
const SEARCH_FILTER_LENGTH_KEY = "nhentai.searchFilter.length";
const SEARCH_FILTER_FAVORITES_KEY = "nhentai.searchFilter.favorites";
const SEARCH_FILTER_DATE_KEY = "nhentai.searchFilter.date";
const SEARCH_FILTER_TAGS_KEY = "nhentai.searchFilter.tags";
const SEARCH_FILTER_USER_TAGS_KEY = "nhentai.searchFilter.userTags";
const SEARCH_FILTER_RELATED_LANGUAGE_KEY =
  "nhentai.searchFilter.relatedLanguage";
const SEARCH_FILTER_MANGA_SYNCED_TAGS_KEY =
  "nhentai.searchFilter.mangaSyncedTags";
const SEARCH_FILTER_TAG_CLEANUP_KEY = "nhentai.searchFilter.tagCleanupVersion";
const SEARCH_FILTER_TAG_CLEANUP_VERSION = 1; // Bump to force orphan cleanup

// Statistics keys
const STATS_INSTALL_DATE_KEY = "nhentai.stats.installDate";
const STATS_DISPLAYED_MANGA_KEY = "nhentai.stats.displayedManga";
const STATS_DISPLAYED_DISTINCT_KEY = "nhentai.stats.displayedDistinct";
const STATS_DISPLAYED_IDS_KEY = "nhentai.stats.displayedIds";
const STATS_SESSIONS_KEY = "nhentai.stats.sessions";
const STATS_PAGE_COUNTS_KEY = "nhentai.stats.pageCounts";
const STATS_TAG_COUNTS_KEY = "nhentai.stats.tagCounts";
const STATS_TOTAL_READ_KEY = "nhentai.stats.totalRead";
const STATS_DATA_RECEIVED_KEY = "nhentai.stats.dataReceived";
const STATS_READ_COUNT_MAP_KEY = "nhentai.stats.readCounts";
const STATS_SCREEN_TIME_KEY = "nhentai.stats.screenTime";
const STATS_SCREEN_TIME_ENABLED_KEY = "nhentai.stats.screenTimeEnabled";
const STATS_STREAK_GRACE_KEY = "nhentai.stats.streakGrace";
const STATS_MARK_READ_ON_DESC_COUNT_KEY = "nhentai.stats.markReadOnDescCount";

type ReadCountEntry = { count: number; title?: string; tags?: string[] };
type ReadCountMap = Record<string, ReadCountEntry>;
type ScreenTimeMap = Record<string, number>; // YYYY-MM-DD -> minutes

export const DEFAULT_LANGUAGE = "english";
export const DEFAULT_EXTRA_ARGUMENTS = "";
export const DEFAULT_INCLUDE_TAGS = "";
export const DEFAULT_EXCLUDE_TAGS = "";
export const DEFAULT_HIDE_READ = true;
export const DEFAULT_PAGES_EXPR = "";

export const DEFAULT_MARK_READ_ON_VIEW = false;
export const DEFAULT_DATE_FORMAT = "m_d_yy" as const;
export const DEFAULT_DISPLAY_OPTIONS: DisplayOptionId[] = [
  "hide_read_letter", // Now means "Show Read Indicator" when present - ON by default
  "show_page_count",
  "abbreviate_favorites", // Show favorites as 1.5k format (when shown)
  // "show_favorite_count" - OFF by default to reduce API calls (skips hydration)
  "desc_show_date", // Show full date in description - ON by default
  "desc_relative_date", // Show relative date in description - ON by default
  "parodies_bottom", // List parodies/characters in description - ON by default
  "show_id",
  "show_tags_in_desc",
  "show_lang_desc",
  "show_related_order", // Show [Read], [1], etc. in related manga subtitle - ON by default
  "show_tag_counts",
];

export const SORT_PREFERRED_ORDER: SortOption[] = [
  { id: "date", label: "Date Added" },
  { id: "popular-today", label: "Popular This Day" },
  { id: "popular-week", label: "Popular This Week" },
  { id: "popular-month", label: "Popular This Month" },
  { id: "popular", label: "Popular All-Time" },
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

export const DEFAULT_ENABLE_RELATED = true;
export const DEFAULT_RELATED_LANGUAGE = "all";
export const DEFAULT_INCOGNITO = false;
export const DEFAULT_REMOVE_SEPARATOR_SPACES = false;
export const DEFAULT_HIDE_READ_IN_RELATED = false;

export type DateFormatId =
  | "mm_dd_yy"
  | "m_d_yy"
  | "yyyy_mm_dd"
  | "dd_mm_yyyy"
  | "mm_yy"
  | "yy_mm"
  | "m_yy"
  | "yy_m";
export type DateSeparatorId = "period" | "dash" | "slash" | "comma" | "space";
export type DisplayOptionId =
  | "hide_read"
  | "hide_read_letter"
  | "show_lang_tip"
  | "show_lang_desc"
  | "show_page_count"
  | "show_favorite_count"
  | "abbreviate_favorites"
  | "subtitle_date"
  | "subtitle_relative"
  | "desc_show_date"
  | "desc_relative_date"
  | "parodies_bottom"
  | "show_id"
  | "show_tags_in_desc"
  | "show_related_order"
  | "show_tag_counts"
  | "show_reread_count";

export type NHentaiSearchSortId =
  | "date"
  | "popular-today"
  | "popular-week"
  | "popular-month"
  | "popular"
  | "related"
  | "last_read"
  | "top_reread";

export const DEFAULT_THUMB_QUALITY = "high" as const;
export const DEFAULT_DATE_MIN_DAYS: number | undefined = undefined;
export const DEFAULT_DATE_MAX_DAYS: number | undefined = undefined;
export const DEFAULT_FAVORITES_THRESHOLD: number | undefined = undefined;
export const DEFAULT_DATE_SEPARATOR = "period" as const;

export type ThumbnailQuality = "low" | "normal" | "high";

export const THUMBNAIL_QUALITY_OPTIONS: {
  id: ThumbnailQuality;
  label: string;
}[] = [
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
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

export const DATE_FORMAT_OPTIONS: { id: DateFormatId; label: string }[] = [
  { id: "mm_dd_yy", label: "01.20.26 - MM.DD.YY" },
  { id: "dd_mm_yyyy", label: "20.01.2026 - DD.MM.YYYY" },
  { id: "yyyy_mm_dd", label: "2026.01.20 - YYYY.MM.DD" },
  { id: "m_d_yy", label: "1.20.26 - M.D.YY" },
  { id: "mm_yy", label: "01.26 - MM.YY" },
  { id: "yy_mm", label: "26.01 - YY.MM" },
  { id: "m_yy", label: "1.26 - M.YY" },
  { id: "yy_m", label: "26.1 - YY.M" },
];

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

export const DISPLAY_OPTION_VALUES: { id: DisplayOptionId; label: string }[] = [
  { id: "hide_read_letter", label: "Hide 'r' Read Indicator" },
  { id: "show_lang_tip", label: "Show Language in Subtitle" },
  { id: "show_lang_desc", label: "Show Language in Description" },
  { id: "show_page_count", label: "Show Page Count" },
  { id: "show_favorite_count", label: "Show Favorite Count" },
  { id: "abbreviate_favorites", label: "Abbreviate Favorites (k)" },
  { id: "subtitle_date", label: "Show Date in Subtitle" },
  { id: "subtitle_relative", label: "Show Relative Date in Subtitle" },
  { id: "desc_show_date", label: "Show Date in Description" },
  { id: "desc_relative_date", label: "Show Relative Date in Description" },
  { id: "parodies_bottom", label: "List Parodies/Characters at Bottom" },
  { id: "show_id", label: "Show 6-digit ID in Description" },
  { id: "show_tags_in_desc", label: "Show Tags in Description" },
  { id: "show_related_order", label: "Show Related Order ([1], [2], etc.)" },
  { id: "show_tag_counts", label: "Show Tag Counts" },
  { id: "show_reread_count", label: "Show Reread Count Everywhere" },
];

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    id: "all",
    label: "All Languages",
    abbreviation: "ALL",
    token: undefined,
    slugs: [],
  },
  {
    id: "english",
    label: "English",
    abbreviation: "EN",
    token: "english",
    slugs: ["english"],
  },
  {
    id: "japanese",
    label: "Japanese",
    abbreviation: "JP",
    token: "japanese",
    slugs: ["japanese"],
  },
  {
    id: "chinese",
    label: "Chinese",
    abbreviation: "CN",
    token: "chinese",
    slugs: ["chinese"],
  },
];

export function getLanguageSetting(): string[] {
  const value = Application.getState(LANGUAGE_STATE_KEY);
  // Handle migration from string to string[]
  if (Array.isArray(value)) {
    const languages = value.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
    return languages.length > 0 ? languages : [DEFAULT_LANGUAGE];
  }
  if (typeof value === "string") {
    return [value];
  }
  return [DEFAULT_LANGUAGE];
}

export function setLanguageSetting(value: string | string[]): void {
  const arr = Array.isArray(value) ? value : [value];
  Application.setState(
    arr.length > 0 ? arr : [DEFAULT_LANGUAGE],
    LANGUAGE_STATE_KEY,
  );
}

export function getLanguageToken(
  languageSetting?: string | string[],
): string | undefined {
  const settings = languageSetting
    ? Array.isArray(languageSetting)
      ? languageSetting
      : [languageSetting]
    : getLanguageSetting();
  // If "all" is selected or multiple languages, no single token
  if (settings.includes("all") || settings.length !== 1) return undefined;
  return LANGUAGE_OPTIONS.find((option) => option.id === settings[0])?.token;
}

export function getLanguageAbbreviationFromSlug(
  slug: string | undefined,
): string {
  if (!slug) {
    return "UNK";
  }
  const match = LANGUAGE_OPTIONS.find((option) => option.slugs.includes(slug));
  if (match) {
    return match.abbreviation;
  }
  return slug.slice(0, Math.min(3, slug.length)).toUpperCase();
}

export function getLanguageDisplayNameFromSlug(
  slug: string | undefined,
): string {
  if (!slug) {
    return "Unknown";
  }
  const match = LANGUAGE_OPTIONS.find((option) => option.slugs.includes(slug));
  if (match) {
    return match.label;
  }
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function getExtraArgumentsSetting(): string {
  const includeRaw = getIncludeTagsSetting();
  const excludeRaw = getExcludeTagsSetting();

  // Once split inputs have been initialised, they become the source of truth.
  if (hasSplitTagSettingsState()) {
    return buildTagArguments(includeRaw, excludeRaw);
  }

  // Fall back to legacy combined input
  return (
    (Application.getState(EXTRA_ARGUMENTS_STATE_KEY) as string | undefined) ??
    DEFAULT_EXTRA_ARGUMENTS
  );
}

export function setExtraArgumentsSetting(value: string): void {
  // Replace smart quotes with regular quotes to ensure API compatibility and prevent injection issues.
  let sanitized = value
    .replace(/['\u2018\u2019]/g, "'")
    .replace(/["\u201C\u201D]/g, '"');

  // Auto-quote multi-word tags that aren't already quoted
  // This helps users who type "-big breasts" instead of "-\"big breasts\""
  // Match patterns like: -word word or word word (not already quoted)
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

  Application.setState(sanitized, EXTRA_ARGUMENTS_STATE_KEY);

  // Keep split inputs in sync for users upgrading from legacy single-field UI
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

  // Migrate from legacy combined arguments by extracting non-negative tokens
  const legacy = Application.getState(EXTRA_ARGUMENTS_STATE_KEY) as
    | string
    | undefined;
  if (legacy) {
    const { include } = splitLegacyExtraArgs(legacy);
    Application.setState(include, INCLUDE_TAGS_STATE_KEY);
    return include;
  }

  return DEFAULT_INCLUDE_TAGS;
}

export function setIncludeTagsSetting(value: string): void {
  const sanitized = sanitizeTagList(value, { exclude: false }).raw;
  Application.setState(sanitized, INCLUDE_TAGS_STATE_KEY);
  Application.setState(
    buildTagArguments(sanitized, getExcludeTagsSetting()),
    EXTRA_ARGUMENTS_STATE_KEY,
  );
  syncMangaFilterTagsToSearchFilterTags();
}

export function getExcludeTagsSetting(): string {
  const stored = Application.getState(EXCLUDE_TAGS_STATE_KEY) as
    | string
    | undefined;
  if (typeof stored === "string") return stored;

  const legacy = Application.getState(EXTRA_ARGUMENTS_STATE_KEY) as
    | string
    | undefined;
  if (legacy) {
    const { exclude } = splitLegacyExtraArgs(legacy);
    Application.setState(exclude, EXCLUDE_TAGS_STATE_KEY);
    return exclude;
  }

  return DEFAULT_EXCLUDE_TAGS;
}

export function setExcludeTagsSetting(value: string): void {
  const sanitized = sanitizeTagList(value, { exclude: true }).raw;
  Application.setState(sanitized, EXCLUDE_TAGS_STATE_KEY);
  Application.setState(
    buildTagArguments(getIncludeTagsSetting(), sanitized),
    EXTRA_ARGUMENTS_STATE_KEY,
  );
  syncMangaFilterTagsToSearchFilterTags();
}

function syncMangaFilterTagsToSearchFilterTags(): void {
  const syncedTags = buildMangaSyncedSearchFilterTags();
  const userTags = stripSyncedSearchFilterTags(
    getUserSearchFilterTags(),
    syncedTags,
  );
  persistMergedSearchFilterTags(userTags, syncedTags);
}

export function getHideReadSetting(): boolean {
  const stored = Application.getState(HIDE_READ_STATE_KEY) as
    | boolean
    | undefined;
  return typeof stored === "boolean" ? stored : DEFAULT_HIDE_READ;
}

export function setHideReadSetting(value: boolean): void {
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

function getStoredStringState(key: string, fallback: string): string {
  const value = Application.getState(key);
  if (typeof value === "string") return value;
  if (value !== undefined && value !== null) {
    Application.setState(fallback, key);
  }
  return fallback;
}

// Search filter persistence getters/setters
export function getSearchFilterLength(): string {
  return getStoredStringState(SEARCH_FILTER_LENGTH_KEY, "all");
}

export function setSearchFilterLength(value: string): void {
  Application.setState(value, SEARCH_FILTER_LENGTH_KEY);
}

export function getSearchFilterFavorites(): string {
  return getStoredStringState(SEARCH_FILTER_FAVORITES_KEY, "all");
}

export function setSearchFilterFavorites(value: string): void {
  Application.setState(value, SEARCH_FILTER_FAVORITES_KEY);
}

export function getSearchFilterDate(): string {
  return getStoredStringState(SEARCH_FILTER_DATE_KEY, "all");
}

export function setSearchFilterDate(value: string): void {
  Application.setState(value, SEARCH_FILTER_DATE_KEY);
}

export function getSearchFilterTags(): Record<string, "included" | "excluded"> {
  const userTags = getUserSearchFilterTags();
  const syncedTags = buildMangaSyncedSearchFilterTags();
  const merged = {
    ...userTags,
    ...syncedTags,
  };
  persistMergedSearchFilterTags(userTags, syncedTags);
  return merged;
}

export function setSearchFilterTags(
  value: Record<string, "included" | "excluded">,
): void {
  const syncedTags = buildMangaSyncedSearchFilterTags();
  const userTags = stripSyncedSearchFilterTags(value, syncedTags);
  persistMergedSearchFilterTags(userTags, syncedTags);
}

export function resetNHentaiSettings(): void {
  // User-configurable settings — reset to defaults and immediately persist
  // the default value so the UI reflects the reset without requiring restart.
  Application.setState([DEFAULT_LANGUAGE], LANGUAGE_STATE_KEY);
  Application.setState(DEFAULT_EXTRA_ARGUMENTS, EXTRA_ARGUMENTS_STATE_KEY);
  Application.setState(DEFAULT_INCLUDE_TAGS, INCLUDE_TAGS_STATE_KEY);
  Application.setState(DEFAULT_EXCLUDE_TAGS, EXCLUDE_TAGS_STATE_KEY);
  Application.setState(DEFAULT_HIDE_READ, HIDE_READ_STATE_KEY);
  Application.setState(DEFAULT_DATE_FORMAT, DATE_FORMAT_STATE_KEY);
  Application.setState(DEFAULT_DATE_SEPARATOR, DATE_SEPARATOR_STATE_KEY);
  Application.setState([...DEFAULT_DISPLAY_OPTIONS], DISPLAY_OPTIONS_STATE_KEY);
  Application.setState(DEFAULT_ENABLE_RELATED, ENABLE_RELATED_STATE_KEY);
  Application.setState(DEFAULT_RELATED_LANGUAGE, RELATED_LANGUAGE_STATE_KEY);
  Application.setState(DEFAULT_THUMB_QUALITY, THUMBNAIL_QUALITY_STATE_KEY);
  Application.setState(DEFAULT_INCOGNITO, INCOGNITO_STATE_KEY);
  Application.setState(
    DEFAULT_FAVORITES_THRESHOLD ?? null,
    FAVORITES_THRESHOLD_STATE_KEY,
  );
  Application.setState(null, FAVORITES_THRESHOLD_MAX_STATE_KEY);
  Application.setState(DEFAULT_PAGES_EXPR, PAGES_EXPR_STATE_KEY);
  Application.setState(
    DEFAULT_REMOVE_SEPARATOR_SPACES,
    REMOVE_SEPARATOR_SPACES_STATE_KEY,
  );
  Application.setState(DEFAULT_MARK_READ_ON_VIEW, MARK_READ_ON_VIEW_STATE_KEY);
  Application.setState({}, DATE_DAYS_STATE_KEY);
  Application.setState(DEFAULT_DATE_MIN_DAYS ?? null, DATE_MIN_DAYS_STATE_KEY);
  Application.setState(DEFAULT_DATE_MAX_DAYS ?? null, DATE_MAX_DAYS_STATE_KEY);
  Application.setState(
    DEFAULT_HIDE_READ_IN_RELATED,
    HIDE_READ_IN_RELATED_STATE_KEY,
  );
  Application.setState(true, ENABLE_REREAD_SECTION_KEY);
  Application.setState(false, STRICT_FAVORITES_FILTER_KEY);
  // Discover section order & visibility
  Application.setState([...DEFAULT_SECTION_ORDER], DISCOVER_SECTION_ORDER_KEY);
  Application.setState(
    [...DEFAULT_HIDDEN_SECTIONS],
    DISCOVER_SECTION_HIDDEN_KEY,
  );
  // Search filter persistence
  Application.setState("all", SEARCH_FILTER_LENGTH_KEY);
  Application.setState("all", SEARCH_FILTER_FAVORITES_KEY);
  Application.setState("all", SEARCH_FILTER_DATE_KEY);
  Application.setState({}, SEARCH_FILTER_TAGS_KEY);
  Application.setState({}, SEARCH_FILTER_USER_TAGS_KEY);
  Application.setState(
    DEFAULT_RELATED_LANGUAGE,
    SEARCH_FILTER_RELATED_LANGUAGE_KEY,
  );
  Application.setState([], SEARCH_FILTER_MANGA_SYNCED_TAGS_KEY);
  // NOTE: Statistics keys are NEVER reset here — use resetAllStatistics() instead
}

export const SORT_OPTIONS: SortOption[] = [
  { id: "date", label: "Date Added" },
  { id: "popular-today", label: "Popular This Day" },
  { id: "popular-week", label: "Popular This Week" },
  { id: "popular-month", label: "Popular This Month" },
  { id: "popular", label: "Popular All-Time" },
  { id: "related", label: "Related" },
  { id: "last_read", label: "Last Read" },
  { id: "top_reread", label: "Top Reread" },
];

// Maps discover section IDs to sort option IDs
export const DISCOVER_TO_SORT_MAP: Record<string, NHentaiSearchSortId> = {
  new_uploads: "date",
  popular_today: "popular-today",
  popular_week: "popular-week",
  popular_month: "popular-month",
  popular_all: "popular",
  related: "related",
  last_read: "last_read",
  top_reread: "top_reread",
};

export function getDefaultSearchSortSetting(): NHentaiSearchSortId {
  const valid = new Set<NHentaiSearchSortId>([
    "date",
    "popular-today",
    "popular-week",
    "popular-month",
    "popular",
    "related",
    "last_read",
    "top_reread",
  ]);
  const order = getDiscoverSectionOrder();
  const hidden = getHiddenSections();
  const discoverToSort = (id: string): NHentaiSearchSortId | undefined =>
    DISCOVER_TO_SORT_MAP[id];
  const firstVisibleSort = order
    .filter((id) => !hidden.has(id))
    .map(discoverToSort)
    .find((s) => s && valid.has(s));
  if (firstVisibleSort) return firstVisibleSort;
  return "date";
}

export function getDateFormatSetting(): DateFormatId {
  const value = Application.getState(DATE_FORMAT_STATE_KEY) as
    | DateFormatId
    | undefined;
  if (value && DATE_FORMAT_OPTIONS.find((opt) => opt.id === value))
    return value;
  return DEFAULT_DATE_FORMAT;
}

export function setDateFormatSetting(value: DateFormatId): void {
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

export function setDateSeparatorSetting(value: DateSeparatorId): void {
  Application.setState(value, DATE_SEPARATOR_STATE_KEY);
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
  }
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const yy = y.toString().slice(-2);
  const dd = d.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const yyyy = y.toString();
  return format
    .replace(/yyyy/g, yyyy)
    .replace(/yy/g, yy)
    .replace(/mm/g, mm)
    .replace(/dd/g, dd)
    .replace(/\bm\b/g, m.toString())
    .replace(/\bd\b/g, d.toString());
}

export function getDisplayOptionsSetting(): DisplayOptionId[] {
  const value = Application.getState(DISPLAY_OPTIONS_STATE_KEY) as
    | DisplayOptionId[]
    | undefined;

  // Return defaults only if nothing was ever stored
  if (!Array.isArray(value)) return DEFAULT_DISPLAY_OPTIONS;

  // Filter out any invalid options that may have been saved from old versions
  const validIds = new Set(DISPLAY_OPTION_VALUES.map((opt) => opt.id));
  const filtered = value.filter((id) => validIds.has(id));

  // Return the filtered array as-is (even if empty - user choice)
  return filtered;
}

export function setDisplayOptionsSetting(value: DisplayOptionId[]): void {
  Application.setState(value, DISPLAY_OPTIONS_STATE_KEY);
}

export function getAddTagsToDescriptionSetting(): boolean {
  return getDisplayOptionsSetting().includes("show_tags_in_desc");
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

export function getThumbnailQualitySetting(): ThumbnailQuality {
  const stored = Application.getState(THUMBNAIL_QUALITY_STATE_KEY) as
    | string
    | undefined;

  // Validate stored value
  if (stored === "low" || stored === "normal" || stored === "high") {
    return stored as ThumbnailQuality;
  }

  return DEFAULT_THUMB_QUALITY;
}

export function setThumbnailQualitySetting(value: ThumbnailQuality): void {
  Application.setState(value, THUMBNAIL_QUALITY_STATE_KEY);
}

export function getPagesExpressionSetting(): string {
  return (
    (Application.getState(PAGES_EXPR_STATE_KEY) as string | undefined) ??
    DEFAULT_PAGES_EXPR
  );
}

export function sanitizePagesExpressionInput(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return DEFAULT_PAGES_EXPR;
  const parsed = parsePagesExpression(trimmed);
  return Object.keys(parsed).length > 0 ? trimmed : DEFAULT_PAGES_EXPR;
}

export function setPagesExpressionSetting(value: string): void {
  Application.setState(
    sanitizePagesExpressionInput(value),
    PAGES_EXPR_STATE_KEY,
  );
}

export interface DaysOldRange {
  // oldest = number of days (e.g., 365 means older than 365 days)
  oldest?: number;
  // newest = number of days (e.g., 30 means newer than 30 days)
  newest?: number;
}

/**
 * Unified getter for Days Old filter setting.
 * - Stores/returns an object: { oldest?: number; newest?: number }
 * - Performs non-destructive migration from legacy min/max keys.
 */
export function getDaysOldFilterSetting(): DaysOldRange {
  try {
    const stored = Application.getState(DATE_DAYS_STATE_KEY) as
      | (DaysOldRange & Record<string, unknown>)
      | undefined;

    if (stored && typeof stored === "object") {
      let oldest =
        typeof stored.oldest === "number" ? stored.oldest : undefined;
      let newest =
        typeof stored.newest === "number" ? stored.newest : undefined;
      if (oldest !== undefined && newest !== undefined && oldest > newest) {
        [oldest, newest] = [newest, oldest];
      }
      const cleaned = { oldest, newest };
      // Persist cleaned values to guard against malformed states
      Application.setState(cleaned, DATE_DAYS_STATE_KEY);
      return cleaned;
    }
  } catch {
    // Reset malformed state to empty filter
    Application.setState({}, DATE_DAYS_STATE_KEY);
    return {};
  }

  // Migrate from legacy min/max keys if no new format exists
  const legacyOldest = Application.getState(DATE_MIN_DAYS_STATE_KEY);
  const legacyNewest = Application.getState(DATE_MAX_DAYS_STATE_KEY);
  if (typeof legacyOldest === "number" || typeof legacyNewest === "number") {
    let oldest =
      typeof legacyOldest === "number" ? legacyOldest : undefined;
    let newest =
      typeof legacyNewest === "number" ? legacyNewest : undefined;
    if (oldest !== undefined && newest !== undefined && oldest > newest) {
      [oldest, newest] = [newest, oldest];
    }
    const migrated = { oldest, newest };
    Application.setState(migrated, DATE_DAYS_STATE_KEY);
    return migrated;
  }

  return {};
}

export function setDaysOldFilterSetting(value: DaysOldRange): void {
  Application.setState(value, DATE_DAYS_STATE_KEY);
  // Do not delete legacy keys automatically to avoid accidental data loss.
}

// Backwards-compatible wrappers (deprecated)
export function getDateMinDaysSetting(): number | undefined {
  return getDaysOldFilterSetting().oldest;
}

export function setDateMinDaysSetting(value: number | undefined): void {
  const cur = getDaysOldFilterSetting();
  setDaysOldFilterSetting({ ...cur, oldest: value });
}

export function getDateMaxDaysSetting(): number | undefined {
  return getDaysOldFilterSetting().newest;
}

export function setDateMaxDaysSetting(value: number | undefined): void {
  const cur = getDaysOldFilterSetting();
  setDaysOldFilterSetting({ ...cur, newest: value });
}

export function getFavoritesThresholdSetting(): number | undefined {
  try {
    const v = Application.getState(FAVORITES_THRESHOLD_STATE_KEY);
    if (typeof v === "number") return v;

    // Clean up any legacy or malformed values to avoid decode errors
    if (v !== undefined && v !== null) {
      Application.setState(null, FAVORITES_THRESHOLD_STATE_KEY);
    }
  } catch {
    // If the stored blob is malformed, reset it to a safe default
    Application.setState(null, FAVORITES_THRESHOLD_STATE_KEY);
  }

  return DEFAULT_FAVORITES_THRESHOLD;
}

export function setFavoritesThresholdSetting(value: number | undefined): void {
  // Avoid storing undefined directly; use null to clear the value safely.
  Application.setState(value ?? null, FAVORITES_THRESHOLD_STATE_KEY);
}

export function getFavoritesThresholdMaxSetting(): number | undefined {
  try {
    const v = Application.getState(FAVORITES_THRESHOLD_MAX_STATE_KEY);
    if (typeof v === "number") return v;
    if (v !== undefined && v !== null) {
      Application.setState(null, FAVORITES_THRESHOLD_MAX_STATE_KEY);
    }
  } catch {
    Application.setState(null, FAVORITES_THRESHOLD_MAX_STATE_KEY);
  }
  return undefined;
}

export function setFavoritesThresholdMaxSetting(
  value: number | undefined,
): void {
  Application.setState(value ?? null, FAVORITES_THRESHOLD_MAX_STATE_KEY);
}

export function getStrictFavoritesFilterSetting(): boolean {
  const value = Application.getState(STRICT_FAVORITES_FILTER_KEY);
  return typeof value === "boolean" ? value : false;
}

export function setStrictFavoritesFilterSetting(value: boolean): void {
  Application.setState(value, STRICT_FAVORITES_FILTER_KEY);
}

export function parsePagesExpression(value: string): {
  min?: number;
  max?: number;
  exact?: number;
} {
  if (!value || value.trim().length === 0) return {};
  const trimmed = value.trim();

  // Handle -5 format as "less than 5 pages" (max 5)
  const negativeMatch = trimmed.match(/^-(\d+)$/);
  if (negativeMatch) {
    const num = Number(negativeMatch[1]);
    if (!Number.isNaN(num)) {
      return { max: num };
    }
  }

  // Normalise common suffix operator variants (20+ = ">=20", 20- = "<=20")
  const suffixMatch = trimmed.match(/^(\d+)\s*([+-])$/);
  if (suffixMatch) {
    const num = Number(suffixMatch[1]);
    if (!Number.isNaN(num)) {
      return suffixMatch[2] === "+" ? { min: num } : { max: num };
    }
  }

  // Exact match with optional '=' prefix
  const exactMatch = trimmed.match(/^=?\s*(\d+)$/);
  if (exactMatch) {
    const exact = Number(exactMatch[1]);
    return { exact, min: exact, max: exact };
  }

  // Range min-max (order-insensitive)
  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    return { min: low, max: high };
  }

  // Advanced range syntax: 99>x>69, 99>=x>=69, 57<x<67, 57<=x<=67
  // These express bounds on x: a>x>b means b < x < a
  const advRangeMatch = trimmed.match(/^(\d+)\s*(>=?)\s*x\s*(>=?)\s*(\d+)$/i);
  if (advRangeMatch) {
    const left = Number(advRangeMatch[1]);
    const leftOp = advRangeMatch[2]; // >= or >
    const rightOp = advRangeMatch[3]; // >= or >
    const right = Number(advRangeMatch[4]);
    if (!Number.isNaN(left) && !Number.isNaN(right)) {
      // a >= x >= b means b <= x <= a
      // a > x > b means b < x < a -> b+1 <= x <= a-1
      const minVal = rightOp === ">" ? right + 1 : right;
      const maxVal = leftOp === ">" ? left - 1 : left;
      return { min: Math.min(minVal, maxVal), max: Math.max(minVal, maxVal) };
    }
  }

  // Alternative advanced range syntax: 57<x<67, 57<=x<=67
  const advRangeMatch2 = trimmed.match(
    /^(\d+)\s*(<[=]?)\s*x\s*(<[=]?)\s*(\d+)$/i,
  );
  if (advRangeMatch2) {
    const left = Number(advRangeMatch2[1]);
    const leftOp = advRangeMatch2[2]; // <= or <
    const rightOp = advRangeMatch2[3]; // <= or <
    const right = Number(advRangeMatch2[4]);
    if (!Number.isNaN(left) && !Number.isNaN(right)) {
      // a < x < b means a < x AND x < b -> a+1 <= x <= b-1
      // a <= x <= b means a <= x AND x <= b
      const minVal = leftOp === "<" ? left + 1 : left;
      const maxVal = rightOp === "<" ? right - 1 : right;
      return { min: Math.min(minVal, maxVal), max: Math.max(minVal, maxVal) };
    }
  }

  // > or < matches (prefix: >5000, >=5000, <5000, <=5000)
  const cmpMatch = trimmed.match(/^(>=|<=|>|<)\s*(\d+)$/);
  if (cmpMatch) {
    const op = cmpMatch[1];
    const num = Number(cmpMatch[2]);
    if (Number.isNaN(num)) return {};
    if (op === ">") return { min: num + 1 };
    if (op === ">=") return { min: num };
    if (op === "<") return { max: num - 1 };
    if (op === "<=") return { max: num };
  }

  // Postfix operator syntax: 5000>, 5000>=, 5000<, 5000<=
  const postfixCmpMatch = trimmed.match(/^(\d+)\s*(>=?|<=?)$/);
  if (postfixCmpMatch) {
    const num = Number(postfixCmpMatch[1]);
    const op = postfixCmpMatch[2];
    if (Number.isNaN(num)) return {};
    // 5000> means "greater than 5000" -> min: 5001
    // 5000>= means "greater than or equal to 5000" -> min: 5000
    // 5000< means "less than 5000" -> max: 4999
    // 5000<= means "less than or equal to 5000" -> max: 5000
    if (op === ">") return { min: num + 1 };
    if (op === ">=") return { min: num };
    if (op === "<") return { max: num - 1 };
    if (op === "<=") return { max: num };
  }

  return {};
}

export function getEnableRelatedSetting(): boolean {
  const value = Application.getState(ENABLE_RELATED_STATE_KEY);
  return typeof value === "boolean" ? value : DEFAULT_ENABLE_RELATED;
}

export function setEnableRelatedSetting(value: boolean): void {
  Application.setState(value, ENABLE_RELATED_STATE_KEY);
}

export function getRelatedLanguageSetting(): string {
  return getStoredStringState(
    RELATED_LANGUAGE_STATE_KEY,
    DEFAULT_RELATED_LANGUAGE,
  );
}

export function setRelatedLanguageSetting(value: string): void {
  Application.setState(
    value ?? DEFAULT_RELATED_LANGUAGE,
    RELATED_LANGUAGE_STATE_KEY,
  );
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

export function getSearchFilterRelatedLanguage(): string {
  return getStoredStringState(SEARCH_FILTER_RELATED_LANGUAGE_KEY, "all");
}

export function setSearchFilterRelatedLanguage(value: string): void {
  Application.setState(value, SEARCH_FILTER_RELATED_LANGUAGE_KEY);
}

function sanitizeTagList(
  raw: string,
  _options: { exclude?: boolean } = {},
): { tokens: string[]; raw: string } {
  void _options;
  const cleaned = raw
    .replace(/['\u2018\u2019]/g, "'")
    .replace(/["\u201C\u201D]/g, '"');

  const parts: string[] = [];
  const seen = new Set<string>();

  for (const clause of cleaned.split(/[,\n]/)) {
    const trimmed = clause.trim();
    if (!trimmed) continue;

    const orParts = trimmed
      .split(/\s*\|\|\s*|\s+OR\s+/i)
      .map((part) => normalizeTagQueryToken(part))
      .filter((part): part is string => part.length > 0);

    if (orParts.length === 0) continue;

    const uniqueOrParts: string[] = [];
    const orSeen = new Set<string>();
    for (const token of orParts) {
      const canonical = canonicalizeQueryToken(token);
      if (orSeen.has(canonical)) continue;
      orSeen.add(canonical);
      uniqueOrParts.push(token);
    }

    const normalized =
      uniqueOrParts.length > 1 ? uniqueOrParts.join(" OR ") : uniqueOrParts[0];
    const canonical = canonicalizeQueryToken(normalized);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    parts.push(normalized);
  }

  return { tokens: parts, raw: parts.join(", ") };
}

export function getSanitizedTagTokens(raw: string): string[] {
  return sanitizeTagList(raw, { exclude: false }).tokens;
}

function buildTagArguments(include: string, exclude: string): string {
  const includeTokens = sanitizeTagList(include, { exclude: false }).tokens;
  const excludeTokens = sanitizeTagList(exclude, { exclude: true }).tokens;

  // Only include non-OR tokens in the base query.
  // OR groups are handled separately via getIncludeOrGroups() + multiple fetches.
  const requiredIncludes = includeTokens.filter((t) => !/\s+OR\s+/i.test(t));

  // For exclude, split OR into separate negated tokens (exclude ALL alternatives)
  const processedExclude = excludeTokens.flatMap((t) => {
    if (/\s+OR\s+/i.test(t)) {
      return t
        .split(/\s+OR\s+/i)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => `-${s}`);
    }
    return [`-${t}`];
  });

  return dedupeQueryTokens([...requiredIncludes, ...processedExclude])
    .join(" ")
    .trim();
}

/**
 * Returns OR groups from include tags for client-side expansion.
 * Each group is an array of tag token alternatives (e.g. ["tag:yuri", "tag:anal"]).
 * NHentai has no native OR — callers must do separate fetches per alternative.
 */
export function getIncludeOrGroups(): string[][] {
  const includeRaw = getIncludeTagsSetting();
  if (!includeRaw.trim()) return [];
  const tokens = sanitizeTagList(includeRaw, { exclude: false }).tokens;
  const groups: string[][] = [];
  for (const token of tokens) {
    if (/\s+OR\s+/i.test(token)) {
      const parts = dedupeQueryTokens(
        token
          .split(/\s+OR\s+/i)
          .map((s) => s.trim())
          .filter(Boolean),
      );
      if (parts.length > 1) groups.push(parts);
    }
  }
  return groups;
}

function hasSplitTagSettingsState(): boolean {
  return (
    Application.getState(INCLUDE_TAGS_STATE_KEY) !== undefined ||
    Application.getState(EXCLUDE_TAGS_STATE_KEY) !== undefined
  );
}

function normalizeTagQueryToken(raw: string): string {
  let normalized = raw
    .replace(/['\u2018\u2019]/g, "'")
    .replace(/["\u201C\u201D]/g, '"')
    .trim()
    .replace(/^[-+]/, "");
  if (!normalized) return "";

  const prefixMatch = normalized.match(/^([a-z]+:)(.+)$/i);
  const prefix = prefixMatch ? prefixMatch[1].toLowerCase() : "tag:";
  normalized = prefixMatch ? prefixMatch[2].trim() : normalized;

  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    normalized = normalized.slice(1, -1).trim();
  }
  normalized = normalized.replace(/\s+/g, " ");
  if (!normalized) return "";

  const shouldQuote = normalized.includes(" ");
  return `${prefix}${shouldQuote ? `"${normalized}"` : normalized}`;
}

function canonicalizeQueryToken(token: string): string {
  return token.replace(/\s+/g, " ").replace(/:\s+/g, ":").trim().toLowerCase();
}

function dedupeQueryTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const token of tokens) {
    const normalized = token.trim();
    if (!normalized) continue;
    const canonical = canonicalizeQueryToken(normalized);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    deduped.push(normalized);
  }
  return deduped;
}

function hasLiteralOrOperator(value: string): boolean {
  return /\|\||\s+OR\s+/i.test(value);
}

function getStoredMangaSyncedTagIds(): string[] {
  const stored = Application.getState(SEARCH_FILTER_MANGA_SYNCED_TAGS_KEY) as
    | string[]
    | undefined;
  if (!Array.isArray(stored)) return [];

  return stored
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && !hasLiteralOrOperator(value));
}

function sanitizeSearchFilterTags(
  value: Record<string, "included" | "excluded"> | undefined,
): Record<string, "included" | "excluded"> {
  const sanitized: Record<string, "included" | "excluded"> = {};
  if (!value || typeof value !== "object") return sanitized;

  for (const [key, state] of Object.entries(value)) {
    const normalizedKey = key.trim();
    if (
      !normalizedKey ||
      normalizedKey === "__apply_manga_filter_tags__" ||
      hasLiteralOrOperator(normalizedKey)
    ) {
      continue;
    }
    if (state !== "included" && state !== "excluded") continue;
    sanitized[normalizedKey] = state;
  }

  return sanitized;
}

function stripSyncedSearchFilterTags(
  value: Record<string, "included" | "excluded"> | undefined,
  syncedTags: Record<
    string,
    "included" | "excluded"
  > = buildMangaSyncedSearchFilterTags(),
): Record<string, "included" | "excluded"> {
  const sanitized = sanitizeSearchFilterTags(value);
  const allSyncedIds = new Set<string>([
    ...Object.keys(syncedTags),
    ...getStoredMangaSyncedTagIds(),
  ]);

  for (const syncedId of allSyncedIds) {
    delete sanitized[syncedId];
  }

  return sanitized;
}

function buildMangaSyncedSearchFilterTags(): Record<
  string,
  "included" | "excluded"
> {
  const include = sanitizeTagList(getIncludeTagsSetting(), {
    exclude: false,
  }).tokens;
  const exclude = sanitizeTagList(getExcludeTagsSetting(), {
    exclude: false,
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

function persistMergedSearchFilterTags(
  userTags: Record<string, "included" | "excluded">,
  syncedTags: Record<string, "included" | "excluded">,
): void {
  const sanitizedUserTags = sanitizeSearchFilterTags(userTags);
  const sanitizedSyncedTags = sanitizeSearchFilterTags(syncedTags);
  Application.setState(sanitizedUserTags, SEARCH_FILTER_USER_TAGS_KEY);
  Application.setState(
    Object.keys(sanitizedSyncedTags),
    SEARCH_FILTER_MANGA_SYNCED_TAGS_KEY,
  );
  Application.setState(
    {
      ...sanitizedUserTags,
      ...sanitizedSyncedTags,
    },
    SEARCH_FILTER_TAGS_KEY,
  );
}

function getUserSearchFilterTags(): Record<string, "included" | "excluded"> {
  const syncedTags = buildMangaSyncedSearchFilterTags();
  const stored = Application.getState(SEARCH_FILTER_USER_TAGS_KEY) as
    | Record<string, "included" | "excluded">
    | undefined;
  if (stored) {
    const sanitized = stripSyncedSearchFilterTags(stored, syncedTags);
    const storedKeys = Object.keys(sanitizeSearchFilterTags(stored));
    if (storedKeys.length !== Object.keys(sanitized).length) {
      persistMergedSearchFilterTags(sanitized, syncedTags);
    }
    return sanitized;
  }

  const legacy = sanitizeSearchFilterTags(
    Application.getState(SEARCH_FILTER_TAGS_KEY) as
      | Record<string, "included" | "excluded">
      | undefined,
  );
  if (Object.keys(legacy).length === 0) {
    return {};
  }

  const cleanedLegacy = stripSyncedSearchFilterTags(legacy, syncedTags);
  persistMergedSearchFilterTags(cleanedLegacy, syncedTags);
  return cleanedLegacy;
}

function convertMangaFilterTokenToSearchFilterId(
  token: string,
): string | undefined {
  if (!token || hasLiteralOrOperator(token)) return undefined;
  const match = token.match(/^tag:(.+)$/i);
  if (!match) return undefined;

  let value = match[1].trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }

  const slug = value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return slug.length > 0 ? slug : undefined;
}

function splitLegacyExtraArgs(value: string): {
  include: string;
  exclude: string;
} {
  const parts = value
    .split(/[,\n]/)
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

// ── Statistics Functions ─────────────────────────────────────────

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
  if (!getStatsInstallDate()) {
    Application.setState(new Date().toISOString(), STATS_INSTALL_DATE_KEY);
  }
  // One-time cleanup: remove orphaned tags stuck in SEARCH_FILTER_USER_TAGS_KEY
  // from a legacy migration bug where manga-filter-synced tags leaked into user tags
  const cleanupVersion =
    (Application.getState(SEARCH_FILTER_TAG_CLEANUP_KEY) as number) ?? 0;
  if (cleanupVersion < SEARCH_FILTER_TAG_CLEANUP_VERSION) {
    Application.setState(undefined, SEARCH_FILTER_USER_TAGS_KEY);
    Application.setState(undefined, SEARCH_FILTER_TAGS_KEY);
    Application.setState(undefined, SEARCH_FILTER_MANGA_SYNCED_TAGS_KEY);
    Application.setState(
      SEARCH_FILTER_TAG_CLEANUP_VERSION,
      SEARCH_FILTER_TAG_CLEANUP_KEY,
    );
  }
  // Seed totalRead from existing read cache if stat wasn't tracking yet
  // Check for undefined to distinguish from deliberate reset to 0
  if (Application.getState(STATS_TOTAL_READ_KEY) === undefined) {
    const readHistoryKeys = [
      "nhentai.readHistory",
      "nhentai.viewedHistory",
      "nhentai.viewHistory",
      "nhentai.readCache",
      "nhentai.read",
      "nhentai.read_history",
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
  Application.setState(getDisplayedMangaCount() + 1, STATS_DISPLAYED_MANGA_KEY);

  if (!mangaId) return;
  const ids = getDisplayedIds();
  if (!ids.has(mangaId)) {
    ids.add(mangaId);
    persistDisplayedIds(ids);
    Application.setState(ids.size, STATS_DISPLAYED_DISTINCT_KEY);
  }
}

function getDisplayedIds(): Set<string> {
  const raw = Application.getState(STATS_DISPLAYED_IDS_KEY) as
    | string[]
    | undefined;
  if (Array.isArray(raw)) return new Set(raw);
  return new Set();
}

function persistDisplayedIds(ids: Set<string>): void {
  const trimmed = Array.from(ids).slice(-5000);
  Application.setState(trimmed, STATS_DISPLAYED_IDS_KEY);
}

export function getDistinctDisplayedMangaCount(): number {
  const val = Application.getState(STATS_DISPLAYED_DISTINCT_KEY);
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return 0;
}

export function getReadingSessions(): ReadingSession[] {
  return (
    (Application.getState(STATS_SESSIONS_KEY) as
      | ReadingSession[]
      | undefined) ?? []
  );
}

export function recordReadingSession(): void {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const sessions = getReadingSessions();
  const existing = sessions.find((s) => s.date === today);
  if (existing) {
    existing.count++;
  } else {
    sessions.push({ date: today, count: 1 });
  }
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const cutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`;
  const trimmed = sessions.filter((s) => s.date >= cutoff);
  Application.setState(trimmed, STATS_SESSIONS_KEY);
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
  return (
    (Application.getState(STATS_TAG_COUNTS_KEY) as
      | Record<string, number>
      | undefined) ?? {}
  );
}

export function recordTagCounts(tags: string[]): void {
  const counts = getTagCounts();
  for (const tag of tags) {
    const normalized = tag.toLowerCase().trim();
    if (normalized) {
      counts[normalized] = (counts[normalized] ?? 0) + 1;
    }
  }
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
  const readHistory = Application.getState("nhentai.readHistory") as
    | string[]
    | undefined;
  return Array.isArray(readHistory) ? readHistory.length : 0;
}

export function incrementTotalMangaRead(): void {
  Application.setState(getTotalMangaRead() + 1, STATS_TOTAL_READ_KEY);
}

export function getMarkReadOnDescCount(): number {
  const val = Application.getState(STATS_MARK_READ_ON_DESC_COUNT_KEY);
  return typeof val === "number" ? val : 0;
}

export function incrementMarkReadOnDescCount(): void {
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

// Per-manga timestamp tracking for reread cooldown (5 minutes)
const REREAD_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
let rereadTimestamps: Map<string, number> | undefined;

function getRereadTimestamps(): Map<string, number> {
  if (!rereadTimestamps) {
    rereadTimestamps = new Map();
  }
  return rereadTimestamps;
}

export function recordMangaReadCount(
  mangaId: string,
  title?: string | null,
  isFirstRead = false,
  tags?: string[],
): void {
  if (!mangaId) return;

  // For rereads (not first read), enforce 5-minute cooldown per manga
  if (!isFirstRead) {
    const timestamps = getRereadTimestamps();
    const lastRead = timestamps.get(mangaId) ?? 0;
    const now = Date.now();
    if (now - lastRead < REREAD_COOLDOWN_MS) {
      return; // Skip counting — too soon since last read
    }
    timestamps.set(mangaId, now);
    // Clean up old entries to prevent memory leak
    if (timestamps.size > 500) {
      const cutoff = now - REREAD_COOLDOWN_MS;
      for (const [id, ts] of timestamps) {
        if (ts < cutoff) timestamps.delete(id);
      }
    }
  }

  const map = getReadCountMap();
  const existing = map[mangaId]?.count ?? 0;
  const newCount = existing + 1;
  map[mangaId] = {
    count: newCount,
    title: title ?? map[mangaId]?.title,
    tags: tags ?? map[mangaId]?.tags,
  };
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
  const map = getReadCountMap();
  return map[mangaId]?.count ?? 0;
}

export function getDataReceived(): number {
  const val = Application.getState(STATS_DATA_RECEIVED_KEY);
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return 0;
}

export function addDataReceived(bytes: number): void {
  if (bytes > 0) {
    Application.setState(getDataReceived() + bytes, STATS_DATA_RECEIVED_KEY);
  }
}

export function recordScreenTime(minutes: number): void {
  if (!getScreenTimeEnabledSetting()) return;
  if (minutes <= 0 || Number.isNaN(minutes)) return;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

function persistScreenTimeMap(map: ScreenTimeMap): void {
  const cutoffDate = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
  const cutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`;
  const trimmedEntries = Object.entries(map)
    .filter(([date]) => date >= cutoff)
    .sort(([a], [b]) => a.localeCompare(b));
  const trimmed: ScreenTimeMap = {};
  for (const [date, minutes] of trimmedEntries) {
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
  const baseOffset = weekOffset * 7;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i - baseOffset);
    // Use local date components to avoid UTC offset shifting days
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    results.push({ date: key, minutes: map[key] ?? 0 });
  }
  return results;
}

export function getScreenTimeLastNWeeks(
  weeks: number,
): { weekStart: string; minutes: number }[] {
  const map = getScreenTimeMap();
  const results: { weekStart: string; minutes: number }[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - dayOfWeek);

  for (let w = weeks - 1; w >= 0; w--) {
    const start = new Date(startOfThisWeek);
    start.setDate(start.getDate() - w * 7);
    const weekStartKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      sum += map[key] ?? 0;
    }
    results.push({ weekStart: weekStartKey, minutes: sum });
  }
  return results;
}

// ── Screen Time Mode Persistence ───────────────────────────────────

const SCREEN_TIME_MODE_KEY = "nhentai.stats.screenTimeMode";

export function getScreenTimeEnabledSetting(): boolean {
  const value = Application.getState(STATS_SCREEN_TIME_ENABLED_KEY) as
    | boolean
    | undefined;
  return value !== false;
}

export function setScreenTimeEnabledSetting(enabled: boolean): void {
  Application.setState(enabled, STATS_SCREEN_TIME_ENABLED_KEY);
}

export function getScreenTimeMode(): "week" | "day" {
  const val = Application.getState(SCREEN_TIME_MODE_KEY) as string | undefined;
  return val === "day" ? "day" : "week";
}

export function setScreenTimeMode(mode: "week" | "day"): void {
  Application.setState(mode, SCREEN_TIME_MODE_KEY);
}

// ── Tag Display Limit ──────────────────────────────────────────────

const TAG_DISPLAY_LIMIT_KEY = "nhentai.stats.tagDisplayLimit";
const TAG_DISPLAY_STEPS = [75, 50, 25, 15, 10, 5, 3, 1];

const REREAD_DISPLAY_LIMIT_KEY = "nhentai.stats.rereadDisplayLimit";
const REREAD_DISPLAY_STEPS = [75, 50, 25, 15, 10, 5, 3, 1];

export function getTagDisplayLimit(): number {
  const raw = Application.getState(TAG_DISPLAY_LIMIT_KEY) as
    | number
    | string
    | boolean
    | undefined;
  const val = Number(raw);
  if (Number.isFinite(val) && TAG_DISPLAY_STEPS.includes(val)) return val;
  return 75;
}

export function setTagDisplayLimit(limit: number): void {
  Application.setState(limit, TAG_DISPLAY_LIMIT_KEY);
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
  if (Number.isFinite(val) && REREAD_DISPLAY_STEPS.includes(val)) return val;
  return 10;
}

export function setRereadDisplayLimit(limit: number): void {
  Application.setState(limit, REREAD_DISPLAY_LIMIT_KEY);
}

export function getRereadDisplaySteps(): number[] {
  return REREAD_DISPLAY_STEPS;
}

// ── Average Page Count ─────────────────────────────────────────────

export function getAveragePageCount(): number {
  const counts = getPageCounts();
  let totalItems = 0;
  let weightedSum = 0;
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
  return totalItems > 0 ? Math.round(weightedSum / totalItems) : 0;
}

export function resetAllStatistics(): void {
  Application.setState(undefined, STATS_INSTALL_DATE_KEY);
  // Use 0 for numeric counters so ensureInstallDate() doesn't re-seed from legacy caches
  Application.setState(0, STATS_DISPLAYED_MANGA_KEY);
  Application.setState(0, STATS_DISPLAYED_DISTINCT_KEY);
  Application.setState(undefined, STATS_DISPLAYED_IDS_KEY);
  Application.setState(undefined, STATS_SESSIONS_KEY);
  Application.setState(undefined, STATS_PAGE_COUNTS_KEY);
  Application.setState(undefined, STATS_TAG_COUNTS_KEY);
  Application.setState(0, STATS_TOTAL_READ_KEY);
  Application.setState(undefined, STATS_DATA_RECEIVED_KEY);
  Application.setState(undefined, STATS_READ_COUNT_MAP_KEY);
  Application.setState(undefined, STATS_SCREEN_TIME_KEY);
  Application.setState(undefined, STATS_STREAK_GRACE_KEY);
  Application.setState(undefined, SCREEN_TIME_MODE_KEY);
  Application.setState(undefined, TAG_DISPLAY_LIMIT_KEY);
  Application.setState(undefined, REREAD_DISPLAY_LIMIT_KEY);
  // Also clear the mark-read-on-description counter
  Application.setState(0, STATS_MARK_READ_ON_DESC_COUNT_KEY);
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
    keys: [STATS_READ_COUNT_MAP_KEY],
  },
  { id: "avg_per_day", title: "Average Manga Read Per Day", keys: [] },
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
    keys: [STATS_DATA_RECEIVED_KEY],
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
    id: "screen_time",
    title: "Full Screen Time",
    keys: [STATS_SCREEN_TIME_KEY, SCREEN_TIME_MODE_KEY],
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
  // Normalize tag names: strip prefixes like "female:", "male:", "tag:" for matching
  const normalizeTag = (t: string) => t.replace(/^(female|male|tag|artist|character|parody|group|language|category):/, "");
  const toRemove = new Set(tagNames.map(normalizeTag));
  for (const key of Object.keys(counts)) {
    if (toRemove.has(normalizeTag(key))) {
      delete counts[key];
    }
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
  { id: "new_uploads", title: "Date Added" },
  { id: "popular_today", title: "Popular Today" },
  { id: "popular_week", title: "Popular This Week" },
  { id: "popular_month", title: "Popular This Month" },
  { id: "popular_all", title: "Popular All-Time" },
  {
    id: "last_read",
    title: "Last Read",
    subtitle: "Shows Your Read Manga From Latest To Oldest",
  },
  {
    id: "related",
    title: "Related",
    subtitle: "Shows All Your Read Manga Each With 5 Similar Manga",
  },
  {
    id: "top_reread",
    title: "Top Reread",
    subtitle: "Shows Your Top Reread Manga From Highest To Lowest",
  },
];

export const DEFAULT_SECTION_ORDER = ALL_DISCOVER_SECTIONS.map((s) => s.id);

// Sections hidden by default to reduce API calls on app launch
export const DEFAULT_HIDDEN_SECTIONS = ["related", "top_reread", "last_read"];

export function getDiscoverSectionOrder(): string[] {
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
  const stored = Application.getState(DISCOVER_SECTION_HIDDEN_KEY) as
    | string[]
    | undefined;
  // If nothing is stored, use default hidden sections (reduces initial API calls)
  if (!Array.isArray(stored)) {
    return new Set(DEFAULT_HIDDEN_SECTIONS);
  }
  return new Set(stored);
}

export function setHiddenSections(hidden: Set<string>): void {
  Application.setState([...hidden], DISCOVER_SECTION_HIDDEN_KEY);
}
