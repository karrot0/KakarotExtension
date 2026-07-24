/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */
import {
  BasicRateLimiter,
  Chapter,
  ChapterDetails,
  CloudflareError,
  ContentRating,
  Cookie,
  DiscoverSection,
  DiscoverSectionItem,
  DiscoverSectionType,
  ExtensionImpl,
  Form,
  InputRow,
  JSONValue,
  LabelRow,
  PagedResults,
  Request,
  SearchQuery,
  SearchResultItem,
  Section,
  SortingOption,
  SourceManga,
  TagSection,
  TriStateSelectSection,
} from "@paperback/types";
import {
  SearchFilterForm,
  type SearchFilter,
  type SearchFilterValue,
} from "@paperback/types/lib/compat/0.8/searchFilters";
import { closureSelector } from "@paperback/types/lib/impl/Selector.js";
import { HitomiSettingsForm } from "./forms";
import { HitomiInterceptor } from "./interceptors";
import {
  GalleryIdOptions,
  HitomiFile,
  HitomiGallery,
  HitomiTag,
} from "./model";
import hitomiInfo from "./pbconfig";
import {
  addDescMarkedReadId,
  addToViewedHistory,
  ALL_DISCOVER_SECTIONS,
  ensureInstallDate,
  formatDateByPattern,
  getAddTagsToDescriptionSetting,
  getAllRereadManga,
  getDateFormatSetting,
  getDefaultSearchSortSetting,
  getDescMarkedReadIds,
  getDiscoverCarouselTilesSetting,
  getDiscoverPageTilesSetting,
  getDiscoverSectionOrder,
  getDisplayOptionsSetting,
  getEnableRelatedSetting,
  getEnableRereadSectionSetting,
  getExcludeTagsSetting,
  getExtraArgsSetting,
  getFuzzySearchTagsSetting,
  getHiddenSections,
  getHideReadInRelatedSetting,
  getHideReadSetting,
  getIncognitoModeSetting,
  getLanguageSetting,
  getLanguageToken,
  getMarkReadOnViewSetting,
  getOnlyFuzzyUnknownTagsSetting,
  getPagesExpressionSetting,
  getPreferredImageFormatSetting,
  getRateLimiterSettings,
  getRemoveSeparatorSpacesSetting,
  getRereadCount,
  getSearchFilterDate,
  getSearchFilterLength,
  getSearchFilterTags,
  getSearchPageTilesSetting,
  getStatsTrackingEnabledSetting,
  getThumbnailQualitySetting,
  HitomiSearchSortId,
  incrementDisplayedManga,
  incrementMarkReadOnDescCount,
  parsePagesExpression,
  recordMangaReadCount,
  recordPageCount,
  recordReadingSession,
  recordTagCounts,
  removeDescMarkedReadId,
  setSearchFilterLength,
  setSearchFilterTags,
  TAG_CACHE_REFRESH_INTERVAL_MS,
} from "./settings";
import { getGallery, getGalleryIds } from "./utils/gallery";
import { ImageUriResolver } from "./utils/uri";

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

interface IdentifiableItem {
  id: string;
}

type CacheEntry<T> = {
  item: T;
  createdDate: Date;
  lastAccessDate: Date;
};

class MemoryCache<T extends IdentifiableItem> {
  private items: string[] = [];
  private cache: Record<string, CacheEntry<T>> = {};

  maxCount = 500;
  maxCountBuffer = 50;

  get count(): number {
    return this.items.length;
  }

  addItem(item: T): void {
    if (!this.items.includes(item.id)) this.items.push(item.id);
    const date = new Date();
    this.cache[item.id] = { createdDate: date, lastAccessDate: date, item };
    this.pruneCacheIfNeeded();
  }

  setEntry(
    item: T,
    createdDate: Date,
    lastAccessDate: Date = createdDate,
  ): void {
    if (!this.items.includes(item.id)) this.items.push(item.id);
    this.cache[item.id] = { item, createdDate, lastAccessDate };
    this.pruneCacheIfNeeded();
  }

  getEntry(id: string, touch = true): CacheEntry<T> | undefined {
    const entry = this.cache[id];
    if (!entry) return undefined;
    if (touch) entry.lastAccessDate = new Date();
    return entry;
  }

  getItem(id: string): T | undefined {
    const entry = this.getEntry(id);
    return entry?.item;
  }

  contains(id: string): boolean {
    return this.cache[id] != undefined;
  }

  removeItem(id: string): void {
    if (!this.cache[id]) return;
    delete this.cache[id];
    this.items = this.items.filter((itemId) => itemId !== id);
  }

  entries(): Array<[string, CacheEntry<T>]> {
    return this.items
      .map((id) => {
        const entry = this.cache[id];
        return entry ? ([id, entry] as [string, CacheEntry<T>]) : undefined;
      })
      .filter((value): value is [string, CacheEntry<T>] => value !== undefined);
  }

  pruneCacheIfNeeded(): void {
    if (this.count < this.maxCount + this.maxCountBuffer) return;
    this.items.sort((a, b) => {
      const aLastAccess = this.cache[a]?.lastAccessDate.getTime() ?? 0;
      const bLastAccess = this.cache[b]?.lastAccessDate.getTime() ?? 0;
      return aLastAccess - bLastAccess;
    });
    const evicted = this.items.splice(0, this.count - this.maxCount);
    for (const id of evicted) delete this.cache[id];
  }
}

type HitomiGalleryCacheItem = {
  id: string;
  gallery: HitomiGallery;
};

const READ_STATE_KEY = "hitomi.readHistory";
const COOKIE_JAR_STATE_KEY = "hitomi.cookieJar";
const LAST_SEARCH_FILTERS_KEY = "hitomi.lastSearchFilters";
const IDSET_CACHE_STATE_KEY = "hitomi.idSetCache.v1";
const RELATED_VIEW_COUNTS_KEY = "hitomi.relatedViewCounts";
const TAG_CACHE_STATE_KEY = "hitomi.tagCache";
const TAG_CACHE_VERSION = 2;
const TAG_CACHE_VERSION_KEY = "hitomi.tagCacheVersion";
const MERGED_TAGS_CACHE_KEY = "hitomi.mergedMaleFemaleTagSlugs";
const TAG_CACHE_LAST_FETCH_KEY = "hitomi.tagCacheLastFetch";
const GALLERY_CACHE_STATE_KEY = "hitomi.galleryCache";
const GALLERY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GALLERY_CACHE_MAX_SIZE = 300;

class InlineSearchFilterForm extends SearchFilterForm {
  override getSections() {
    if (!this.filters) {
      return [
        Section("loading", [LabelRow("loading", { title: "Loading Filters" })]),
      ];
    }
    if (this.filters instanceof Error) {
      return [
        Section("error", [
          LabelRow("error", {
            title: "Error loading search filters",
            subtitle: this.filters.message,
          }),
        ]),
      ];
    }

    return this.filters.map((filter) => {
      switch (filter.type) {
        case "dropdown": {
          const selectedOptionId = (this.selectedFilterValues[filter.id] ??
            filter.value) as string;
          return Section(
            { id: filter.id, header: filter.title },
            filter.options.map((option) =>
              LabelRow(option.id, {
                title: option.value,
                value: selectedOptionId === option.id ? "✓" : undefined,
                onSelect: closureSelector(
                  this,
                  `${filter.id}#${option.id}`,
                  async () => {
                    this.selectedFilterValues[filter.id] = option.id;
                    this.reloadForm();
                  },
                ),
              }),
            ),
          );
        }
        case "multiselect": {
          if (!this.selectedFilterValues[filter.id]) {
            this.selectedFilterValues[filter.id] = { ...filter.value };
          }
          const value = this.selectedFilterValues[filter.id] as Record<
            string,
            "included" | "excluded"
          >;
          return TriStateSelectSection(this, {
            id: filter.id,
            header: filter.title,
            layout: "flow",
            value,
            items: filter.options.map((o) => ({ id: o.id, title: o.value })),
            allowExclusion: filter.allowExclusion,
            allowEmptySelection: filter.allowEmptySelection,
            maximum: filter.maximum ?? undefined,
          });
        }
        case "input": {
          const value = (this.selectedFilterValues[filter.id] ??
            filter.value) as string;
          return Section({ id: filter.id, header: filter.title }, [
            InputRow(filter.id, {
              title: filter.title,
              value,
              onValueChange: closureSelector(
                this,
                filter.id,
                async (newValue: string) => {
                  this.selectedFilterValues[filter.id] = newValue;
                  this.reloadForm();
                },
              ),
            }),
          ]);
        }
      }
    });
  }
}

// Pattern to filter out ugly convention tags like "sc35", "futaket10", "comic1 ☆26", "sc2019 spring", "comic1 bs-sai special", etc.
// These are doujinshi convention codes that aren't meaningful to most users.
// Adaptive pattern: convention prefix + (any characters) + (trailing year/season/number)
// Handles: sc[N] seasons, comic1[☆]N, shinshgun kemoket N, douyara deban no youda! N, chobikuma, super X YYYY, etc.
const UGLY_CONVENTION_TAG_PATTERN =
  /^(?:shinshgun\s+kemoket|douyara\s+deban\s+no\s+youda|chobikuma|comic1\s+bs-sai|(?:sc|csp|cr|ct|ac|c\d|futaket|kemoket|harucc|kouroumu|comitia|reitaisai|spark|super|tora\s+matsuri|fur-st|comic\s+castle|fall\s+of\s+wall|houraigekisen|shuuki\s+reitaisai|shota\s+scratch|bokura\s+no\s+love\s+live|superkansai21|shotafes|puniket|kansai!?\s*kemoket|comic1|ff))(?:.*?(?:\d+|spring|summer|autumn|fall|winter))?$/i;

// Check if a tag slug is an ugly convention tag
function isUglyConventionTag(slug: string): boolean {
  const normalized = formatTagTitle(slug).replace(/\s+/g, " ").trim();
  return UGLY_CONVENTION_TAG_PATTERN.test(normalized);
}

// All character groups for tag fetching
const TAG_CHARS = [..."abcdefghijklmnopqrstuvwxyz".split(""), "123"];

const DEBUG_HITOMI =
  typeof globalThis !== "undefined" &&
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.KAKAROT_DEBUG_HITOMI === "1";

function logHitomiDebug(...args: unknown[]) {
  if (DEBUG_HITOMI) {
    console.log("[Hitomi Debug]", ...args);
  }
}

const hitomiNoticeTimestamps = new Map<string, number>();

function logHitomiNotice(
  key: string,
  message: string,
  minimumIntervalMs = 15000,
): void {
  const now = Date.now();
  const last = hitomiNoticeTimestamps.get(key) ?? 0;
  if (!DEBUG_HITOMI && now - last < minimumIntervalMs) {
    return;
  }
  hitomiNoticeTimestamps.set(key, now);
  console.log(message);
}

// Abbreviate large numbers (e.g., 12345 -> "12K", 1234567 -> "1M")
function _abbreviateCount(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

// Default tile counts used as fallback when settings are unavailable.
const DEFAULT_CAROUSEL_TILES = 6;
const DEFAULT_DISCOVER_PAGE_SIZE = 12;
const DEFAULT_SEARCH_PAGE_SIZE = 12;
const WAVE_JOIN_WINDOW_MS = 180;

type SectionWaveKind = "Home" | "Search";

interface SectionWaveEntry {
  label: string;
  items: number;
  skipped: number;
  elapsedMs: number;
  completedAt: number;
}

interface SectionWaveState {
  id: number;
  kind: SectionWaveKind;
  startedAt: number;
  lastJoinAt: number;
  pending: Set<string>;
  entries: SectionWaveEntry[];
}

interface SectionWaveHandle {
  kind: SectionWaveKind;
  waveId: number;
  token: string;
  startedAt: number;
  label: string;
}

// Incremental gallery loading: process IDs in small batches, stop as soon as
// we have enough items that pass filters. Much more efficient than the old
// "fetch 30, resolve all, slice to 10" pattern — especially for users who
// have read many manga.
// Keep some headroom so opening details remains responsive while sections page.
const INCREMENTAL_BATCH = 8;

// Track how many times each related manga has been shown in the carousel
let relatedViewCounts: Map<number, number> | undefined;
const RELATED_AGE_WINDOW_TILES = 72;

function getCarouselTiles(): number {
  const value = getDiscoverCarouselTilesSetting();
  if (!Number.isFinite(value)) return DEFAULT_CAROUSEL_TILES;
  return Math.max(1, Math.min(16, Math.floor(value)));
}

function getDiscoverPageSize(): number {
  const value = getDiscoverPageTilesSetting();
  if (!Number.isFinite(value)) return DEFAULT_DISCOVER_PAGE_SIZE;
  return Math.max(1, Math.min(24, Math.floor(value)));
}

function getSearchPageSize(): number {
  const value = getSearchPageTilesSetting();
  if (!Number.isFinite(value)) return DEFAULT_SEARCH_PAGE_SIZE;
  return Math.max(1, Math.min(36, Math.floor(value)));
}

function getRelatedViewCounts(): Map<number, number> {
  if (!relatedViewCounts) {
    const stored = Application.getState(RELATED_VIEW_COUNTS_KEY) as
      | Record<string, unknown>
      | undefined;
    const next = new Map<number, number>();
    for (const [k, rawValue] of Object.entries(stored ?? {})) {
      const id = parseInt(k, 10);
      const count =
        typeof rawValue === "number"
          ? rawValue
          : typeof rawValue === "string"
            ? parseInt(rawValue, 10)
            : NaN;
      if (!Number.isFinite(id) || id <= 0) continue;
      if (!Number.isFinite(count) || count <= 0) continue;
      next.set(id, count);
    }
    relatedViewCounts = next;
  }
  return relatedViewCounts;
}

function incrementRelatedViewCount(id: number): number {
  const counts = getRelatedViewCounts();
  const current = counts.get(id) ?? 0;
  const newCount = current + 1;
  counts.set(id, newCount);
  // Persist as string values to avoid bridge conversion issues on some runtimes.
  try {
    const obj: Record<string, string> = {};
    counts.forEach((v, k) => {
      if (!Number.isFinite(k) || k <= 0) return;
      if (!Number.isFinite(v) || v <= 0) return;
      obj[k.toString()] = Math.floor(v).toString();
    });
    Application.setState(obj, RELATED_VIEW_COUNTS_KEY);
  } catch {
    // Keep in-memory counters even if persistence fails.
  }
  return newCount;
}

const LANGUAGE_SHORT: Record<string, string> = {
  english: "EN",
  japanese: "JP",
  korean: "KR",
  chinese: "ZH",
  spanish: "ES",
  thai: "TH",
  vietnamese: "VI",
};

function normalizeTagSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").replace(/ /g, "_");
}

function formatTagTitle(slug: string): string {
  return slug.replace(/_/g, " ");
}

function sanitizeTagId(slug: string): string {
  if (!slug || typeof slug !== "string") return "";
  return slug.replace(/[^a-z0-9]/gi, "_");
}

function cleanTagName(name: string): string {
  if (!name || typeof name !== "string") return "";
  // Only strip known type prefixes (male:, female:, tag:) — preserve other
  // prefixes like "location:" that are part of the tag name itself.
  const knownPrefixMatch = name.match(/^(?:male|female|tag):/i);
  const base = knownPrefixMatch ? name.slice(knownPrefixMatch[0].length) : name;
  return base.replace(/-all$/i, "");
}

type CachedTagEntry = {
  slug: string;
  display?: string;
  count?: number;
  ref?: string;
  type?: string;
};

function sanitizeCachedTagEntries(entries: unknown): CachedTagEntry[] {
  if (!entries) return [];

  const out: CachedTagEntry[] = [];

  // Handle compact string format: "slug|count|type|ref\nslug|count|type|ref"
  if (typeof entries === "string" && entries.includes("|")) {
    const lines = entries.split("\n");
    logHitomiDebug(
      `[Hitomi] Attempting to restore ${lines.length} tags from compact string`,
    );
    for (const line of lines) {
      const parts = line.split("|");
      if (parts.length < 3) continue;
      const [slug, countStr, type, ref] = parts;
      const count = parseInt(countStr, 10);
      if (!slug || isNaN(count)) continue;
      out.push({
        slug: slug.trim(),
        count: Math.max(0, count),
        type: type?.trim() || "tag",
        ref: ref?.trim() || slug.trim(),
      });
    }
    return out;
  }

  // Fallback for old JSON array format
  if (!Array.isArray(entries)) return [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const slug = normalizeBridgeString(obj.slug).trim();
    // Allow colons and other common characters used in Hitomi tag slugs
    if (!slug || !/^[a-z0-9_:.-]+$/i.test(slug)) continue;
    if (slug === "__apply_manga_filter_tags__") continue;
    const refRaw = normalizeBridgeString(obj.ref, slug).trim();
    const ref = /^(male|female):/i.test(refRaw) ? refRaw : slug;
    const countRaw =
      typeof obj.count === "number"
        ? obj.count
        : typeof obj.count === "string"
          ? Number.parseInt(obj.count, 10)
          : 0;
    const count = Number.isFinite(countRaw)
      ? Math.max(0, Math.floor(countRaw))
      : 0;
    out.push({ slug, count, ref, type: (obj.type as any) || "tag" });
  }
  return out;
}

function getTagCacheLastFetchTs(): number | undefined {
  const raw = Application.getState(TAG_CACHE_LAST_FETCH_KEY);
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeBridgeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === undefined || value === null) return fallback;

  try {
    const normalized =
      typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : String(value);
    return normalized.length > 0 ? normalized : fallback;
  } catch {
    return fallback;
  }
}

const CREATOR_LANGUAGE_TOKEN_SET = new Set(
  [
    "english",
    "japanese",
    "chinese",
    "korean",
    "spanish",
    "french",
    "german",
    "italian",
    "portuguese",
    "russian",
    "thai",
    "vietnamese",
    "indonesian",
    "turkish",
    "polish",
    "simpchinese",
    "tradchinese",
    "simplifiedchinese",
    "traditionalchinese",
    "en",
    "jp",
    "ja",
    "cn",
    "zh",
    "kr",
    "ko",
    "es",
    "fr",
    "de",
    "it",
    "pt",
    "ru",
    "th",
    "vi",
    "id",
    "tr",
    "pl",
  ].map((value) => value.toLowerCase()),
);

function isLanguageLikeCreatorToken(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return true;
  return CREATOR_LANGUAGE_TOKEN_SET.has(normalized);
}

function normalizeCreatorToken(value: string): string {
  return normalizeBridgeString(value)
    .replace(/\s+/g, " ")
    .replace(/^[,，]+|[,，]+$/g, "")
    .trim();
}

function hasMeaningfulCreatorCharacters(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}

function dedupeCreatorTokens(values: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const rawValue of values) {
    const normalized = normalizeCreatorToken(rawValue);
    if (
      normalized.length === 0 ||
      !hasMeaningfulCreatorCharacters(normalized) ||
      isLanguageLikeCreatorToken(normalized)
    ) {
      continue;
    }
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }
  return deduped;
}

function getCreatorFields(
  artists: string[],
  groups: string[],
): { author: string; artist: string } {
  const normalizedArtists = dedupeCreatorTokens(artists);
  const normalizedGroups = dedupeCreatorTokens(groups);

  // Combine groups then artists preserving order and deduping
  const combined: string[] = [];
  for (const g of normalizedGroups) {
    if (!combined.includes(g)) combined.push(g);
  }
  for (const a of normalizedArtists) {
    if (!combined.includes(a)) combined.push(a);
  }

  const combinedStr = combined.length > 0 ? combined.join(", ") : "";
  return { author: combinedStr, artist: "" };
}

function formatSearchSortLabel(sortBy: string): string {
  const labelMap: Record<string, string> = {
    date_published: "Date Published",
    date_added: "Date Added",
    random: "Random",
    popular_today: "Popular Today",
    popular_week: "Popular Week",
    popular_month: "Popular Month",
    popular_year: "Popular Year",
    popular: "Popular Alltime",
  };
  return (
    labelMap[sortBy] ??
    sortBy.replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
  );
}

function formatSearchFilterSummary(
  filtered: number,
  readSkipped: number,
  includeRead: boolean,
): string {
  const parts: string[] = [];
  if (filtered > 0) parts.push(String(filtered));
  if (includeRead && readSkipped > 0) parts.push(`${readSkipped}(read)`);
  if (parts.length === 0) return "";
  return `, filtered ${parts.join("+")}`;
}

type CursorMetadata = {
  [key: string]: JSONValue | undefined;
  page?: string | number;
  offset?: string | number;
  scanOffset?: string | number;
};

function isSearchFilterValue(value: unknown): value is SearchFilterValue {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { id?: unknown; value?: unknown };
  if (typeof candidate.id !== "string") return false;
  if (typeof candidate.value === "string") return true;
  return typeof candidate.value === "object" && candidate.value !== null;
}

function cleanSearchFilterValues(
  metadata: SearchFilterValue[] | undefined,
): SearchFilterValue[] | undefined {
  if (!Array.isArray(metadata)) return undefined;
  return metadata.filter(isSearchFilterValue).map((filter) => {
    if (filter.id !== "tags" || typeof filter.value !== "object") {
      return filter;
    }

    const tags = { ...filter.value } as Record<string, "included" | "excluded">;
    delete tags["__apply_manga_filter_tags__"];
    return { ...filter, value: tags };
  });
}

function getActiveSearchFilterValues(
  filters: SearchFilterValue[],
): SearchFilterValue[] {
  return filters.filter((filter) => {
    if (typeof filter.value === "string") {
      return filter.value.trim().length > 0 && filter.value !== "all";
    }
    return Object.keys(filter.value).some(
      (key) => key !== "__apply_manga_filter_tags__",
    );
  });
}

function readCursorNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function buildOffsetMetadata(
  offset: number,
  pageSize: number,
  scanOffset?: number,
): CursorMetadata {
  const safeOffset = Math.max(0, Math.floor(offset));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const metadata: CursorMetadata = {
    offset: safeOffset,
    page: Math.floor(safeOffset / safePageSize) + 1,
  };
  if (typeof scanOffset === "number" && Number.isFinite(scanOffset)) {
    metadata.scanOffset = Math.max(0, Math.floor(scanOffset));
  }
  return metadata;
}

function getEffectiveScanOffset(
  metadata: CursorMetadata | undefined,
  pageSize: number,
): number {
  if (!metadata) return 0;
  if (metadata.scanOffset !== undefined) {
    return Math.max(0, readCursorNumber(metadata.scanOffset, 0));
  }
  if (metadata.offset !== undefined) {
    return Math.max(0, readCursorNumber(metadata.offset, 0));
  }
  if (metadata.page !== undefined) {
    const page = Math.max(1, readCursorNumber(metadata.page, 1));
    const safePageSize = Math.max(1, Math.floor(pageSize));
    return (page - 1) * safePageSize;
  }
  return 0;
}

function buildIndexNozomiRange(
  offset: number,
  limit: number,
  options: { hideRead: boolean; filtered: boolean },
): { start: number; end: number } {
  const lookaheadMultiplier = options.hideRead
    ? options.filtered
      ? 24
      : 20
    : options.filtered
      ? 16
      : 12;
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeOffset = Math.max(0, Math.floor(offset));
  const end = safeOffset + safeLimit * lookaheadMultiplier;
  return { start: 0, end };
}

function normalizeCursorMetadata(
  metadata: CursorMetadata | undefined,
  pageSize: number,
): CursorMetadata | undefined {
  if (!metadata) return undefined;

  if (metadata.offset !== undefined) {
    return buildOffsetMetadata(
      readCursorNumber(metadata.offset, 0),
      pageSize,
      metadata.scanOffset !== undefined
        ? readCursorNumber(metadata.scanOffset, 0)
        : undefined,
    );
  }

  if (metadata.page !== undefined) {
    const page = Math.max(1, readCursorNumber(metadata.page, 1));
    const safePageSize = Math.max(1, Math.floor(pageSize));
    const normalized: CursorMetadata = {
      page,
      offset: (page - 1) * safePageSize,
    };
    if (metadata.scanOffset !== undefined) {
      normalized.scanOffset = readCursorNumber(
        metadata.scanOffset,
        readCursorNumber(normalized.offset, 0),
      );
    }
    return normalized;
  }

  return undefined;
}

function getTagCharKey(slug: string): string {
  const firstChar = slug.charAt(0).toLowerCase();
  return /[a-z]/.test(firstChar) ? firstChar : "123";
}

// Cache for tag type lookup - populated from tagData when tags are fetched
// Maps normalized tag name -> type prefix (male/female/tag/ambiguous)
let tagTypeCache: Map<string, "male" | "female" | "tag" | "ambiguous"> | null =
  null;
let tagTypeCacheDataSize = 0;
// Set of tag slugs that exist as both male: and female: - must search both URLs
let mergedMaleFemaleCache: Set<string> | null = null;

function ensureTagTypeCacheInitialized(): void {
  // Rebuild if cache is null or if tagData size changed (tags were refreshed)
  const currentDataSize =
    (Application.getState(TAG_CACHE_STATE_KEY) as unknown[] | undefined)
      ?.length ?? 0;
  if (tagTypeCache && tagTypeCacheDataSize === currentDataSize) return;
  const persistedTags = Application.getState(TAG_CACHE_STATE_KEY) as
    | { slug: string; ref?: string; type?: string }[]
    | undefined;
  if (
    !persistedTags ||
    !Array.isArray(persistedTags) ||
    persistedTags.length === 0
  )
    return;
  const tagData = new Map<string, { type: "male" | "female" | "tag" }>();
  for (const t of persistedTags) {
    const ref = t.ref ?? t.slug;
    const type: "male" | "female" | "tag" = ref.startsWith("female:")
      ? "female"
      : ref.startsWith("male:")
        ? "male"
        : "tag";
    tagData.set(t.slug, { type });
  }
  const cachedMerged = Application.getState(MERGED_TAGS_CACHE_KEY) as
    | string[]
    | undefined;
  const merged = new Set<string>(
    Array.isArray(cachedMerged) ? cachedMerged : [],
  );
  buildTagTypeCache(tagData, merged);
  tagTypeCacheDataSize = persistedTags.length;
}

function parseNozomiTagFromUrl(
  url: string,
): { type: "male" | "female" | "tag"; slug: string } | null {
  const match = url.match(/\/\/(?:[^/]+)\/(?:n\/)?tag\/([^/]+)-[^/]+\.nozomi/i);
  if (!match) return null;
  const raw = decodeURIComponent(match[1]);
  let type: "male" | "female" | "tag" = "tag";
  let name = raw;
  if (raw.startsWith("female:")) {
    type = "female";
    name = raw.slice("female:".length);
  } else if (raw.startsWith("male:")) {
    type = "male";
    name = raw.slice("male:".length);
  }
  const slug = normalizeTagSlug(cleanTagName(name));
  return slug ? { type, slug } : null;
}

export function buildTagTypeCache(
  tagData: Map<string, { type: "male" | "female" | "tag" }>,
  mergedSlugs?: Set<string>,
): void {
  tagTypeCache = new Map();
  mergedMaleFemaleCache = mergedSlugs ?? new Set();
  for (const [slug, data] of tagData) {
    // Tags that exist as both male: and female: should be marked ambiguous
    if (mergedMaleFemaleCache.has(slug)) {
      tagTypeCache.set(slug, "ambiguous");
    } else {
      tagTypeCache.set(slug, data.type);
    }
  }
  // console.log(`[Hitomi] Built tag type cache with ${tagTypeCache.size} entries (${mergedMaleFemaleCache.size} ambiguous)`);
}

interface HitomiSearchFilterTagGroup {
  id: string;
  display: string;
  count: number;
  slugs: string[];
  refs: string[];
}

/**
 * Returns a set of valid tag slugs from persisted tag cache.
 */
export function getTagLookupCache(): Set<string> | null {
  const cached = Application.getState(TAG_CACHE_STATE_KEY) as
    | { slug: string }[]
    | undefined;
  if (!cached || !Array.isArray(cached)) return null;
  return new Set(cached.map((t) => t.slug));
}

/**
 * Validates tags against the tag cache and returns only valid ones.
 * Invalid tags are silently removed.
 */
export function validateAndFilterTags(input: string): string {
  const validSlugs = getTagLookupCache();
  if (!validSlugs || validSlugs.size === 0) {
    return input;
  }

  const parts = input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const validParts: string[] = [];

  for (const part of parts) {
    if (/\s*\|\|\s*| OR /i.test(part)) {
      const orParts = part
        .split(/\s*\|\|\s*| OR /i)
        .map((s) => s.trim())
        .filter(Boolean);
      const validOrParts = orParts.filter((orPart) =>
        isTagValid(orPart, validSlugs),
      );
      if (validOrParts.length > 0) {
        validParts.push(validOrParts.join(" OR "));
      }
    } else {
      if (isTagValid(part, validSlugs)) {
        validParts.push(part);
      }
    }
  }

  return validParts.join(", ");
}

function isTagValid(tagPart: string, validSlugs: Set<string>): boolean {
  let clean = tagPart.trim();
  if (clean.startsWith("-")) clean = clean.slice(1);
  clean = clean.replace(/^(?:uf!|f!)/i, "");

  const typedMatch = clean.match(
    /^(?:artist|group|series|character|male|female|language|tag):(.+)$/i,
  );
  if (typedMatch) {
    clean = typedMatch[1];
  }

  if (clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.slice(1, -1);
  }

  const slug = normalizeTagSlug(clean.toLowerCase());
  return validSlugs.has(slug);
}

/**
 * Force-loads tag data by fetching alltags pages if not already cached.
 */
export async function ensureTagLookupLoaded(): Promise<void> {
  const cached = getTagLookupCache();
  if (cached && cached.size > 0) {
    return;
  }
  // Tags will be loaded on next getTags() call - forms should call reloadForm() after
}

export function parseTagsFromQuery(queryString: string): HitomiTag[] {
  const tags: HitomiTag[] = [];

  if (!queryString || typeof queryString !== "string") {
    return tags;
  }

  // Split by comma but preserve OR expressions within each part
  const parts = queryString
    .split(/,/)
    .map((s) => s.trim())
    .filter(Boolean);
  let orGroupCounter = 0;

  for (const part of parts) {
    try {
      // Check if this part contains "||" or " OR " (case insensitive)
      if (/\s*\|\|\s*|\s+OR\s+/i.test(part)) {
        const orParts = part
          .split(/\s*\|\|\s*|\s+OR\s+/i)
          .map((s) => s.trim())
          .filter(Boolean);
        orGroupCounter++;
        for (const orPart of orParts) {
          const tag = parseSingleTag(orPart);
          if (tag) {
            tag.orGroup = orGroupCounter;
            tags.push(tag);
          }
        }
      } else {
        const tag = parseSingleTag(part);
        if (tag) tags.push(tag);
      }
    } catch {
      // Parsing failed for this tag part
    }
  }
  return tags;
}

function parseSingleTag(part: string): HitomiTag | null {
  // Detect uf! prefix for forced unfuzzy/precise search (before any other parsing)
  let forceUnfuzzy = false;
  let cleanPart = part;
  if (cleanPart.match(/^(-)?uf!/i)) {
    forceUnfuzzy = true;
    cleanPart = cleanPart.replace(/^(-)?uf!/i, "$1");
  }

  // Detect f! prefix for forced fuzzy search (before any other parsing)
  let forceFuzzy = false;
  if (cleanPart.match(/^(-)?f!/i)) {
    forceFuzzy = true;
    cleanPart = cleanPart.replace(/^(-)?f!/i, "$1");
  }

  const typedMatch = cleanPart.match(
    /^(-)?(?:(artist|group|series|character|male|female|language|tag):)?(.+)$/i,
  );
  if (!typedMatch) return null;

  const isNegative = !!typedMatch[1] || cleanPart.startsWith("-");
  const explicitType = typedMatch[2]?.toLowerCase();
  let name = typedMatch[3]?.trim() ?? "";

  if (name.startsWith('"') && name.endsWith('"')) {
    name = name.slice(1, -1);
  }
  if (name.startsWith("-")) {
    name = name.slice(1);
  }

  // Hitomi treats underscores as spaces in tag slugs; normalize early so URLs encode "%20"
  name = name.replace(/_/g, " ");

  if (!name) return null;

  const normalizedName = name.replace(/\s+/g, " ").trim().toLowerCase();
  const normalizedSlug = normalizeTagSlug(normalizedName);

  let tagType: HitomiTag["type"];
  ensureTagTypeCacheInitialized();
  if (
    explicitType &&
    [
      "artist",
      "group",
      "series",
      "character",
      "male",
      "female",
      "language",
    ].includes(explicitType)
  ) {
    tagType = explicitType as HitomiTag["type"];
  } else if (explicitType === "tag") {
    tagType = "tag";
  } else if (tagTypeCache) {
    const cachedType = tagTypeCache.get(normalizedSlug);
    tagType = cachedType ?? "ambiguous";
  } else {
    tagType = "ambiguous";
  }

  // Determine fuzzy flag: forced by f! prefix, or by global setting
  // uf! prefix forces precise (non-fuzzy) search even when global fuzzy is on
  // onlyFuzzyUnknown: fuzzy-search tags not found in the tag cache (when global fuzzy is off)
  const fuzzyGlobal = getFuzzySearchTagsSetting();
  const onlyFuzzyUnknown = getOnlyFuzzyUnknownTagsSetting();
  let isFuzzy = forceFuzzy;
  if (!isFuzzy && !forceUnfuzzy && fuzzyGlobal) {
    isFuzzy = true;
  }
  // When global fuzzy is OFF but onlyFuzzyUnknown is ON, fuzzy-search tags
  // that are not in the tagTypeCache (unknown/uncached tags)
  if (!isFuzzy && !forceUnfuzzy && !fuzzyGlobal && onlyFuzzyUnknown) {
    ensureTagTypeCacheInitialized();
    // If tagTypeCache is null (not loaded), treat tag as unknown -> fuzzy
    if (!tagTypeCache || !tagTypeCache.has(normalizedSlug)) {
      isFuzzy = true;
    }
  }

  return {
    type: tagType,
    name: normalizedName,
    isNegative,
    isFuzzy: isFuzzy || undefined,
    forceFuzzy: forceFuzzy || undefined,
  };
}

function relativeDateString(date: Date): string {
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = diffDays / 365;

  // Format as years if over 999 days or 1+ year
  if (diffDays > 999 || diffYears >= 1) {
    return `${diffYears.toFixed(1)}y`;
  }
  if (diffMonths >= 1) return `${diffMonths}m`;
  if (diffDays >= 1) return `${diffDays}d`;
  if (diffHours >= 1) return `${diffHours}h`;
  if (diffMins >= 1) return `${diffMins}m`;
  return `${diffSecs}s`;
}

function markMangaAsRead(
  mangaId: string,
  title?: string | null,
  tags?: string[],
  options?: { trackStats?: boolean; forceFirstStatRead?: boolean },
): { isFirstRead: boolean } {
  // Don't mark as read if incognito/pause mode is enabled
  if (getIncognitoModeSetting()) {
    return { isFirstRead: false };
  }

  const history = getReadCache();
  const isFirstRead = history.markRead(mangaId);
  if (isFirstRead) {
    persistReadCache();
    // Invalidate related pool so it rebuilds with new history
    try {
      (
        globalThis as { __hitomiInvalidateRelatedPool?: () => void }
      ).__hitomiInvalidateRelatedPool?.();
    } catch {
      /* ignore */
    }
    // Notify framework to refresh search/description UI that depend on read-state
    try {
      // Application.invalidateSearchFilters() - API removed
    } catch {
      /* ignore */
    }
  }

  const shouldTrackStats = options?.trackStats ?? true;
  if (shouldTrackStats && getStatsTrackingEnabledSetting()) {
    const statsFirstRead = options?.forceFirstStatRead ? true : isFirstRead;
    recordMangaReadCount(mangaId, title, statsFirstRead, tags);
  }

  return { isFirstRead };
}

// Unified read history (combines Set lookup + ordered array)
let readHistory: ReadHistory | undefined;

function getReadCache(): ReadHistory {
  if (!readHistory) {
    let stored = Application.getState(READ_STATE_KEY) as string[] | undefined;

    // Attempt to migrate from legacy read keys to avoid losing read marks if the
    // storage key ever changes in future commits. This is safe and idempotent.
    if (!stored || stored.length === 0) {
      const legacyKeys = [
        "hitomi.viewedHistory",
        "hitomi.viewHistory",
        "hitomi.readCache",
        "hitomi.read",
        "hitomi.read_history",
      ];
      for (const key of legacyKeys) {
        const legacy = Application.getState(key) as string[] | undefined;
        if (legacy && legacy.length > 0) {
          Application.setState(legacy, READ_STATE_KEY);
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

function persistReadCache() {
  if (readHistory) {
    Application.setState(readHistory.toArray(), READ_STATE_KEY);
  }
}

function recordDisplayedTiles(items: readonly any[]): void {
  for (const item of items) {
    try {
      const candidate =
        item && typeof item === "object"
          ? (item as {
            mangaId?: unknown;
            id?: unknown;
            galleryId?: unknown;
          })
          : undefined;
      const id = candidate?.mangaId ?? candidate?.id ?? candidate?.galleryId;
      if (typeof id === "string") incrementDisplayedManga(id);
      else if (typeof id === "number") incrementDisplayedManga(String(id));
    } catch {
      /* non-critical stats */
    }
  }
}

async function fetchGalleryIdsWithOrLogic(
  context: HitomiExtension,
  options: GalleryIdOptions,
): Promise<number[]> {
  const fetcher = async (url: string, headers?: Record<string, string>) => {
    // Build cache key including Range header — B-tree makes multiple Range
    // requests to the SAME index URL with different byte ranges. Keying
    // only by URL would return the root node for every child node fetch.
    const rangeVal = headers?.Range ?? "";
    const cacheKey = rangeVal ? `${url}#${rangeVal}` : url;

    // Check 404 blacklist — return empty buffer for known-bad URLs
    if (context.nozomi404s.has(url)) {
      return new ArrayBuffer(0);
    }

    // Check URL+Range cache
    const cached = context.nozomiUrlCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < context.IDSET_TTL) {
      return cached.buffer;
    }

    // Deduplicate in-flight fetches to the same URL+Range.
    // All post-fetch logic (caching, 404 handling, logging) lives inside the
    // shared promise so it runs exactly once regardless of how many callers
    // are awaiting the same cacheKey.
    let pending = context.nozomiUrlPending.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        try {
          let buffer: ArrayBuffer;
          if (typeof context.fetchBinary === "function") {
            buffer = await context.fetchBinary(url, headers);
          } else {
            const request = {
              url,
              method: "GET",
              headers: headers || {},
            } satisfies Request;
            const [, buf] = await Application.scheduleRequest(request);
            buffer = buf;
          }

          // Safety: if a Range request to the B-tree INDEX file returned an
          // unexpectedly large response, the framework likely stripped the Range
          // header and is streaming the full 1.6 GB index. Reject early.
          // NOTE: B-tree DATA file responses can legitimately be several MB for
          // common terms (e.g. "a" → millions of IDs), so only guard .index URLs.
          const isIndexFile = url.includes(".index");
          if (rangeVal && isIndexFile && buffer.byteLength > 2_000_000) {
            console.error(
              `[Hitomi Fetcher] Range request to ${url} returned ` +
              `${buffer.byteLength} bytes — Range header likely stripped`,
            );
            throw new Error(
              `Range response too large: ${buffer.byteLength} bytes`,
            );
          }

          // Cache the response (with LRU eviction at 100 entries)
          context.nozomiUrlCache.set(cacheKey, { buffer, ts: Date.now() });
          if (context.nozomiUrlCache.size > 100) {
            const oldestKey = context.nozomiUrlCache.keys().next().value;
            if (oldestKey) context.nozomiUrlCache.delete(oldestKey);
          }
          return buffer;
        } catch (e: unknown) {
          const msg =
            e instanceof Error
              ? e.message
              : typeof e === "string"
                ? e
                : "Unknown error";
          console.error(`[Hitomi Fetcher] ERROR for ${cacheKey}: ${msg}`);
          if (msg.includes("404")) {
            console.log(`[Hitomi] Blacklisting 404 nozomi URL: ${url}`);
            context.nozomi404s.add(url);
            // Evict oldest entries if over limit
            if (context.nozomi404s.size > context.nozomi404sLimit) {
              const first = context.nozomi404s.values().next().value;
              if (first !== undefined) context.nozomi404s.delete(first);
            }
            return new ArrayBuffer(0);
          }
          throw e;
        } finally {
          context.nozomiUrlPending.delete(cacheKey);
        }
      })();
      context.nozomiUrlPending.set(cacheKey, pending);
    }

    return pending;
  };

  try {
    return await getGalleryIds(options, fetcher);
  } catch (e) {
    console.log(
      `fetchGalleryIdsWithOrLogic fallback failed: ${e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error"}`,
    );
    return [];
  }
}

function mapLanguageTokens(): string[] {
  const languageSetting = getLanguageSetting();
  if (languageSetting.includes("all")) return [];
  const tokens: string[] = [];
  for (const langId of languageSetting) {
    const token = getLanguageToken(langId);
    if (token) tokens.push(token);
  }
  return Array.from(new Set(tokens));
}

function buildLanguageParts(gallery: HitomiGallery): {
  langCode: string;
  langLabel: string;
} {
  const galleryLang = gallery.languageName?.english || "unknown";
  const langCode =
    LANGUAGE_SHORT[galleryLang] ?? galleryLang.toUpperCase().slice(0, 2);
  return { langCode, langLabel: galleryLang };
}

function generateSubtitle(
  gallery: HitomiGallery,
  isRead: boolean,
  rereadCount?: number,
): string {
  // Add defensive checks
  if (!gallery) return "Unknown";

  const displayOptions = getDisplayOptionsSetting();
  const { langCode } = buildLanguageParts(gallery);
  const pages = Number.isFinite(gallery.files?.length)
    ? Math.max(0, gallery.files.length)
    : 0;
  const showReadLetter = displayOptions.includes("hide_read_letter"); // Note: Despite the name, this now means "show" when present
  const showPageCount = displayOptions.includes("show_page_count");
  const readMarker = isRead && showReadLetter ? "r" : "";

  // Always show reread marker when the manga has rereads.
  const showReread = rereadCount !== undefined && rereadCount > 1;

  // Format as "7r55p" when reread count is shown alongside pages
  const pagesStr =
    showReread && showPageCount
      ? `${rereadCount}r${pages}p`
      : showReread
        ? `${rereadCount}r`
        : showPageCount
          ? `${readMarker}${pages}p`
          : "";

  const absoluteStr = formatDateByPattern(
    gallery.publishedDate,
    getDateFormatSetting(),
  );
  const relativeStr = relativeDateString(gallery.publishedDate);

  const showLangTag = displayOptions.includes("show_lang_tip");
  const isAllLang = getLanguageSetting().includes("all");
  const showAbsolute = displayOptions.includes("subtitle_date");
  const showRelative = displayOptions.includes("subtitle_relative");

  // Get remove spaces setting
  const removeSpaces = getRemoveSeparatorSpacesSetting();
  const separator = removeSpaces ? "|" : " | ";

  const parts: string[] = [];
  if (isAllLang || showLangTag) parts.push(langCode);
  if (showPageCount || showReread) parts.push(pagesStr);
  if (showRelative) parts.push(relativeStr);
  if (showAbsolute) parts.push(absoluteStr);
  return parts.join(separator);
}

export class HitomiExtension implements ExtensionImpl<typeof hitomiInfo> {
  requestManager = new HitomiInterceptor("hitomi");
  private cookieJar = new Map<string, Cookie>();
  // Initialize with dev settings - will be re-initialized on setting changes
  globalRateLimiter = this.createRateLimiter();

  private createRateLimiter(): BasicRateLimiter {
    const settings = getRateLimiterSettings();
    return new BasicRateLimiter("hitomi-rate", {
      numberOfRequests: settings.requestsPerSecond,
      bufferInterval: settings.bufferInterval,
      // Images are throttled separately by HitomiInterceptor (20/min hard cap)
      // so they skip the global rate limiter to avoid double-throttling.
      ignoreImages: true,
    });
  }

  ggSyncPromise: Promise<void> | null = null;
  private lastGgSyncAt = 0;
  private readonly GG_SYNC_MIN_INTERVAL_MS = 2000;

  // Consolidated tag storage - single source of truth
  tagData: Map<
    string,
    {
      slug: string;
      display: string;
      count: number;
      ref: string;
      type: "male" | "female" | "tag";
    }
  > = new Map();
  tagFetchPromise: Promise<void> | null = null; // Mutex to prevent concurrent fetches
  mergedMaleFemaleTagSlugs = new Set<string>();
  private tagListCache:
    | { slug: string; display: string; count: number }[]
    | null = null;
  private tagListCacheSize = 0;

  // Cached SearchFilter[] output to avoid rebuilding on every framework call
  // Cached SearchFilter[] output — REMOVED caching to ensure fresh state reads
  private searchFiltersDirty = true;
  private invalidateFiltersQueued = false;

  descriptionTagMap = new Map<number, Set<string>>();
  private descriptionTagMapLimit = 300;
  private galleryCache = (() => {
    const cache = new MemoryCache<HitomiGalleryCacheItem>();
    cache.maxCount = GALLERY_CACHE_MAX_SIZE;
    return cache;
  })();
  private galleryCacheDirty = false;
  coverCache = new Map<string, string>();

  galleryPending = new Map<string, Promise<HitomiGallery>>();
  coverCacheLimit = 500;

  // Cache for related pool to prevent re-fetching on pagination
  // Now uses lazy loading - pool grows as user scrolls
  relatedPoolCache: { id: number; tag: string; cycleIndex: number }[] | null =
    null;
  relatedPoolLastHistoryIndex = 0; // Track how far we've processed into history
  relatedPoolSeenIds = new Set<number>(); // Track seen IDs across lazy loads
  relatedPoolHistoryIds = new Set<number>(); // Track history IDs to exclude from relatedIds
  // Session-based page tracking: maps item ID → page number when first displayed
  // Used to hide items after user scrolls RELATED_VIEW_THRESHOLD pages past them
  relatedFirstSeenPage = new Map<number, number>();

  // Caching for gallery id lookups to reduce Nozomi requests
  idSetCache = new Map<string, { ids: number[]; ts: number }>();
  // In-flight fetch deduplication: prevents parallel discover sections from
  // duplicating nozomi requests for the same tag+language combination
  idSetPending = new Map<string, Promise<number[]>>();
  IDSET_TTL = 1000 * 60 * 60 * 24; // 24 hours; ID sets are safe to reuse across app restarts

  // URL-level nozomi response cache: deduplicates binary fetches across
  // different popularity sections that share the same tag nozomi URLs
  nozomiUrlCache = new Map<string, { buffer: ArrayBuffer; ts: number }>();
  // In-flight nozomi URL dedup: prevents parallel fetches to the same URL
  nozomiUrlPending = new Map<string, Promise<ArrayBuffer>>();
  // Blacklist of nozomi URLs that returned 404 (session-only, not persisted)
  nozomi404s = new Set<string>();
  nozomi404sLimit = 500;

  // Related pool persistence keys and configuration
  RELATED_POOL_STATE_KEY = "hitomi.relatedPool";
  RELATED_POOL_HISTORY_INDEX_KEY = "hitomi.relatedPoolHistoryIndex";
  RELATED_POOL_SEEN_IDS_KEY = "hitomi.relatedPoolSeenIds";
  LAZY_BATCH_SIZE = 6; // Load 5 history items at a time (6 batches ≈ 30 tiles)
  RELATED_PER_HISTORY = 5; // Max related per history item

  // Failure-based rate limiting and error recovery
  consecutiveFailures = 0;
  currentRateMultiplier = 1.0; // 1.0 = normal, lower = slower
  lastFailureTime = 0;
  ggRefreshInProgress = false;
  readonly MAX_CONSECUTIVE_FAILURES = 2;
  readonly RATE_RECOVERY_DELAY = 5000; // 5 seconds between recovery attempts

  // Search session tracking for stable pagination behavior
  searchSessionQuery = ""; // Track current query to reset on new search
  randomSearchSessionQuery = "";
  randomSearchSessionIds: number[] = [];
  randomDiscoverSessionQuery = "";
  randomDiscoverSessionIds: number[] = [];
  randomDiscoverServedIds = new Set<number>();
  randomDiscoverSessionFetchedCount = 0;
  private tagPartialFetchAttemptedThisLaunch = false;
  private searchNonce = 0; // Cancellation token for stale search requests
  private searchConsecutiveEmpty = 0; // Track consecutive empty pages to cap auto-advance
  private activeBackgroundGalleryLoads = 0;
  private pendingBackgroundGalleryResolvers: Array<() => void> = [];
  private foregroundGalleryPressureUntil = 0;
  private readonly MAX_BACKGROUND_GALLERY_LOADS = 2;
  private readonly FOREGROUND_GALLERY_GRACE_MS = 1800;
  private sectionRequestInFlight = new Map<
    string,
    Promise<PagedResults<DiscoverSectionItem>>
  >();
  private sectionWaveSeq = 0;
  private sectionWaveTokenSeq = 0;
  private activeSectionWaves = new Map<SectionWaveKind, SectionWaveState>();

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.requestManager.setCookieHeaderProvider((url) =>
      this.getCookieHeaderForUrl(url),
    );
    // Re-create rate limiter with current dev settings
    this.globalRateLimiter = this.createRateLimiter();
    this.globalRateLimiter.registerInterceptor();
    // Reset download rate limit state from any prior sessions to ensure clean start
    this.requestManager.resetRateLimitState();
    // ALWAYS invalidate gg.js on startup to ensure fresh parameters
    // Static state may persist stale data from previous sessions
    ImageUriResolver.invalidate();
    // Start GG sync in background
    this.syncGG().catch((e) =>
      console.log("[Hitomi] syncGG background failed", e),
    );
    // Register global callback for related pool invalidation
    (
      globalThis as { __hitomiInvalidateRelatedPool?: () => void }
    ).__hitomiInvalidateRelatedPool = () => this.invalidateRelatedPool();
    // Register global callback for clearing search caches when tag settings change
    (
      globalThis as { __hitomiClearSearchCaches?: () => void }
    ).__hitomiClearSearchCaches = () => this.clearSearchCaches();
    // Ensure install date is set for statistics
    ensureInstallDate();
    // Related pool persistence has historically produced bridge conversion
    // issues on Paperback; keep related state in-memory only.
    this.clearLegacyRelatedPoolState();
    this.restoreCookieJar();
    this.restoreGalleryCache();
    this.restoreIdSetCache();
    // Restore tags from persisted cache WITHOUT triggering a new fetch.
    // Tags are only fetched on-demand when forms/search actually need them.
    this.restoreTagsFromCache();
  }


  private restoreTagsFromCache(): void {
    try {
      // Bust stale or chunked cache layouts
      const storedVersion = Application.getState(TAG_CACHE_VERSION_KEY);
      if (storedVersion !== TAG_CACHE_VERSION) {
        for (let i = 0; i < 10; i++) {
          Application.setState(undefined, `${TAG_CACHE_STATE_KEY}_${i}`);
        }
        Application.setState(undefined, TAG_CACHE_STATE_KEY);
        Application.setState(undefined, TAG_CACHE_LAST_FETCH_KEY);
        Application.setState(undefined, MERGED_TAGS_CACHE_KEY);
        Application.setState(TAG_CACHE_VERSION, TAG_CACHE_VERSION_KEY);
        this.tagData.clear();
        return;
      }

      const cachedRaw = Application.getState(TAG_CACHE_STATE_KEY) as
        | string
        | undefined;

      const cachedSanitized = sanitizeCachedTagEntries(cachedRaw);
      const hasFullSnapshot = getTagCacheLastFetchTs() !== undefined;

      const cached = hasFullSnapshot
        ? cachedSanitized.filter((entry) => Number(entry.count ?? 0) > 0)
        : cachedSanitized;

      // Handle migration/cleanup if still using old array format
      if (Array.isArray(cachedRaw) && cached.length !== cachedRaw.length) {
        // No longer write back arrays; next fetchAllTags will use compact format
      }

      if (cached.length === 0) {
        logHitomiDebug("restoreTagsFromCache: no valid tags found in state");
        this.tagData.clear();
        return;
      }
      for (const entry of cached) {
        if (!entry.slug) continue;
        const type: "male" | "female" | "tag" = entry.ref?.startsWith("female:")
          ? "female"
          : entry.ref?.startsWith("male:")
            ? "male"
            : "tag";
        const normalizedCount = Number(entry.count ?? 0);
        this.tagData.set(entry.slug, {
          slug: entry.slug,
          display: entry.display ?? formatTagTitle(entry.slug),
          count: Number.isFinite(normalizedCount)
            ? Math.max(0, Math.floor(normalizedCount))
            : 0,
          ref: entry.ref ?? entry.slug,
          type,
        });
      }
      if (getTagCacheLastFetchTs() === undefined) {
        try {
          Application.setState(String(Date.now()), TAG_CACHE_LAST_FETCH_KEY);
        } catch {
          /* ignore */
        }
      }
      console.log(`[Hitomi] Restored ${this.tagData.size} tags from cache`);
    } catch (e) {
      console.log("[Hitomi] Failed to restore tags from cache", e);
    }
  }

  private restoreGalleryCache(): void {
    try {
      const saved = Application.getState(GALLERY_CACHE_STATE_KEY) as
        | {
          entries: [string, { gallery: HitomiGallery; ts: number }][];
        }
        | undefined;
      if (!saved?.entries || !Array.isArray(saved.entries)) return;

      const now = Date.now();
      let restored = 0;
      for (const [id, entry] of saved.entries) {
        if (!id || !entry || !entry.gallery || typeof entry.ts !== "number") {
          continue;
        }
        if (now - entry.ts > GALLERY_CACHE_TTL_MS) continue;

        const normalizedGallery = {
          ...entry.gallery,
          publishedDate: new Date(
            (entry.gallery as { publishedDate: string | number | Date })
              .publishedDate,
          ),
        };
        if (!Number.isFinite(normalizedGallery.publishedDate.getTime())) {
          continue;
        }

        const entryDate = new Date(entry.ts);
        this.galleryCache.setEntry(
          { id, gallery: normalizedGallery },
          entryDate,
          entryDate,
        );
        restored++;
      }

      if (restored > 0) {
        console.log(`[Hitomi] Restored ${restored} cached galleries`);
      }
    } catch {
      // Ignore restore failures
    }
  }

  private scheduleGalleryCacheSave(): void {
    this.galleryCacheDirty = true;
    this.saveGalleryCache();
  }

  private saveGalleryCache(): void {
    if (!this.galleryCacheDirty) return;
    try {
      const entries = this.galleryCache
        .entries()
        .map(([id, entry]) => {
          const gallery = entry.item.gallery;
          const publishedDate =
            gallery.publishedDate instanceof Date
              ? gallery.publishedDate
              : new Date(gallery.publishedDate);
          if (!Number.isFinite(publishedDate.getTime())) return null;
          return {
            id,
            gallery: {
              ...gallery,
              publishedDate: publishedDate.toISOString(),
            },
            ts: entry.createdDate.getTime(),
          };
        })
        .filter((entry) => entry !== null)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, GALLERY_CACHE_MAX_SIZE)
        .map(
          (entry) =>
            [entry.id, { gallery: entry.gallery, ts: entry.ts }] as const,
        );

      Application.setState({ entries }, GALLERY_CACHE_STATE_KEY);
      this.galleryCacheDirty = false;
    } catch {
      // Ignore save failures
    }
  }

  private getCachedGallery(id: string): HitomiGallery | undefined {
    const cached = this.galleryCache.getEntry(id);
    if (!cached) return undefined;
    const ts = cached.createdDate.getTime();
    if (Date.now() - ts > GALLERY_CACHE_TTL_MS) {
      this.galleryCache.removeItem(id);
      this.scheduleGalleryCacheSave();
      return undefined;
    }

    return cached.item.gallery;
  }

  private setCachedGallery(id: string, gallery: HitomiGallery): void {
    this.galleryCache.addItem({ id, gallery });
    this.scheduleGalleryCacheSave();
  }

  private getCookieStorageKey(cookie: Cookie): string {
    const path = cookie.path && cookie.path.length > 0 ? cookie.path : "/";
    return `${cookie.name}|${cookie.domain.toLowerCase()}|${path}`;
  }

  private parseCookieExpires(value: unknown): Date | undefined {
    if (!value) return undefined;
    const parsed =
      value instanceof Date ? value : new Date(value as string | number | Date);
    return Number.isFinite(parsed.getTime()) ? parsed : undefined;
  }

  private normalizeCookie(cookie: Cookie): Cookie | undefined {
    const name = typeof cookie.name === "string" ? cookie.name.trim() : "";
    const value = typeof cookie.value === "string" ? cookie.value : "";
    const domain =
      typeof cookie.domain === "string"
        ? cookie.domain.trim().toLowerCase()
        : "";
    if (!name || !domain) return undefined;
    const path = cookie.path && cookie.path.length > 0 ? cookie.path : "/";
    const expires = this.parseCookieExpires(cookie.expires);
    const created = this.parseCookieExpires(cookie.created);
    return { name, value, domain, path, expires, created };
  }

  private isCookieExpired(cookie: Cookie, now = Date.now()): boolean {
    return !!cookie.expires && cookie.expires.getTime() <= now;
  }

  private doesCookieMatchRequestUrl(
    cookie: Cookie,
    requestUrl: string,
  ): boolean {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(requestUrl);
    } catch {
      return false;
    }

    const host = parsedUrl.hostname.toLowerCase();
    const domain = cookie.domain.replace(/^\./, "").toLowerCase();
    if (!domain) return false;
    if (host !== domain && !host.endsWith(`.${domain}`)) {
      return false;
    }

    const cookiePath =
      cookie.path && cookie.path.length > 0 ? cookie.path : "/";
    return parsedUrl.pathname.startsWith(cookiePath);
  }

  private persistCookieJar(): void {
    try {
      Application.setState(
        Array.from(this.cookieJar.values()),
        COOKIE_JAR_STATE_KEY,
      );
    } catch {
      // Ignore persistence failures
    }
  }

  private restoreCookieJar(): void {
    try {
      const stored = Application.getState(COOKIE_JAR_STATE_KEY) as
        | Cookie[]
        | undefined;
      if (!Array.isArray(stored)) {
        this.cookieJar.clear();
        return;
      }

      const now = Date.now();
      this.cookieJar.clear();
      for (const rawCookie of stored) {
        const cookie = this.normalizeCookie(rawCookie);
        if (!cookie || this.isCookieExpired(cookie, now)) continue;
        this.cookieJar.set(this.getCookieStorageKey(cookie), cookie);
      }
      this.persistCookieJar();
    } catch {
      this.cookieJar.clear();
    }
  }

  private getCookieHeaderForUrl(url: string): string | undefined {
    const now = Date.now();
    let expiredRemoved = false;
    const matchingCookies: Cookie[] = [];

    for (const [key, cookie] of this.cookieJar.entries()) {
      if (this.isCookieExpired(cookie, now)) {
        this.cookieJar.delete(key);
        expiredRemoved = true;
        continue;
      }
      if (this.doesCookieMatchRequestUrl(cookie, url)) {
        matchingCookies.push(cookie);
      }
    }

    if (expiredRemoved) {
      this.persistCookieJar();
    }

    if (matchingCookies.length === 0) return undefined;

    matchingCookies.sort((a, b) => {
      const aPath = a.path ?? "/";
      const bPath = b.path ?? "/";
      return bPath.length - aPath.length;
    });

    return matchingCookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
  }

  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    const now = Date.now();
    let changed = false;
    for (const cookie of cookies) {
      const normalized = this.normalizeCookie(cookie);
      if (!normalized) continue;
      const key = this.getCookieStorageKey(normalized);
      if (this.isCookieExpired(normalized, now)) {
        changed = this.cookieJar.delete(key) || changed;
        continue;
      }
      this.cookieJar.set(key, normalized);
      changed = true;
    }

    if (changed) {
      this.persistCookieJar();
    }
  }

  async cloudflareBypassCompleted(
    _request: globalThis.Request,
    cookies: Cookie[],
    _localStorage: Record<string, string>,
  ): Promise<void> {
    await this.saveCloudflareBypassCookies(cookies);
  }

  private clearLegacyRelatedPoolState(): void {
    try {
      Application.setState(undefined, this.RELATED_POOL_STATE_KEY);
      Application.setState(undefined, this.RELATED_POOL_HISTORY_INDEX_KEY);
      Application.setState(undefined, this.RELATED_POOL_SEEN_IDS_KEY);
    } catch {
      // Ignore state errors
    }
  }

  private restoreIdSetCache(): void {
    try {
      const saved = Application.getState(IDSET_CACHE_STATE_KEY) as
        | { entries: [string, { ids: number[]; ts: number }][] }
        | undefined;
      if (!saved?.entries) return;
      const now = Date.now();
      let restoredCount = 0;
      for (const [key, entry] of saved.entries) {
        if (!Array.isArray(entry?.ids) || now - entry.ts > this.IDSET_TTL) {
          continue;
        }
        this.idSetCache.set(key, { ids: entry.ids, ts: entry.ts });
        restoredCount++;
      }
      if (restoredCount > 0) {
        console.log(`[Hitomi] Restored ${restoredCount} cached ID sets`);
      }
    } catch {
      // Ignore restore failures
    }
  }

  private saveIdSetCache(): void {
    try {
      const now = Date.now();
      const entries = [...this.idSetCache.entries()]
        .filter(([, entry]) => now - entry.ts < this.IDSET_TTL)
        .sort((a, b) => b[1].ts - a[1].ts)
        .slice(0, 120)
        .map(
          ([key, entry]) =>
            [key, { ids: entry.ids, ts: entry.ts }] as [
              string,
              { ids: number[]; ts: number },
            ],
        );
      Application.setState({ entries }, IDSET_CACHE_STATE_KEY);
    } catch {
      // Ignore save failures
    }
  }

  clearSearchCaches(): void {
    this.idSetCache.clear();
    this.idSetPending.clear();
    try {
      Application.setState(undefined, IDSET_CACHE_STATE_KEY);
    } catch {
      // Ignore state cleanup failures
    }
  }

  private beginSectionWave(
    kind: SectionWaveKind,
    label: string,
  ): SectionWaveHandle {
    const now = Date.now();
    let wave = this.activeSectionWaves.get(kind);
    const canJoin = !!wave && now - wave.lastJoinAt <= WAVE_JOIN_WINDOW_MS;
    if (!canJoin || !wave) {
      wave = {
        id: ++this.sectionWaveSeq,
        kind,
        startedAt: now,
        lastJoinAt: now,
        pending: new Set<string>(),
        entries: [],
      };
      this.activeSectionWaves.set(kind, wave);
    }

    const token = `${kind}-${wave.id}-${++this.sectionWaveTokenSeq}`;
    wave.pending.add(token);
    wave.lastJoinAt = now;

    return {
      kind,
      waveId: wave.id,
      token,
      startedAt: now,
      label,
    };
  }

  private completeSectionWave(
    handle: SectionWaveHandle,
    items: number,
    skipped: number,
    labelOverride?: string,
  ): void {
    const wave = this.activeSectionWaves.get(handle.kind);
    if (!wave || wave.id !== handle.waveId) return;

    wave.pending.delete(handle.token);
    wave.entries.push({
      label: labelOverride ?? handle.label,
      items,
      skipped: Math.max(0, skipped),
      elapsedMs: Date.now() - handle.startedAt,
      completedAt: Date.now(),
    });

    if (wave.pending.size > 0) return;

    const ordered = [...wave.entries].sort(
      (a, b) => a.completedAt - b.completedAt,
    );
    const totalMs = Math.max(0, Date.now() - wave.startedAt);
    const logLines: string[] = [];
    for (const entry of ordered) {
      const logParts: string[] = [`${entry.items} items`];
      if (entry.skipped > 0) logParts.push(`${entry.skipped} read`);
      logLines.push(
        `  - ${entry.label}: ${logParts.join(", ")}, ${entry.elapsedMs}ms`,
      );
    }
    if (String(wave.kind).toLowerCase() !== "search") {
      if (ordered.length > 1) {
        console.log(
          `[Hitomi] ${wave.kind} Wave Total Time: ${totalMs}ms\n${logLines.join("\n")}`,
        );
      } else if (ordered.length === 1) {
        console.log(
          `[Hitomi] ${wave.kind} Wave: ${logLines[0]?.replace("  - ", "")}`,
        );
      }
    }

    this.activeSectionWaves.delete(handle.kind);
  }

  async getSettingsForm(): Promise<Form> {
    return new HitomiSettingsForm();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    const order = getDiscoverSectionOrder();
    const hidden = getHiddenSections();
    const sectionMap = new Map(ALL_DISCOVER_SECTIONS.map((s) => [s.id, s]));

    const sections: DiscoverSection[] = [];
    for (const id of order) {
      if (hidden.has(id)) continue;
      // Skip Related/Top Reread if their settings are disabled
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
    metadata: JSONValue | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const discoverMetadata = metadata as { page?: number } | undefined;
    const key = `${section.id}:${JSON.stringify(discoverMetadata ?? {})}`;
    const inFlight = this.sectionRequestInFlight.get(key);
    if (inFlight) return inFlight;
    const startedAt = Date.now();
    const waveHandle =
      !discoverMetadata?.page || discoverMetadata.page === 1
        ? this.beginSectionWave("Home", section.title ?? section.id)
        : undefined;

    const request = (async (): Promise<PagedResults<DiscoverSectionItem>> => {
      switch (section.id) {
        case "date_added":
          return await this.getDateAddedSection(discoverMetadata, {
            carousel: true,
          });
        case "date_published":
          return await this.getDatePublishedSection(discoverMetadata, {
            carousel: true,
          });
        case "popular_today":
          return await this.getPopularSection("day", discoverMetadata, {
            carousel: true,
          });
        case "popular_week":
          return await this.getPopularSection("week", discoverMetadata, {
            carousel: true,
          });
        case "popular_month":
          return await this.getPopularSection("month", discoverMetadata, {
            carousel: true,
          });
        case "popular_year":
          return await this.getPopularSection("year", discoverMetadata, {
            carousel: true,
          });
        case "random":
          return await this.getRandomSection(discoverMetadata, {
            carousel: true,
          });
        case "last_read":
          return await this.getLastReadSection(discoverMetadata, {
            carousel: true,
          });
        case "related":
          return await this.getRelatedSection(discoverMetadata, {
            carousel: true,
          });
        case "top_reread":
          return await this.getTopRereadSection(discoverMetadata, {
            carousel: true,
          });
        default:
          return { items: [], metadata: undefined };
      }
    })();
    this.sectionRequestInFlight.set(key, request);
    try {
      const result = await request as PagedResults<DiscoverSectionItem> & {
        filteredSkipped?: number;
        readSkipped?: number;
      };
      const filteredSkipped = result.filteredSkipped ?? 0;
      const readSkipped = result.readSkipped ?? 0;
      const filterSummary = formatSearchFilterSummary(
        filteredSkipped,
        readSkipped,
        true,
      );
      console.log(
        `[Hitomi] ${section.title ?? section.id}: ${result.items.length} items${filterSummary}, ${Date.now() - startedAt}ms`,
      );
      if (waveHandle) {
        this.completeSectionWave(waveHandle, result.items.length, filteredSkipped + readSkipped);
      }
      return result as PagedResults<DiscoverSectionItem>;
    } catch (e) {
      if (waveHandle) {
        this.completeSectionWave(
          waveHandle,
          0,
          getCarouselTiles(),
          section.title ?? section.id,
        );
      }
      console.error(`[Hitomi] Section "${section.id}" failed`, e);
      return { items: [], metadata: undefined };
    } finally {
      this.sectionRequestInFlight.delete(key);
    }
  }

  private shouldRefreshTags(now = Date.now()): boolean {
    const showTagCounts =
      getDisplayOptionsSetting().includes("show_tag_counts");

    // If showTagCounts is OFF, we do NOT refresh if we already have a successful fetch.
    if (!showTagCounts) return false;

    // If no full-fetch timestamp exists, cache is partial/unknown and must be refreshed once.
    const lastFetch = getTagCacheLastFetchTs();
    if (!lastFetch) {
      logHitomiDebug("shouldRefreshTags: true (no lastFetch timestamp)");
      return true;
    }

    // Refresh only when counts are visible and cache is stale.
    const isStale = now - lastFetch >= TAG_CACHE_REFRESH_INTERVAL_MS;
    if (isStale) {
      logHitomiDebug(
        `shouldRefreshTags: true (cache stale, age=${Math.round((now - lastFetch) / 1000 / 60)}m)`,
      );
    }
    return isStale;
  }

  async ensureTagsLoaded(
    options: { allowPartial?: boolean } = {},
  ): Promise<void> {
    // If we have tags in memory, we're good. Only refresh if stale + show_tag_counts enabled.
    if (this.tagData.size > 0) {
      if (this.shouldRefreshTags() && !this.tagFetchPromise) {
        this.tagFetchPromise = this.fetchAllTags().finally(() => {
          this.tagFetchPromise = null;
          tagTypeCache = null;
          mergedMaleFemaleCache = null;
          this.debouncedInvalidateSearchFilters();
        });
      }
      return;
    }
    await this.getTags(options);
  }

  async getTags(
    options: { allowPartial?: boolean } = {},
  ): Promise<{ slug: string; display: string; count: number }[]> {
    const allowPartial = options.allowPartial ?? false;
    const showTagCounts =
      getDisplayOptionsSetting().includes("show_tag_counts");
    const toList = () => {
      if (this.tagListCache && this.tagListCacheSize === this.tagData.size) {
        return this.tagListCache;
      }
      const list = Array.from(this.tagData.values())
        .map((t) => ({ slug: t.slug, display: t.display, count: t.count }))
        .sort((a, b) => b.count - a.count);
      this.tagListCache = list;
      this.tagListCacheSize = this.tagData.size;
      return list;
    };

    // If we have tags loaded, return them. Background refresh only if needed.
    if (this.tagData.size > 0) {
      const refreshNeeded = this.shouldRefreshTags();
      if (refreshNeeded && !this.tagFetchPromise) {
        this.tagFetchPromise = this.fetchAllTags().finally(() => {
          this.tagFetchPromise = null;
          tagTypeCache = null;
          mergedMaleFemaleCache = null;
          this.debouncedInvalidateSearchFilters();
        });
      }
      if (refreshNeeded && !allowPartial && this.tagFetchPromise) {
        await this.tagFetchPromise;
      }
      return toList();
    }

    // No tags in memory - try to load from cache first
    this.restoreTagsFromCache();

    if (this.tagData.size > 0) {
      const refreshNeeded = this.shouldRefreshTags();
      if (refreshNeeded && !this.tagFetchPromise) {
        this.tagFetchPromise = this.fetchAllTags().finally(() => {
          this.tagFetchPromise = null;
          tagTypeCache = null;
          mergedMaleFemaleCache = null;
          this.debouncedInvalidateSearchFilters();
        });
      }
      if (refreshNeeded && !allowPartial && this.tagFetchPromise) {
        await this.tagFetchPromise;
      }

      return toList();
    }

    // Still waiting on a prior fetch
    if (this.tagFetchPromise) {
      if (allowPartial) return toList();
      await this.tagFetchPromise;
      return toList();
    }

    // No cached tags at all - must fetch for the first time ever
    if (allowPartial) {
      if (!showTagCounts && this.tagPartialFetchAttemptedThisLaunch) {
        return toList();
      }
      this.tagPartialFetchAttemptedThisLaunch = true;
      this.tagFetchPromise = this.fetchAllTags().finally(() => {
        this.tagFetchPromise = null;
        tagTypeCache = null;
        mergedMaleFemaleCache = null;
        this.debouncedInvalidateSearchFilters();
      });
      return toList();
    }

    this.tagFetchPromise = this.fetchAllTags();
    await this.tagFetchPromise;
    this.tagFetchPromise = null;
    tagTypeCache = null;
    mergedMaleFemaleCache = null;
    return toList();
  }

  private async fetchAllTags(): Promise<void> {
    const allRefsPerSlug = new Map<string, Set<string>>();

    const existingMerged = new Set<string>(
      (Application.getState(MERGED_TAGS_CACHE_KEY) as string[] | undefined) ??
      [],
    );

    const now = Date.now();
    const charsToFetch = Array.from(new Set(TAG_CHARS));

    console.log(
      `[Hitomi Tags] Fetching all ${charsToFetch.length} character pages`,
    );

    const fetchCharPage = async (char: string): Promise<boolean> => {
      try {
        const html = await this.fetchText(
          `https://hitomi.la/alltags-${char}.html`,
        );
        const regex =
          /<li>\s*<a\b[^>]*href="(?:https?:\/\/hitomi\.la)?\/tag\/([^"]+)\.html"[^>]*>([\s\S]*?)<\/a>\s*\(([\d,]+)\)\s*<\/li>/g;
        let match: RegExpExecArray | null;
        let parsedCount = 0;
        const nextEntries = new Map<
          string,
          {
            slug: string;
            display: string;
            count: number;
            ref: string;
            type: "male" | "female" | "tag";
          }
        >();
        while ((match = regex.exec(html)) !== null) {
          const rawRef = decodeURIComponent(match[1]);
          const displayText = match[2].replace(/<[^>]+>/g, "").trim();
          const cleaned = cleanTagName(rawRef);
          const slug = normalizeTagSlug(cleaned);
          if (!slug) continue;
          const count = parseInt(match[3].replace(/,/g, ""), 10);
          if (!allRefsPerSlug.has(slug)) allRefsPerSlug.set(slug, new Set());
          allRefsPerSlug.get(slug)!.add(rawRef);
          const type: "male" | "female" | "tag" = rawRef.startsWith("female:")
            ? "female"
            : rawRef.startsWith("male:")
              ? "male"
              : displayText.includes("♀")
                ? "female"
                : displayText.includes("♂")
                  ? "male"
                  : "tag";
          const existing = nextEntries.get(slug);
          if (!existing) {
            nextEntries.set(slug, {
              slug,
              display: formatTagTitle(slug),
              count,
              ref: rawRef,
              type,
            });
          } else {
            existing.count += count;
          }
          parsedCount++;
        }
        if (parsedCount === 0) {
          console.log(
            `[Hitomi Tags] Page ${char} returned no tags (${html.length} bytes) — might be CloudFlare challenge`,
          );
          return false;
        }

        for (const existingSlug of Array.from(this.tagData.keys())) {
          if (getTagCharKey(existingSlug) !== char) continue;
          this.tagData.delete(existingSlug);
        }
        for (const entry of nextEntries.values()) {
          this.tagData.set(entry.slug, entry);
        }
        return true;
      } catch {
        return false;
      }
    };

    const BATCH_SIZE = 6;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < charsToFetch.length; i += BATCH_SIZE) {
      const batch = charsToFetch.slice(i, i + BATCH_SIZE);

      try {
        const results = await Promise.all(
          batch.map(async (char) => {
            try {
              const ok = await fetchCharPage(char);
              return { char, ok };
            } catch {
              return { char, ok: false };
            }
          }),
        );

        for (const { char, ok } of results) {
          if (ok) {
            successCount++;
            console.log(
              `[Hitomi Tags] Fetched ${char} (${successCount + failCount}/${charsToFetch.length})`,
            );
          } else {
            failCount++;
            console.log(
              `[Hitomi Tags] Failed to fetch ${char} (${successCount + failCount}/${charsToFetch.length})`,
            );
          }
        }
      } catch (batchErr) {
        console.log(
          `[Hitomi Tags] Batch ${i / BATCH_SIZE + 1} failed:`,
          batchErr,
        );
        failCount += batch.length;
      }
    }

    const failedChars = charsToFetch.filter((char) => {
      return !Array.from(this.tagData.values()).some(
        (tag) => getTagCharKey(tag.slug) === char,
      );
    });

    for (
      let retryPass = 1;
      retryPass <= 1 &&
      failedChars.length > 0 &&
      failedChars.length < charsToFetch.length;
      retryPass++
    ) {
      console.log(
        `[Hitomi Tags] Retry pass ${retryPass}: ${failedChars.length} failed chars: ${failedChars.join(", ")}`,
      );
      const RETRY_BATCH = 2;
      for (let ri = 0; ri < failedChars.length; ri += RETRY_BATCH) {
        if (ri > 0) await this.delay(500);
        const retryBatch = failedChars.slice(ri, ri + RETRY_BATCH);
        const retryResults = await Promise.all(
          retryBatch.map(async (char) => {
            try {
              const ok = await fetchCharPage(char);
              return { char, ok };
            } catch {
              return { char, ok: false };
            }
          }),
        );
        for (const { char, ok } of retryResults) {
          if (ok) {
            successCount++;
            failCount--;
            const index = failedChars.indexOf(char);
            if (index > -1) failedChars.splice(index, 1);
            console.log(
              `[Hitomi Tags] Recovered ${char} on retry pass ${retryPass}`,
            );
          } else {
            console.warn(
              `[Hitomi Tags] Retry pass ${retryPass} failed for ${char}`,
            );
          }
        }
      }
    }

    for (const [slug, refs] of allRefsPerSlug) {
      const hasMale = Array.from(refs).some((r) => r.startsWith("male:"));
      const hasFemale = Array.from(refs).some((r) => r.startsWith("female:"));
      if (hasMale && hasFemale) existingMerged.add(slug);
    }
    this.mergedMaleFemaleTagSlugs = existingMerged;

    buildTagTypeCache(this.tagData, this.mergedMaleFemaleTagSlugs);

    const compactTags = Array.from(this.tagData.values())
      .filter((t) => t.count >= 100)
      .map((t) => `${t.slug}|${t.count}|${t.type}|${t.ref}`)
      .join("\n");
    try {
      Application.setState(compactTags, TAG_CACHE_STATE_KEY);
      Application.setState(TAG_CACHE_VERSION, TAG_CACHE_VERSION_KEY);
      Application.setState(
        Array.from(this.mergedMaleFemaleTagSlugs),
        MERGED_TAGS_CACHE_KEY,
      );
      Application.setState(String(now), TAG_CACHE_LAST_FETCH_KEY);
    } catch (e) {
      console.error("[Hitomi Tags] Failed to persist tag cache to state:", e);
    }

    const coveredChars = new Set(
      Array.from(this.tagData.values()).map((tag) => getTagCharKey(tag.slug)),
    );
    const missingChars = TAG_CHARS.filter((char) => !coveredChars.has(char));
    const cachedCount = compactTags.split("\n").filter(Boolean).length;
    console.log(
      `[Hitomi Tags] Done. Fetched: ${successCount}/${charsToFetch.length}, Failed: ${failCount}. In-memory: ${this.tagData.size}, Cached (>=100 uses): ${cachedCount}. Covered: ${coveredChars.size}/${TAG_CHARS.length}${missingChars.length > 0 ? ` (missing: ${missingChars.join(", ")})` : ""}`,
    );
  }

  /**
   * Immediately notify the framework that search filters changed.
   * Coalesces rapid-fire calls within the current event loop tick.
   */
  private debouncedInvalidateSearchFilters(): void {
    if (this.invalidateFiltersQueued) {
      return;
    }
    this.invalidateFiltersQueued = true;
    void Promise.resolve().then(() => {
      this.invalidateFiltersQueued = false;
      this.searchFiltersDirty = true;
      try {
        // Application.invalidateSearchFilters() - API removed
      } catch {
        /* ignore */
      }
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
          imageUrl: normalizeBridgeString(
            imageUrl,
            HitomiExtension.PLACEHOLDER_COVER,
          ),
          metadata,
          contentRating,
        }),
      );
  }

  private getSearchFilterTagGroups(): HitomiSearchFilterTagGroup[] {
    const grouped = new Map<
      string,
      HitomiSearchFilterTagGroup & { representativeCount: number }
    >();

    for (const entry of this.tagData.values()) {
      const id = sanitizeTagId(entry.slug);
      if (!id) continue;

      const existing = grouped.get(id);
      if (!existing) {
        grouped.set(id, {
          id,
          display: entry.display || formatTagTitle(entry.slug),
          count: entry.count,
          slugs: [entry.slug],
          refs: [entry.ref],
          representativeCount: entry.count,
        });
        continue;
      }

      existing.count += entry.count;
      if (!existing.slugs.includes(entry.slug)) existing.slugs.push(entry.slug);
      if (!existing.refs.includes(entry.ref)) existing.refs.push(entry.ref);
      if (entry.count > existing.representativeCount) {
        existing.display = entry.display || formatTagTitle(entry.slug);
        existing.representativeCount = entry.count;
      }
    }

    return Array.from(grouped.values())
      .map((g) => {
        const clone = { ...g };
        delete (clone as { representativeCount?: number }).representativeCount;
        return clone;
      })
      .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display));
  }

  async getSearchFilters(): Promise<SearchFilter[]> {
    this.searchFiltersDirty = false;

    const showTagCounts =
      getDisplayOptionsSetting().includes("show_tag_counts");
    await this.getTags({ allowPartial: !showTagCounts });
    const allDisplayableTags = this.getSearchFilterTagGroups().filter(
      (t) => !t.slugs.some((slug) => isUglyConventionTag(slug)),
    );
    const displayTags =
      allDisplayableTags.filter((t) => t.count >= 50).length > 0
        ? allDisplayableTags.filter((t) => t.count >= 50)
        : allDisplayableTags;
    const savedTags = getSearchFilterTags();
    const cleanedTags: Record<string, "included" | "excluded"> = {};
    const displayIds = new Set<string>();
    displayTags.forEach((t) => {
      displayIds.add(t.id);
      for (const slug of t.slugs) displayIds.add(slug);
      for (const ref of t.refs) displayIds.add(ref);
      const savedState =
        savedTags[t.id] ??
        t.slugs.map((slug) => savedTags[slug]).find(Boolean) ??
        t.refs.map((ref) => savedTags[ref]).find(Boolean);
      if (savedState) {
        cleanedTags[t.id] = savedState;
      }
    });
    // Preserve saved tags that aren't in the current display list (tag cache
    // may be partially loaded). These are still resolved via parseSingleTag
    // fallback at search time.
    for (const [key, state] of Object.entries(savedTags)) {
      if (key === "__apply_manga_filter_tags__") continue;
      if (!displayIds.has(key) && !cleanedTags[key]) {
        cleanedTags[key] = state;
      }
    }
    // Strip any leftover __apply_manga_filter_tags__ from old state
    delete cleanedTags["__apply_manga_filter_tags__"];
    const cleanedChanged =
      Object.keys(cleanedTags).length !== Object.keys(savedTags).length ||
      Object.keys(savedTags).some((k) => !cleanedTags[k]);

    if (cleanedChanged && displayTags.length > 0) {
      setSearchFilterTags(cleanedTags);
    }

    // Sort selected/excluded tags to the top of the tag list
    const selectedIds = new Set(Object.keys(cleanedTags));
    const sortTagsAlpha =
      getDisplayOptionsSetting().includes("show_tags_alpha");
    const unselectedTags = displayTags.filter((t) => !selectedIds.has(t.id));
    if (sortTagsAlpha) {
      unselectedTags.sort((a, b) => a.display.localeCompare(b.display));
    }
    const sortedTags = [
      ...displayTags.filter((t) => selectedIds.has(t.id)),
      ...unselectedTags,
    ];

    const filters: SearchFilter[] = [];

    filters.push(
      {
        id: "length",
        type: "dropdown",
        title: "Length",
        value: getSearchFilterLength(),
        options: [
          { id: "all", value: "All" },
          { id: "le20", value: "Less than 20 pages" },
          { id: "gt20", value: "More than 20 pages" },
          { id: "gt40", value: "More than 40 pages" },
          { id: "gt80", value: "More than 80 pages" },
          { id: "gt120", value: "More than 120 pages" },
          { id: "gt200", value: "More than 200 pages" },
        ],
      },
      {
        id: "tags",
        type: "multiselect",
        title: "Tags",
        options: sortedTags.map((t) => {
          const abbreviate = getDisplayOptionsSetting().includes(
            "abbreviate_tag_counts",
          );
          const countStr = abbreviate
            ? _abbreviateCount(t.count)
            : t.count.toString();
          const cleanedLabel = t.display.replace(/\s*-\s*\([^)]*\)\s*$/, "");
          return {
            id: t.id,
            value: showTagCounts
              ? `${cleanedLabel} - (${countStr})`
              : cleanedLabel,
          };
        }),
        value: cleanedTags,
        allowExclusion: true,
        allowEmptySelection: true,
        maximum: undefined,
      },
    );

    return filters;
  }

  async getAdvancedSearchForm(
    query: SearchQuery<SearchFilterValue[]>,
  ): Promise<SearchFilterForm> {
    return new InlineSearchFilterForm(query.metadata, this.getSearchFilters());
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    // Base sort options map
    const allSortOptions: Record<string, string> = {
      date_added: "Date Added",
      date_published: "Date Published",
      popular_today: "Popular Today",
      popular_week: "Popular This Week",
      popular_month: "Popular This Month",
      popular_year: "Popular This Year",
      random: "Random",
      last_read: "Last Read",
      related: "Related",
      top_reread: "Top Reread",
    };

    // Build options following the user's discover section order
    const order = getDiscoverSectionOrder();
    const hidden = getHiddenSections();
    const options: SortingOption[] = [];

    for (const id of order) {
      if (hidden.has(id)) continue;
      if (id === "related" && !getEnableRelatedSetting()) continue;
      if (id === "top_reread" && !getEnableRereadSectionSetting()) continue;
      const label = allSortOptions[id];
      if (label) options.push({ id, label });
    }

    // Ensure at least date_added is present if everything was hidden
    if (options.length === 0) {
      options.push({ id: "date_added", label: "Date Added" });
    }

    return options;
  }

  async getSearchResults(
    query: SearchQuery<SearchFilterValue[]>,
    metadata: JSONValue | undefined,
    sortingOption: SortingOption | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const searchStart = Date.now();
    const cursor = metadata == null ? undefined : (metadata as CursorMetadata);
    const searchWaveHandle =
      !cursor?.page || readCursorNumber(cursor.page, 1) === 1
        ? this.beginSectionWave(
          "Search",
          sortingOption?.label ?? sortingOption?.id ?? "default",
        )
        : undefined;
    const finishSearchWave = (label: string, itemCount: number): void => {
      if (!searchWaveHandle) return;
      this.completeSectionWave(
        searchWaveHandle,
        itemCount,
        Math.max(0, getSearchPageSize() - itemCount),
        label,
      );
    };
    // Increment nonce to cancel any in-flight stale search
    const myNonce = ++this.searchNonce;
    try {
      const limit = getSearchPageSize();

      const submittedFilters = cleanSearchFilterValues(query.metadata);
      const storedFilters: SearchFilterValue[] = [];

      const searchFilterLength = getSearchFilterLength();
      if (searchFilterLength && searchFilterLength !== "all") {
        storedFilters.push({
          id: "length",
          value: searchFilterLength,
        });
      }

      const searchFilterDate = getSearchFilterDate();
      if (searchFilterDate && searchFilterDate !== "all") {
        storedFilters.push({
          id: "daysOld",
          value: searchFilterDate,
        });
      }

      // Expand prefix-based exclusions if the user has provided any (e.g. "sc2019")
      const excludeRaw = getExcludeTagsSetting();
      const searchFilterTags = submittedFilters
        ? ((submittedFilters.find((filter) => filter.id === "tags")?.value as
          | Record<string, "included" | "excluded">
          | undefined) ?? {})
        : getSearchFilterTags();

      const mergedTags = { ...searchFilterTags };

      // Handle prefix-based exclusions from global manga filters
      if (excludeRaw.length > 0) {
        const excludePatterns = excludeRaw
          .split(/[,\n]/)
          .map((p) => p.trim().toLowerCase())
          .filter((p) => p.length > 0);

        if (excludePatterns.length > 0) {
          for (const tag of this.tagData.values()) {
            const slug = tag.slug.toLowerCase();
            if (excludePatterns.some((p) => slug.startsWith(p))) {
              mergedTags[tag.slug] = "excluded";
            }
          }
        }
      }

      const submittedActiveFilters = submittedFilters
        ? getActiveSearchFilterValues(submittedFilters).filter(
          (filter) => filter.id !== "tags",
        )
        : undefined;

      if (Object.keys(mergedTags).length > 0) {
        const tagsFilter: SearchFilterValue = {
          id: "tags",
          value: mergedTags,
        };
        if (submittedActiveFilters) {
          submittedActiveFilters.push(tagsFilter);
        } else {
          storedFilters.push(tagsFilter);
        }
      }

      const queryFilters = submittedActiveFilters ?? storedFilters;
      const filtersToPersist = submittedFilters ?? queryFilters;

      const offset = getEffectiveScanOffset(cursor, limit);
      const pageCursor =
        cursor === undefined
          ? undefined
          : {
            page:
              cursor.page !== undefined
                ? readCursorNumber(cursor.page, 1)
                : undefined,
            offset:
              cursor.offset !== undefined
                ? readCursorNumber(cursor.offset, 0)
                : undefined,
          };
      const tags: HitomiTag[] = [];
      const configuredDefaultSort = getDefaultSearchSortSetting();
      const incomingSort = sortingOption?.id;
      let sortBy = configuredDefaultSort;

      if (incomingSort) {
        sortBy = incomingSort as HitomiSearchSortId;
      }
      if (sortBy === "related" && !getEnableRelatedSetting())
        sortBy = "date_added";
      if (sortBy === "top_reread" && !getEnableRereadSectionSetting())
        sortBy = "date_added";
      let popularityOrderBy: GalleryIdOptions["popularityOrderBy"] = undefined;

      // Create unique search session key to track duplicates across pages
      const searchKey = JSON.stringify({
        title: query.title,
        filters: queryFilters,
        sort: sortBy,
      });
      if (offset === 0 || this.searchSessionQuery !== searchKey) {
        // New search - reset per-query session state
        this.searchSessionQuery = searchKey;
        this.randomSearchSessionQuery = "";
        this.randomSearchSessionIds = [];
        this.searchConsecutiveEmpty = 0;
      }

      if (sortBy === "related") {
        const relatedSection = await this.getRelatedSection(
          cursor as { page?: number; offset?: number | string } | undefined,
          { carousel: false },
        );
        finishSearchWave("related", relatedSection.items.length);
        return {
          items: this.discoverItemsToSearchResults(relatedSection.items),
          metadata: normalizeCursorMetadata(
            relatedSection.metadata as CursorMetadata | undefined,
            limit,
          ),
        };
      }

      if (sortBy === "top_reread") {
        const topRereadSection = await this.getTopRereadSection(pageCursor, {
          carousel: false,
        });
        finishSearchWave("top_reread", topRereadSection.items.length);
        return {
          items: this.discoverItemsToSearchResults(topRereadSection.items),
          metadata: normalizeCursorMetadata(
            topRereadSection.metadata as CursorMetadata | undefined,
            limit,
          ),
        };
      }

      if (sortBy === "last_read") {
        const lastReadSection = await this.getLastReadSection(pageCursor, {
          carousel: false,
        });
        finishSearchWave("last_read", lastReadSection.items.length);
        return {
          items: this.discoverItemsToSearchResults(lastReadSection.items),
          metadata: normalizeCursorMetadata(
            lastReadSection.metadata as CursorMetadata | undefined,
            limit,
          ),
        };
      }

      // Ensure tags are loaded so tagTypeCache is populated for parseTagsFromQuery
      // MUST await (not void) so tagTypeCache has correct types for settings tags;
      // using void caused all tags to become 'ambiguous' → 3 nozomi fetches instead of 1
      // Use ensureTagsLoaded (fast path) to avoid O(n log n) sort on each search
      await this.ensureTagsLoaded({ allowPartial: true });

      const originalTitle = (query.title ?? "").trim();
      const pagesExprSetting = getPagesExpressionSetting();
      const parsedPagesFromSettings = parsePagesExpression(pagesExprSetting);
      let minPages = parsedPagesFromSettings.min;
      let maxPages = parsedPagesFromSettings.max;

      // language OR logic: we use separate option rather than tagging the query
      const languageTokens = mapLanguageTokens();

      let titleQuery = query.title ?? "";
      // Parse settings tags using parseTagsFromQuery for proper type detection
      const extraArgs = getExtraArgsSetting();
      const settingsTags = parseTagsFromQuery(extraArgs);
      tags.push(...settingsTags);

      try {
        titleQuery = titleQuery.replace(
          /-(\w+(?:[\s_]+\w+)+)/gi,
          (_match: string, rawTag: string) => {
            const cleaned = (rawTag || "").replace(/_/g, " ");
            return `-"${cleaned}"`;
          },
        );
      } catch {
        /* ignore */
      }

      if (titleQuery.includes("orderby:popular")) {
        sortBy = "popular" as HitomiSearchSortId;
        titleQuery = titleQuery.replace(/orderby:popular/gi, "").trim();
        if (titleQuery.includes("orderbykey:year")) {
          popularityOrderBy = "year";
          titleQuery = titleQuery.replace(/orderbykey:year/gi, "").trim();
        } else if (titleQuery.includes("orderbykey:month")) {
          popularityOrderBy = "month";
          titleQuery = titleQuery.replace(/orderbykey:month/gi, "").trim();
        } else if (titleQuery.includes("orderbykey:week")) {
          popularityOrderBy = "week";
          titleQuery = titleQuery.replace(/orderbykey:week/gi, "").trim();
        } else if (titleQuery.includes("orderbykey:today")) {
          popularityOrderBy = "day";
          titleQuery = titleQuery.replace(/orderbykey:today/gi, "").trim();
        } else {
          popularityOrderBy = "day";
        }
      }

      if (titleQuery.includes("orderby:datepublished")) {
        sortBy = "date_published";
        titleQuery = titleQuery.replace(/orderby:datepublished/gi, "").trim();
      }

      try {
        if (originalTitle || queryFilters.length > 0) {
          Application.setState(
            { title: originalTitle, filters: queryFilters },
            LAST_SEARCH_FILTERS_KEY,
          );
        }

        // Always persist search filter values to state (even on first search)
        if (filtersToPersist.length > 0) {
          for (const filter of filtersToPersist) {
            if (filter.id === "length" && typeof filter.value === "string") {
              setSearchFilterLength(filter.value);
            } else if (filter.id === "tags") {
              const tagsValue = filter.value as
                | Record<string, "included" | "excluded">
                | undefined;
              if (tagsValue) {
                const nextTags = { ...tagsValue };
                // Strip leftover apply-manga-filter key from old state
                delete nextTags["__apply_manga_filter_tags__"];
                setSearchFilterTags(nextTags);
              }
            }
          }
          // Force the app to re-read filter defaults on next getSearchFilters call
          this.searchFiltersDirty = true;
          this.debouncedInvalidateSearchFilters();
        } else if (submittedFilters) {
          setSearchFilterTags({});
          this.searchFiltersDirty = true;
          this.debouncedInvalidateSearchFilters();
        }
      } catch {
        /* ignore */
      }

      if (
        !originalTitle &&
        queryFilters.length === 0 &&
        sortBy === "date_added"
      ) {
        const result = await this.getDateAddedSection(pageCursor, {
          carousel: false,
        });
        finishSearchWave("date_added", result.items.length);
        return {
          items: this.discoverItemsToSearchResults(result.items),
          metadata: normalizeCursorMetadata(
            result.metadata as CursorMetadata | undefined,
            limit,
          ),
        };
      }

      const languages = [
        "english",
        "japanese",
        "korean",
        "chinese",
        "spanish",
        "thai",
        "vietnamese",
      ];
      for (const lang of languages) {
        if (titleQuery.toLowerCase().includes(lang)) {
          if (!tags.find((t) => t.type === "language" && t.name === lang)) {
            tags.push({ type: "language", name: lang, isNegative: false });
          }
          titleQuery = titleQuery.replace(new RegExp(lang, "ig"), "").trim();
        }
      }

      const typedRegex =
        /(-)?(artist|group|series|character|male|female|language|tag):(".*?"|\S+)/gi;
      let typedMatch: RegExpExecArray | null;
      while ((typedMatch = typedRegex.exec(titleQuery)) !== null) {
        const isNegative = !!typedMatch[1];
        const type = (typedMatch[2] || "tag").toLowerCase();
        let name = typedMatch[3] || "";
        if (name.startsWith('"') && name.endsWith('"'))
          name = name.slice(1, -1);
        tags.push({ type: type as HitomiTag["type"], name, isNegative });
      }
      titleQuery = titleQuery
        .replace(typedRegex, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Hitomi's own plain-text search hashes the complete sanitized query
      // string into the galleries B-tree. Splitting title text into individual
      // words changes the key and can turn exact title searches into an empty
      // intersection, e.g. "I am a slave of a small succubus".
      const keyword = titleQuery;
      const keywordTerms = keyword
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0);

      if (keyword.trim().length > 0) {
        tags.push({
          type: "ambiguous",
          name: keyword.trim(),
          isNegative: false,
          isFuzzy: true,
          forceFuzzy: true,
        });
        // Clear keywordTerms so we don't do double-filtering
        keywordTerms.length = 0;
      }

      if (queryFilters.length > 0) {
        for (const filter of queryFilters) {
          if (filter.id === "tags") {
            const selectedTagsRaw = filter.value as
              | Record<string, "included" | "excluded">
              | undefined;
            if (selectedTagsRaw) {
              const selectedTags = { ...selectedTagsRaw };
              // Strip leftover apply-manga-filter key from old state
              delete selectedTags["__apply_manga_filter_tags__"];

              await this.getTags(); // Ensure tagData is populated
              const tagGroups = new Map(
                this.getSearchFilterTagGroups().map((group) => [
                  group.id,
                  group,
                ]),
              );
              let nextAliasOrGroup =
                tags.reduce((max, tag) => Math.max(max, tag.orGroup ?? 0), 0) +
                1;

              const pushResolvedTag = (
                slug: string,
                state: "included" | "excluded",
                orGroup: number | undefined,
              ): boolean => {
                const entry = this.tagData.get(slug);
                if (!entry) return false;

                tags.push({
                  type: this.mergedMaleFemaleTagSlugs.has(slug)
                    ? "ambiguous"
                    : entry.type,
                  name: cleanTagName(entry.ref || slug).replace(/_/g, " "),
                  isNegative: state === "excluded",
                  orGroup,
                });
                return true;
              };

              for (const tagId of Object.keys(selectedTags)) {
                const state = selectedTags[tagId];
                const group = tagGroups.get(tagId);
                if (group) {
                  const groupOr =
                    state === "included" && group.slugs.length > 1
                      ? nextAliasOrGroup++
                      : undefined;
                  let pushed = false;
                  for (const slug of group.slugs) {
                    pushed = pushResolvedTag(slug, state, groupOr) || pushed;
                  }
                  if (pushed) continue;
                }

                const fallback = parseSingleTag(tagId);
                if (fallback) {
                  tags.push({
                    ...fallback,
                    isNegative: state === "excluded",
                  });
                }
              }
            }
          } else if (
            filter.id === "length" &&
            typeof filter.value === "string" &&
            filter.value !== "all"
          ) {
            // Handle length filter like NHentai
            const lengthFilterMap: Record<
              string,
              { min?: number; max?: number }
            > = {
              le20: { max: 20 },
              gt20: { min: 21 },
              gt40: { min: 41 },
              gt80: { min: 81 },
              gt120: { min: 121 },
              gt200: { min: 201 },
            };
            const lengthFilter = lengthFilterMap[filter.value];
            if (lengthFilter) {
              if (lengthFilter.min !== undefined) minPages = lengthFilter.min;
              if (lengthFilter.max !== undefined) maxPages = lengthFilter.max;
            }
          } else if (
            filter.id === "pagesExpr" &&
            typeof filter.value === "string"
          ) {
            const parsed = parsePagesExpression(filter.value);
            if (parsed.min !== undefined) minPages = parsed.min;
            if (parsed.max !== undefined) maxPages = parsed.max;
          }
        }
      }

      if (
        minPages !== undefined &&
        maxPages !== undefined &&
        minPages > maxPages
      ) {
        [minPages, maxPages] = [maxPages, minPages];
      }

      const pageFilterActive = minPages !== undefined || maxPages !== undefined;
      const hideReadFilter = getHideReadSetting();
      const keywordActive = keywordTerms.length > 0;
      logHitomiDebug(
        "search:start",
        `sort=${sortBy}`,
        `offset=${offset}`,
        `limit=${limit}`,
        `tags=${tags.length}`,
        `pageFilter=${pageFilterActive ? `${minPages ?? "-"}:${maxPages ?? "-"}` : "off"}`,
        `hideRead=${hideReadFilter}`,
      );

      if (sortBy.startsWith("popular")) {
        if (sortBy === "popular_today") popularityOrderBy = "day";
        else if (sortBy === "popular_week") popularityOrderBy = "week";
        else if (sortBy === "popular_month") popularityOrderBy = "month";
        else if (sortBy === "popular_year") popularityOrderBy = "year";
      }

      let candidatePoolIds: number[] = [];
      let upstreamHasMore = false;

      const languageOptions: GalleryIdOptions = {
        tags: tags.filter((t) => t.type !== "language"),
        popularityOrderBy,
        languages: languageTokens,
      };

      // Pre-filter read IDs cheaply (O(1) per ID) without any network calls.
      // This avoids loading gallery JSON just to skip already-read items.
      const preFilterReadIds = (idList: number[]): number[] => {
        if (!hideReadFilter) return idList;
        const readSet = getReadCache();
        return idList.filter((id) => !readSet.has(id.toString()));
      };

      if (sortBy === "date_published") {
        const rawIds = await this.getGalleryIdsCached({
          ...languageOptions,
          range: undefined,
          isSearch: true,
        });
        const readSet = hideReadFilter ? getReadCache() : null;
        const lookaheadEnd = Math.min(
          rawIds.length,
          Math.max(
            offset + limit,
            (offset + limit) * (pageFilterActive || keywordActive ? 2 : 1) +
            (hideReadFilter ? limit : 0),
          ),
        );
        const rawWindow = rawIds.slice(0, lookaheadEnd);
        const windowIds = readSet
          ? rawWindow.filter((id) => !readSet.has(id.toString()))
          : rawWindow;
        upstreamHasMore = rawIds.length > rawWindow.length;
        const galleries = (
          await Promise.all(
            windowIds.map(async (id) => {
              try {
                return await this.loadGalleryForBackground(id.toString());
              } catch {
                return null;
              }
            }),
          )
        ).filter((g): g is HitomiGallery => g !== null);
        galleries.sort(
          (a, b) => b.publishedDate.getTime() - a.publishedDate.getTime(),
        );
        const ordered = galleries.map((g) => g.id);
        logHitomiDebug(
          "search:date_published",
          `rawIds=${rawIds.length}`,
          `window=${rawWindow.length}`,
          `loaded=${galleries.length}`,
          `ordered=${ordered.length}`,
        );
        candidatePoolIds = preFilterReadIds(ordered);
      } else if (sortBy === "random") {
        if (
          this.randomSearchSessionQuery !== searchKey ||
          this.randomSearchSessionIds.length === 0
        ) {
          const poolIds = await this.getGalleryIdsCached({
            ...languageOptions,
            range: undefined,
            isSearch: true,
          });
          const randomPool = preFilterReadIds(poolIds);
          for (let i = randomPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [randomPool[i], randomPool[j]] = [randomPool[j], randomPool[i]];
          }
          this.randomSearchSessionQuery = searchKey;
          this.randomSearchSessionIds = randomPool;
        }

        logHitomiDebug(
          "search:random",
          `poolIds=${this.randomSearchSessionIds.length}`,
          `sessionPool=${this.randomSearchSessionIds.length}`,
        );
        candidatePoolIds = this.randomSearchSessionIds;
      } else {
        // typedOnly = all tags are positive (no negatives). For positive-only searches,
        // we skip the huge base nozomi index (not needed for intersection) and fetch
        // only the tag-specific nozomis. This fixes pagination by keeping the cache key
        // stable across pages. Neutral "tag" type works fine without the base set.
        const typedOnly = tags.length > 0 && tags.every((t) => !t.isNegative);

        const rawIds = await this.getGalleryIdsCached({
          ...languageOptions,
          range: undefined,
          isSearch: true,
        });
        logHitomiDebug(
          "search:standard",
          `rawIds=${rawIds.length}`,
          `typedOnly=${typedOnly}`,
          `popular=${popularityOrderBy ?? "none"}`,
        );
        candidatePoolIds = preFilterReadIds(rawIds);
      }

      // Ensure GG is synced once before batch processing
      await this.syncGG();

      // Abort early if a newer search has started
      if (myNonce !== this.searchNonce) {
        finishSearchWave(sortBy, 0);
        return { items: [], metadata: undefined };
      }

      const deduplicatedIds = Array.from(new Set(candidatePoolIds));
      logHitomiDebug(
        "search:render",
        `ids=${candidatePoolIds.length}`,
        `deduped=${deduplicatedIds.length}`,
        `keywordActive=${keywordActive}`,
      );

      const { items: finalItems, consumed } =
        await this.getSearchResultItemsIncremental(
          deduplicatedIds,
          offset,
          limit,
          {
            minPages,
            maxPages,
            keywordTerms,
            maxScanIds:
              pageFilterActive || keywordActive ? limit * 20 : limit * 12,
          },
        );
      const nextScanOffset = offset + consumed;
      const nextDisplayOffset = offset + finalItems.length;
      const actuallyHasMore =
        nextScanOffset < deduplicatedIds.length || upstreamHasMore;
      recordDisplayedTiles(finalItems);

      // When filtering removes all items on this page but more IDs exist upstream,
      // keep pagination alive so the framework fetches the next page instead of
      // stopping entirely. Use a wider cap because strict filters can skip many pages.
      if (finalItems.length === 0 && actuallyHasMore) {
        this.searchConsecutiveEmpty++;
      } else {
        this.searchConsecutiveEmpty = 0;
      }
      const continueOffset =
        actuallyHasMore && this.searchConsecutiveEmpty < 20;
      logHitomiDebug(
        "search:return",
        `items=${finalItems.length}`,
        `consumed=${consumed}`,
        `hasMore=${actuallyHasMore}`,
        `continueOffset=${continueOffset ? nextDisplayOffset : "none"}`,
        `elapsedMs=${Date.now() - searchStart}`,
      );

      const sortLabel = formatSearchSortLabel(sortBy);
      console.log(
        `[Hitomi] ${sortLabel} search: ${finalItems.length} items, ${Date.now() - searchStart}ms`,
      );
      finishSearchWave(sortBy, finalItems.length);
      return {
        items: finalItems,
        metadata: continueOffset
          ? buildOffsetMetadata(nextDisplayOffset, limit, nextScanOffset)
          : undefined,
      };
    } catch (e) {
      console.error("[Hitomi Search] Unexpected error", e, {
        query,
        metadata,
        sorting: sortingOption,
      });
      console.log(`[Hitomi] Search failed after ${Date.now() - searchStart}ms`);
      finishSearchWave(sortingOption?.id ?? "search", 0);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string) {
    this.markForegroundGalleryPressure();
    const gallery = await this.loadGalleryWithRetry(mangaId);
    if (this.tagData.size === 0) {
      void this.getTags({ allowPartial: true }).catch(() => {
        /* fall back to gallery-local tags if cache fetch fails */
      });
    }

    // Mark as read when viewing details if setting is enabled
    // Do this BEFORE checking isRead so the synopsis reflects the new state
    if (getHideReadSetting() && getMarkReadOnViewSetting()) {
      const tagNames = gallery.tags
        .filter(
          (t) => t.type === "tag" || t.type === "male" || t.type === "female",
        )
        .map((t) => (t.type === "tag" ? t.name : `${t.type}:${t.name}`));
      const { isFirstRead } = markMangaAsRead(
        mangaId,
        gallery.title.display || gallery.title.japanese,
        tagNames,
        { trackStats: false },
      );
      if (isFirstRead && !getDescMarkedReadIds().has(mangaId)) {
        incrementMarkReadOnDescCount();
      }
      addDescMarkedReadId(mangaId);
    }

    const isRead = getReadCache().has(mangaId);
    addToViewedHistory(mangaId);

    // Track statistics (non-blocking)
    try {
      incrementDisplayedManga(mangaId);
    } catch {
      /* stats tracking should never break main flow */
    }
    this.debouncedInvalidateSearchFilters();

    const synopsis = this.buildSynopsis(gallery, isRead);
    const primaryTitle = normalizeBridgeString(
      gallery.title?.display || gallery.title?.japanese,
      `Gallery ${mangaId}`,
    );
    const secondaryTitle = normalizeBridgeString(gallery.title?.japanese);
    const creators = getCreatorFields(gallery.artists, gallery.groups);
    const thumbnailUrl = normalizeBridgeString(
      this.getCoverImageSync(gallery),
      HitomiExtension.PLACEHOLDER_COVER,
    );

    return {
      mangaId,
      mangaInfo: {
        primaryTitle,
        secondaryTitles: secondaryTitle ? [secondaryTitle] : [],
        thumbnailUrl,
        rating: 0,
        status: "COMPLETED",
        author: normalizeBridgeString(creators.author || creators.artist || ""),
        synopsis: normalizeBridgeString(synopsis),
        contentRating: ContentRating.ADULT,
        tagGroups: this.convertTags(gallery),
        shareUrl: normalizeBridgeString(
          `https://hitomi.la/galleries/${gallery.id}.html`,
          `https://hitomi.la/galleries/${mangaId}.html`,
        ),
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    this.markForegroundGalleryPressure();
    const gallery = await this.loadGalleryWithRetry(sourceManga.mangaId);
    const isRead = getReadCache().has(sourceManga.mangaId);
    const subtitle = generateSubtitle(gallery, isRead);
    const creators = getCreatorFields(gallery.artists, gallery.groups);
    sourceManga.mangaInfo = {
      ...sourceManga.mangaInfo,
      author: normalizeBridgeString(creators.author || creators.artist || ""),
      synopsis: this.buildSynopsis(gallery, isRead),
      tagGroups: this.convertTags(gallery),
    };
    const sourceMangaWithMetadata = sourceManga as SourceManga & {
      metadata?: Record<string, unknown>;
    };
    sourceMangaWithMetadata.metadata = {
      ...(sourceMangaWithMetadata.metadata ?? {}),
      subtitle,
    };
    return [
      {
        chapterId: sourceManga.mangaId,
        volume: 0,
        chapNum: 1,
        langCode: gallery.languageName.english === "japanese" ? "jp" : "en",
        publishDate: gallery.publishedDate,
        sourceManga,
        title: gallery.title.display || gallery.title.japanese || "",
      },
    ];
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    this.markForegroundGalleryPressure();
    // Register the syncGG callback so the interceptor can refresh gg.js lazily
    // when it rewrites hitomi://image/ placeholder URLs at actual download time.
    this.requestManager.setSyncGG(() => this.syncGG());
    await this.syncGG();
    const gallery = await this.loadGalleryWithRetry(chapter.chapterId);
    const tagNames = gallery.tags
      .filter(
        (t) => t.type === "tag" || t.type === "male" || t.type === "female",
      )
      .map((t) => (t.type === "tag" ? t.name : `${t.type}:${t.name}`));
    const wasDescMarked = getDescMarkedReadIds().has(chapter.chapterId);
    markMangaAsRead(
      chapter.chapterId,
      gallery.title.display || gallery.title.japanese,
      tagNames,
      { forceFirstStatRead: wasDescMarked },
    );
    // If this manga was previously only desc-marked-read, it's now actually read
    // so remove it from the exclusion list so it appears in Related section
    removeDescMarkedReadId(chapter.chapterId);
    try {
      recordReadingSession(chapter.chapterId);
      recordPageCount(gallery.files.length);
      const contentTagNames = gallery.tags.map((t) => t.name);
      if (contentTagNames.length > 0) recordTagCounts(contentTagNames);
    } catch {
      /* stats tracking should never break chapter loading */
    }
    this.debouncedInvalidateSearchFilters();
    const pages: string[] = [];
    const preferredImageFormat = getPreferredImageFormatSetting();

    const fileCount = gallery.files.length;
    let invalidHashCount = 0;
    let placeholderCount = 0;

    for (const file of gallery.files) {
      // Skip files with invalid/missing hash to prevent Kingfisher emptyRequest errors
      if (!file.hash || file.hash.length < 3) {
        invalidHashCount++;
        console.warn(`[Hitomi] Skipping file with invalid hash: ${file.name}`);
        continue;
      }

      const extensions: ("webp" | "avif")[] = [];
      if (preferredImageFormat === "avif") {
        if (file.hasAvif) extensions.push("avif");
        if (file.hasWebp) extensions.push("webp");
      } else {
        if (file.hasWebp) extensions.push("webp");
        if (file.hasAvif) extensions.push("avif");
      }

      // Always have a fallback to webp path (uri.ts handles missing format gracefully)
      if (extensions.length === 0) {
        if (file.hasAvif) extensions.push("avif");
        else if (file.hasWebp) extensions.push("webp");
        else extensions.push("webp");
      }

      let pageUrl = await this.resolveChapterPageUrl(file, extensions);
      if (!pageUrl) {
        const fallbackExt = extensions[0] ?? "webp";
        pageUrl = `hitomi://image/${file.hash}/${fallbackExt}`;
        placeholderCount++;
      }
      pages.push(pageUrl);
    }

    logHitomiDebug(
      "chapter:pages",
      `chapter=${chapter.chapterId}`,
      `generated=${pages.length}`,
      `files=${fileCount}`,
      `invalidHashes=${invalidHashCount}`,
      `placeholders=${placeholderCount}`,
    );

    return {
      id: chapter.chapterId,
      mangaId: chapter.chapterId,
      pages,
    } satisfies ChapterDetails;
  }

  /**
   * Incrementally resolve gallery details from `ids[startOffset..]` in small
   * batches, collecting items that pass page/date filters until we reach
   * `targetCount`.  Returns the collected items AND how many IDs were consumed
   * so the caller can advance its pagination offset accurately.
   */
  async getGalleryDetailsIncremental(
    ids: number[],
    startOffset: number,
    targetCount: number,
    pageFilter?: { min?: number; max?: number; exact?: number },
    options?: { skipHideRead?: boolean; maxScanIds?: number },
  ): Promise<{
    items: DiscoverSectionItem[];
    consumed: number;
    diagnostics: {
      skippedRead: number;
      filteredByPage: number;
      failedLoads: number;
    };
  }> {
    const hideRead = options?.skipHideRead ? false : getHideReadSetting();
    const readCacheLocal = getReadCache();

    await this.syncGG();

    const items: DiscoverSectionItem[] = [];
    let consumed = 0;
    let skippedRead = 0;
    let filteredByPage = 0;
    let failedLoads = 0;
    const totalRemainingIds = Math.max(0, ids.length - startOffset);
    let scanBudget = Math.max(
      targetCount,
      Math.floor(options?.maxScanIds ?? targetCount),
    );
    const MAX_SCAN_EXPANSIONS = 2;
    let scanExpansions = 0;
    let scannedIds = 0;

    let cursor = startOffset;
    while (cursor < ids.length && items.length < targetCount) {
      if (scannedIds >= scanBudget) {
        if (
          scanExpansions >= MAX_SCAN_EXPANSIONS ||
          scanBudget >= totalRemainingIds
        ) {
          break;
        }
        scanBudget = Math.min(
          totalRemainingIds,
          scanBudget + Math.max(targetCount * 8, Math.floor(scanBudget * 1.5)),
        );
        scanExpansions++;
      }

      const remaining = targetCount - items.length;
      const remainingScanBudget = scanBudget - scannedIds;
      const batchSize = Math.max(
        1,
        Math.min(INCREMENTAL_BATCH, remaining, remainingScanBudget),
      );
      const batch = ids.slice(cursor, Math.min(cursor + batchSize, ids.length));
      consumed = cursor + batch.length - startOffset;
      scannedIds += batch.length;
      cursor += batch.length;

      const batchResults = await Promise.all(
        batch.map(async (id) => {
          try {
            if (hideRead && readCacheLocal.has(id.toString())) {
              skippedRead++;
              return null;
            }
            const gallery = await this.loadGalleryForBackground(id.toString());
            if (!gallery?.files || !Array.isArray(gallery.files)) {
              failedLoads++;
              return null;
            }
            const coverUrl = normalizeBridgeString(
              this.getCoverImageSync(gallery),
              HitomiExtension.PLACEHOLDER_COVER,
            );

            const pages = gallery.files.length;
            if (pageFilter) {
              if (
                pageFilter.exact !== undefined &&
                pages !== pageFilter.exact
              ) {
                filteredByPage++;
                return null;
              }
              if (pageFilter.min !== undefined && pages < pageFilter.min) {
                filteredByPage++;
                return null;
              }
              if (pageFilter.max !== undefined && pages > pageFilter.max) {
                filteredByPage++;
                return null;
              }
            }

            const isRead = readCacheLocal.has(id.toString());
            return {
              mangaId: normalizeBridgeString(gallery.id, id.toString()),
              title: normalizeBridgeString(
                gallery.title?.display ||
                gallery.title?.japanese ||
                `Gallery ${id}`,
                `Gallery ${id}`,
              ),
              imageUrl: coverUrl,
              subtitle: generateSubtitle(
                gallery,
                isRead,
                getRereadCount(id.toString()),
              ),
              type: "simpleCarouselItem",
            } satisfies DiscoverSectionItem;
          } catch {
            failedLoads++;
            return null;
          }
        }),
      );
      for (const r of batchResults) if (r) items.push(r);
    }

    return {
      items: items.slice(0, targetCount),
      consumed,
      diagnostics: {
        skippedRead,
        filteredByPage,
        failedLoads,
      },
    };
  }

  private async getSearchResultItemsIncremental(
    ids: number[],
    startOffset: number,
    targetCount: number,
    options?: {
      minPages?: number;
      maxPages?: number;
      keywordTerms?: string[];
      maxScanIds?: number;
    },
  ): Promise<{ items: SearchResultItem[]; consumed: number }> {
    const hideRead = getHideReadSetting();
    const readCacheLocal = getReadCache();
    const keywordTerms = options?.keywordTerms ?? [];

    const matchesKeyword = (gallery: HitomiGallery): boolean => {
      if (keywordTerms.length === 0) return true;
      const haystack = [
        gallery.title?.display,
        gallery.title?.japanese ?? undefined,
        gallery.type,
        ...gallery.artists,
        ...gallery.groups,
        ...gallery.series,
        ...gallery.characters,
        ...gallery.tags.map((tag) => tag?.name),
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .toLowerCase();

      return keywordTerms.every((term) => haystack.includes(term));
    };

    await this.syncGG();

    const items: SearchResultItem[] = [];
    let consumed = 0;
    const maxScanIds = Math.max(
      targetCount,
      Math.floor(options?.maxScanIds ?? targetCount),
    );
    let scannedIds = 0;

    let cursor = startOffset;
    while (
      cursor < ids.length &&
      items.length < targetCount &&
      scannedIds < maxScanIds
    ) {
      const remaining = targetCount - items.length;
      const remainingScanBudget = maxScanIds - scannedIds;
      const batchSize = Math.max(
        1,
        Math.min(INCREMENTAL_BATCH, remaining, remainingScanBudget),
      );
      const batch = ids.slice(cursor, Math.min(cursor + batchSize, ids.length));
      consumed = cursor + batch.length - startOffset;
      scannedIds += batch.length;
      cursor += batch.length;

      const batchResults = await Promise.all(
        batch.map(async (id): Promise<SearchResultItem | null> => {
          try {
            if (hideRead && readCacheLocal.has(id.toString())) return null;

            const gallery = await this.loadGalleryForBackground(id.toString());
            if (!gallery?.files || !Array.isArray(gallery.files)) return null;
            const coverUrl = normalizeBridgeString(
              this.getCoverImageSync(gallery),
              HitomiExtension.PLACEHOLDER_COVER,
            );

            const pageCount = gallery.files.length;
            if (
              (options?.minPages !== undefined &&
                pageCount < options.minPages) ||
              (options?.maxPages !== undefined && pageCount > options.maxPages)
            ) {
              return null;
            }
            if (!matchesKeyword(gallery)) return null;

            const isRead = readCacheLocal.has(id.toString());
            return {
              mangaId: normalizeBridgeString(gallery.id, id.toString()),
              title: normalizeBridgeString(
                gallery.title?.display ||
                gallery.title?.japanese ||
                `Gallery ${id}`,
                `Gallery ${id}`,
              ),
              imageUrl: coverUrl,
              subtitle: generateSubtitle(
                gallery,
                isRead,
                getRereadCount(id.toString()),
              ),
            };
          } catch {
            return null;
          }
        }),
      );

      for (const item of batchResults) {
        if (!item) continue;
        items.push(item);
        if (items.length >= targetCount) break;
      }
    }

    return { items: items.slice(0, targetCount), consumed };
  }

  async getRandomSection(
    metadata: { page?: number; offset?: number } | undefined,
    options?: { carousel?: boolean },
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const offset = getEffectiveScanOffset(metadata, getDiscoverPageSize());
    const limit =
      options?.carousel === false || offset > 0
        ? getDiscoverPageSize()
        : getCarouselTiles();
    const hideRead = getHideReadSetting();

    const languageTokens = mapLanguageTokens();
    const tags: HitomiTag[] = parseTagsFromQuery(getExtraArgsSetting());
    const pageFilter = parsePagesExpression(getPagesExpressionSetting());

    // Keep random pools bounded to what this page can display.
    const pageFilterActive =
      pageFilter.exact !== undefined ||
      pageFilter.min !== undefined ||
      pageFilter.max !== undefined;
    const randomSessionKey = JSON.stringify({
      tags: tags.map((t) => ({
        type: t.type,
        name: t.name,
        isNegative: !!t.isNegative,
        orGroup: t.orGroup,
        isFuzzy: !!t.isFuzzy,
        forceFuzzy: !!t.forceFuzzy,
      })),
      languages: languageTokens,
      pageFilter,
      hideRead,
    });
    const resetSession =
      offset === 0 || this.randomDiscoverSessionQuery !== randomSessionKey;
    if (resetSession) {
      this.randomDiscoverSessionQuery = randomSessionKey;
      this.randomDiscoverSessionIds = [];
      this.randomDiscoverServedIds.clear();
      this.randomDiscoverSessionFetchedCount = 0;
    }

    const requiredForPage = offset + limit;
    let poolSize = Math.max(
      limit,
      requiredForPage + (pageFilterActive || hideRead ? limit : 0),
    );
    if (this.randomDiscoverSessionFetchedCount > 0) {
      poolSize = Math.max(poolSize, this.randomDiscoverSessionFetchedCount);
    }
    logHitomiDebug(
      "random:start",
      `offset=${offset}`,
      `limit=${limit}`,
      `tags=${tags.length}`,
      `poolSize=${poolSize}`,
      `hideRead=${hideRead}`,
    );
    const readCacheLocal = hideRead ? getReadCache() : null;
    let rawIds: number[] = [];
    const maxExpansionPasses = 2;

    for (
      let expansionPass = 0;
      expansionPass <= maxExpansionPasses;
      expansionPass++
    ) {
      const expandedPoolSize =
        expansionPass === 0
          ? poolSize
          : poolSize + expansionPass * Math.max(limit, Math.floor(limit * 1.5));
      rawIds = await this.getGalleryIdsCached({
        tags,
        range:
          tags.length === 0 ? undefined : { start: 0, end: expandedPoolSize },
        languages: languageTokens,
        isSearch: tags.length > 0,
      });
      if (!Array.isArray(rawIds) || rawIds.length === 0) {
        if (expansionPass < maxExpansionPasses) {
          continue;
        }

        if (tags.length > 0) {
          rawIds = await this.getGalleryIdsCached({
            tags: [],
            range: { start: 0, end: expandedPoolSize },
            languages: languageTokens,
            isSearch: false,
          });
        }

        if (!Array.isArray(rawIds) || rawIds.length === 0) {
          return { items: [], metadata: undefined };
        }
      }

      const filteredIds = readCacheLocal
        ? rawIds.filter((id) => !readCacheLocal.has(id.toString()))
        : [...rawIds];
      const selectedIds = filteredIds.length > 0 ? filteredIds : rawIds;

      if (this.randomDiscoverSessionIds.length === 0) {
        this.randomDiscoverSessionIds = Array.from(new Set(selectedIds));
        for (let i = this.randomDiscoverSessionIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.randomDiscoverSessionIds[i], this.randomDiscoverSessionIds[j]] =
            [
              this.randomDiscoverSessionIds[j],
              this.randomDiscoverSessionIds[i],
            ];
        }
      } else {
        const existing = new Set(this.randomDiscoverSessionIds);
        const additions = Array.from(new Set(selectedIds)).filter(
          (id) => !existing.has(id),
        );
        for (let i = additions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [additions[i], additions[j]] = [additions[j], additions[i]];
        }
        this.randomDiscoverSessionIds.push(...additions);
      }
      this.randomDiscoverSessionFetchedCount = Math.max(
        this.randomDiscoverSessionFetchedCount,
        expandedPoolSize,
      );

      if (this.randomDiscoverSessionIds.length > offset) break;

      const canExpand =
        rawIds.length >= expandedPoolSize && expansionPass < maxExpansionPasses;
      if (!canExpand) {
        return { items: [], metadata: undefined };
      }
    }

    const candidateIds = this.randomDiscoverSessionIds;

    logHitomiDebug(
      "random:pool",
      `rawIds=${rawIds.length}`,
      `candidateIds=${candidateIds.length}`,
      `offset=${offset}`,
    );

    if (candidateIds.length <= offset) {
      return { items: [], metadata: undefined };
    }

    let { items, consumed, diagnostics } =
      await this.getGalleryDetailsIncremental(
        candidateIds,
        offset,
        limit,
        pageFilter,
        {
          skipHideRead: true,
          maxScanIds: pageFilterActive ? limit * 40 : limit * 24,
        },
      );

    if (items.length === 0 && offset < candidateIds.length) {
      const retry = await this.getGalleryDetailsIncremental(
        candidateIds,
        offset,
        limit,
        pageFilter,
        {
          skipHideRead: true,
          maxScanIds: pageFilterActive ? limit * 60 : limit * 40,
        },
      );
      if (retry.items.length > 0) {
        items = retry.items;
        consumed = retry.consumed;
        diagnostics = retry.diagnostics;
      }
    }

    const servedItems = items.filter(
      (
        item,
      ): item is Extract<DiscoverSectionItem, { type: "simpleCarouselItem" }> =>
        item.type === "simpleCarouselItem",
    );
    for (const item of servedItems) {
      const parsedId = Number.parseInt(item.mangaId, 10);
      if (Number.isFinite(parsedId)) this.randomDiscoverServedIds.add(parsedId);
    }

    if (items.length < limit) {
      const servedIds = this.randomDiscoverServedIds;
      const unseenIds = candidateIds.filter((id) => !servedIds.has(id));
      if (unseenIds.length > 0) {
        const topUp = await this.getGalleryDetailsIncremental(
          unseenIds,
          0,
          limit - items.length,
          pageFilter,
          {
            skipHideRead: true,
            maxScanIds: pageFilterActive ? limit * 40 : limit * 24,
          },
        );
        const topUpItems = topUp.items.filter(
          (
            item,
          ): item is Extract<
            DiscoverSectionItem,
            { type: "simpleCarouselItem" }
          > => item.type === "simpleCarouselItem",
        );
        const seenMangaIds = new Set(servedItems.map((item) => item.mangaId));
        for (const topUpItem of topUpItems) {
          if (seenMangaIds.has(topUpItem.mangaId)) continue;
          items.push(topUpItem);
          seenMangaIds.add(topUpItem.mangaId);
          const parsedId = Number.parseInt(topUpItem.mangaId, 10);
          if (Number.isFinite(parsedId))
            this.randomDiscoverServedIds.add(parsedId);
          if (items.length >= limit) break;
        }
      }
    }

    const nextScanOffset = offset + consumed;
    const nextDisplayOffset = offset + items.length;
    const hasMore =
      nextScanOffset < candidateIds.length ||
      this.randomDiscoverServedIds.size < candidateIds.length;


    logHitomiDebug(
      "random:return",
      `items=${items.length}`,
      `consumed=${consumed}`,
      `hasMore=${hasMore}`,
      `nextOffset=${offset + consumed}`,
    );
    return {
      items,
      metadata: hasMore
        ? buildOffsetMetadata(nextDisplayOffset, limit, nextScanOffset)
        : undefined,
      filteredSkipped: diagnostics.filteredByPage,
      readSkipped: diagnostics.skippedRead,
    } as PagedResults<DiscoverSectionItem> & {
      filteredSkipped: number;
      readSkipped: number;
    };
  }

  async getLastReadSection(
    metadata: { page?: number; offset?: number } | undefined,
    options?: { carousel?: boolean },
  ): Promise<PagedResults<DiscoverSectionItem>> {
    try {
      const offset = getEffectiveScanOffset(metadata, getDiscoverPageSize());
      const limit =
        options?.carousel === false || offset > 0
          ? getDiscoverPageSize()
          : getCarouselTiles();

      // Get ordered read history (newest first)
      const history = getReadCache().ordered;
      if (history.length === 0) {
        return { items: [], metadata: undefined };
      }

      if (offset >= history.length) {
        return { items: [], metadata: undefined };
      }

      await this.syncGG();

      const items: DiscoverSectionItem[] = [];
      const BATCH_SIZE = Math.max(1, Math.min(4, limit));
      let cursor = offset;
      while (cursor < history.length && items.length < limit) {
        const batch = history.slice(
          cursor,
          Math.min(cursor + BATCH_SIZE, history.length),
        );
        cursor += batch.length;
        const batchResults = await Promise.all(
          batch.map(async (id): Promise<DiscoverSectionItem | null> => {
            try {
              const gallery = await this.loadGalleryForBackground(id);
              if (!gallery) return null;
              const isRead = getReadCache().has(id);
              const subtitle = generateSubtitle(
                gallery,
                isRead,
                getRereadCount(id),
              );
              return {
                mangaId: gallery.id.toString(),
                title:
                  gallery.title?.display ||
                  gallery.title?.japanese ||
                  `Gallery ${id}`,
                subtitle,
                imageUrl: this.getCoverImageSync(gallery),
                metadata: undefined,
                type: "simpleCarouselItem",
              };
            } catch {
              // Failed to load gallery
              return null;
            }
          }),
        );
        for (const entry of batchResults) {
          if (!entry) continue;
          items.push(entry);
          if (items.length >= limit) break;
        }
      }

      const hasMore = cursor < history.length;
      recordDisplayedTiles(items);
      return {
        items,
        metadata: hasMore
          ? buildOffsetMetadata(offset + items.length, limit, cursor)
          : undefined,
      };
    } catch (e) {
      console.error("[Hitomi Last Read] Failed", e);
      return { items: [], metadata: undefined };
    }
  }

  async getDateAddedSection(
    metadata: { page?: number; offset?: number } | undefined,
    options?: { carousel?: boolean },
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const offset = getEffectiveScanOffset(metadata, getDiscoverPageSize());
    const limit =
      options?.carousel === false || offset > 0
        ? getDiscoverPageSize()
        : getCarouselTiles();
    const pageFilter = parsePagesExpression(getPagesExpressionSetting());
    const hideRead = getHideReadSetting();

    const languageTokens = mapLanguageTokens();
    const tags: HitomiTag[] = parseTagsFromQuery(getExtraArgsSetting());
    const idWindowRange =
      tags.length === 0
        ? buildIndexNozomiRange(offset, limit, {
          hideRead,
          filtered:
            pageFilter.min !== undefined || pageFilter.max !== undefined,
        })
        : undefined;

    const rawIds = await this.getGalleryIdsCached({
      tags,
      range: idWindowRange,
      languages: languageTokens,
      isSearch: tags.length > 0,
      forceRefresh: offset === 0,
    });
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return { items: [], metadata: undefined };
    }

    const readCacheLocal = hideRead ? getReadCache() : null;
    const candidateIds = readCacheLocal
      ? rawIds.filter((id) => !readCacheLocal.has(id.toString()))
      : rawIds;

    const uniqueIds = Array.from(new Set(candidateIds)).sort((a, b) => b - a);
    if (uniqueIds.length <= offset) {
      return { items: [], metadata: undefined };
    }

    // Incrementally resolve gallery details — stops as soon as we have `limit`
    // items that pass page/date filters. No more wasted gallery fetches.
    const { items, consumed, diagnostics } =
      await this.getGalleryDetailsIncremental(
        uniqueIds,
        offset,
        limit,
        pageFilter,
        {
          skipHideRead: true,
          maxScanIds:
            pageFilter.exact !== undefined ||
              pageFilter.min !== undefined ||
              pageFilter.max !== undefined
              ? limit * 12
              : limit * 8,
        },
      );
    const nextScanOffset = offset + consumed;
    const nextDisplayOffset = offset + items.length;
    const hasMore =
      nextScanOffset < uniqueIds.length ||
      (idWindowRange !== undefined &&
        rawIds.length >= idWindowRange.end - idWindowRange.start);
    recordDisplayedTiles(items);
    return {
      items,
      metadata: hasMore
        ? buildOffsetMetadata(nextDisplayOffset, limit, nextScanOffset)
        : undefined,
      filteredSkipped: diagnostics.filteredByPage,
      readSkipped: diagnostics.skippedRead,
    } as PagedResults<DiscoverSectionItem> & {
      filteredSkipped: number;
      readSkipped: number;
    };
  }

  async getDatePublishedSection(
    metadata: { page?: number; offset?: number } | undefined,
    options?: { carousel?: boolean },
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const offset = getEffectiveScanOffset(metadata, getDiscoverPageSize());
    const limit =
      options?.carousel === false || offset > 0
        ? getDiscoverPageSize()
        : getCarouselTiles();

    const languageTokens = mapLanguageTokens();
    const tags: HitomiTag[] = parseTagsFromQuery(getExtraArgsSetting());
    const pageFilter = parsePagesExpression(getPagesExpressionSetting());
    const hideRead = getHideReadSetting();
    const idWindowRange =
      tags.length === 0
        ? buildIndexNozomiRange(offset, limit, {
          hideRead,
          filtered:
            pageFilter.min !== undefined || pageFilter.max !== undefined,
        })
        : undefined;

    const rawIds = await this.getGalleryIdsCached({
      tags,
      range: idWindowRange,
      languages: languageTokens,
      isSearch: tags.length > 0,
      forceRefresh: offset === 0,
    });
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return { items: [], metadata: undefined };
    }

    const readCacheLocal = hideRead ? getReadCache() : null;
    const desiredCount = offset + limit;
    const pageFilterActive =
      pageFilter.exact !== undefined ||
      pageFilter.min !== undefined ||
      pageFilter.max !== undefined;
    const lookaheadEnd = Math.min(
      rawIds.length,
      Math.max(
        desiredCount,
        desiredCount * (pageFilterActive ? 2 : 1) + (hideRead ? limit : 0),
      ),
    );
    let candidateIds: number[] = [];
    const galleriesById = new Map<number, HitomiGallery>();
    const rawWindow = rawIds.slice(0, lookaheadEnd);
    const windowIds = readCacheLocal
      ? rawWindow.filter((id) => !readCacheLocal.has(id.toString()))
      : rawWindow;
    const galleries = await Promise.all(
      windowIds.map(async (id) => {
        try {
          return await this.loadGalleryForBackground(id.toString());
        } catch {
          return null;
        }
      }),
    );
    for (const gallery of galleries) {
      if (!gallery) continue;
      galleriesById.set(gallery.id, gallery);
    }
    const orderedIds = Array.from(galleriesById.values())
      .sort((a, b) => b.publishedDate.getTime() - a.publishedDate.getTime())
      .map((gallery) => gallery.id);
    candidateIds = orderedIds;

    if (candidateIds.length <= offset) {
      return { items: [], metadata: undefined };
    }

    const {
      items: sorted,
      consumed,
      diagnostics,
    } = await this.getGalleryDetailsIncremental(
      candidateIds,
      offset,
      limit,
      pageFilter,
      {
        skipHideRead: true,
        maxScanIds:
          pageFilter.exact !== undefined ||
            pageFilter.min !== undefined ||
            pageFilter.max !== undefined
            ? limit * 12
            : limit * 8,
      },
    );


    const nextScanOffset = offset + consumed;
    const nextDisplayOffset = offset + sorted.length;
    const hasMore =
      nextScanOffset < candidateIds.length ||
      rawIds.length > lookaheadEnd ||
      (idWindowRange !== undefined &&
        rawIds.length >= idWindowRange.end - idWindowRange.start);
    recordDisplayedTiles(sorted);
    return {
      items: sorted,
      metadata: hasMore
        ? buildOffsetMetadata(nextDisplayOffset, limit, nextScanOffset)
        : undefined,
      filteredSkipped: diagnostics.filteredByPage,
      readSkipped: diagnostics.skippedRead,
    } as PagedResults<DiscoverSectionItem> & {
      filteredSkipped: number;
      readSkipped: number;
    };
  }

  async getPopularSection(
    period: "day" | "week" | "month" | "year",
    metadata: { page?: number; offset?: number } | undefined,
    options?: { carousel?: boolean },
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const offset = getEffectiveScanOffset(metadata, getDiscoverPageSize());
    const limit =
      options?.carousel === false || offset > 0
        ? getDiscoverPageSize()
        : getCarouselTiles();
    const hideRead = getHideReadSetting();

    const languageTokens = mapLanguageTokens();
    const tags: HitomiTag[] = parseTagsFromQuery(getExtraArgsSetting());
    const pageFilter = parsePagesExpression(getPagesExpressionSetting());
    const idWindowRange = buildIndexNozomiRange(offset, limit, {
      hideRead,
      filtered: pageFilter.min !== undefined || pageFilter.max !== undefined,
    });

    const allIds = await this.getGalleryIdsCached({
      tags,
      range: idWindowRange,
      popularityOrderBy: period,
      languages: languageTokens,
      isSearch: tags.length > 0,
    });

    if (allIds.length === 0) {
      return { items: [], metadata: undefined };
    }

    const readCacheLocal = hideRead ? getReadCache() : null;
    const candidateIds = readCacheLocal
      ? allIds.filter((id) => !readCacheLocal.has(id.toString()))
      : allIds;

    if (candidateIds.length <= offset) {
      return { items: [], metadata: undefined };
    }

    // Incrementally resolve details — stops at `limit` passing items
    const { items, consumed } =
      await this.getGalleryDetailsIncremental(
        candidateIds,
        offset,
        limit,
        pageFilter,
        {
          skipHideRead: true,
          maxScanIds:
            pageFilter.exact !== undefined ||
              pageFilter.min !== undefined ||
              pageFilter.max !== undefined
              ? limit * 30
              : limit * 20,
        },
      );
    const nextScanOffset = offset + consumed;
    const nextDisplayOffset = offset + items.length;
    const hasMore =
      nextScanOffset < candidateIds.length ||
      allIds.length >= idWindowRange.end - idWindowRange.start;
    recordDisplayedTiles(items);

    return {
      items,
      metadata: hasMore
        ? buildOffsetMetadata(nextDisplayOffset, limit, nextScanOffset)
        : undefined,
    };
  }

  private async getGalleryIdsCached(
    options: GalleryIdOptions & { forceRefresh?: boolean },
  ): Promise<number[]> {
    try {
      const canUseRangedWindowFetch =
        !!options.range && (options.tags?.length ?? 0) === 0;
      const key = JSON.stringify({
        tags: (options.tags ?? []).map((t) => ({
          type: t.type,
          name: t.name,
          isNegative: !!t.isNegative,
          orGroup: t.orGroup,
          isFuzzy: !!t.isFuzzy,
          forceFuzzy: !!t.forceFuzzy,
        })),
        languages: options.languages ?? [],
        popularityOrderBy: options.popularityOrderBy ?? null,
        isSearch: options.isSearch ?? false,
        range: canUseRangedWindowFetch ? (options.range ?? null) : null,
      });
      const cached = this.idSetCache.get(key);
      let fullIds: number[];

      if (!options.forceRefresh && cached && Date.now() - cached.ts < this.IDSET_TTL) {
        fullIds = cached.ids;
      } else {
        // Deduplicate in-flight fetches: if another section is already fetching
        // the same key, reuse its promise instead of firing duplicate requests
        let pending = this.idSetPending.get(key);
        if (!pending) {
          pending = fetchGalleryIdsWithOrLogic(this, {
            ...options,
            range: canUseRangedWindowFetch ? options.range : undefined,
          });
          this.idSetPending.set(key, pending);
        }
        try {
          fullIds = await pending;
        } finally {
          this.idSetPending.delete(key);
        }
        // Only cache non-empty results to prevent poisoning from transient failures
        if (fullIds.length > 0) {
          this.idSetCache.set(key, { ids: fullIds, ts: Date.now() });
          this.saveIdSetCache();
        } else {
          // Cache empty results briefly (30s) to prevent redundant refetches
          // when parallel sections request the same genuinely-empty tag.
          // Uses a backdated ts so it expires sooner than the full IDSET_TTL.
          this.idSetCache.set(key, {
            ids: fullIds,
            ts: Date.now() - this.IDSET_TTL + 30_000,
          });
          this.saveIdSetCache();
        }
      }

      if (canUseRangedWindowFetch) {
        return fullIds;
      }

      // Apply range locally from the cached full result
      if (options.range) {
        const start = options.range.start ?? 0;
        const end = options.range.end ?? fullIds.length;
        return fullIds.slice(start, end);
      }
      return fullIds;
    } catch (e) {
      console.log("gallery id cache miss/failed", e);
      return [];
    }
  }

  private async fetchRelatedPool(
    neededCount = 20,
  ): Promise<{ id: number; tag: string; cycleIndex: number }[]> {
    try {
      // Get ordered read history (newest first)
      const history = getReadCache().ordered;

      if (!Array.isArray(history) || history.length === 0) {
        console.log("[Hitomi Related] No read history");
        return [];
      }

      // Initialize pool if needed
      if (!this.relatedPoolCache) {
        this.relatedPoolCache = [];
        this.relatedPoolLastHistoryIndex = 0;
        // Keep seenIds empty initially - we'll add base manga first, then mark as seen
        // historyIdSet is used separately to prevent base manga from appearing via relatedIds
        this.relatedPoolSeenIds = new Set<number>();
        this.relatedPoolHistoryIds = new Set<number>(
          history
            .map((hid) => parseInt(hid, 10))
            .filter((id) => !Number.isNaN(id)),
        );
      }

      // Check if we need to load more
      while (
        this.relatedPoolCache.length < neededCount &&
        this.relatedPoolLastHistoryIndex < history.length
      ) {
        await this.expandRelatedPool(history);
      }

      return this.relatedPoolCache;
    } catch (e) {
      console.error("[Hitomi] fetchRelatedPool failed", e);
      return this.relatedPoolCache ?? [];
    }
  }

  private sanitizeRelatedPool(
    value: unknown,
  ): { id: number; tag: string; cycleIndex: number }[] {
    if (!Array.isArray(value)) return [];

    const sanitized: { id: number; tag: string; cycleIndex: number }[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const obj = entry as Record<string, unknown>;

      const idNum =
        typeof obj.id === "number"
          ? obj.id
          : typeof obj.id === "string"
            ? parseInt(obj.id, 10)
            : NaN;
      if (!Number.isFinite(idNum) || idNum <= 0) continue;

      const cycleNum =
        typeof obj.cycleIndex === "number"
          ? obj.cycleIndex
          : typeof obj.cycleIndex === "string"
            ? parseInt(obj.cycleIndex, 10)
            : NaN;
      if (!Number.isFinite(cycleNum) || cycleNum < 0) continue;

      const tagValue = obj.tag;
      const tag =
        typeof tagValue === "string"
          ? tagValue
          : tagValue === undefined || tagValue === null
            ? ""
            : String(tagValue);

      sanitized.push({
        id: idNum,
        tag,
        cycleIndex: cycleNum,
      });
    }

    return sanitized;
  }

  private async expandRelatedPool(history: string[]): Promise<void> {
    const startIndex = this.relatedPoolLastHistoryIndex;
    const endIndex = Math.min(
      startIndex + this.LAZY_BATCH_SIZE,
      history.length,
    );

    if (startIndex >= history.length) {
      console.log("[Hitomi Related] All history processed");
      return;
    }



    const batch = history.slice(startIndex, endIndex);

    // Load galleries in parallel, tracking original batch position
    const galleries = await Promise.all(
      batch.map(async (hid, batchIndex) => {
        try {
          const g = await this.loadGallery(hid);
          if (!g?.id) return null;
          return {
            id: g.id,
            relatedIds: g.relatedIds ?? [],
            historyId: hid,
            batchIndex,
          };
        } catch {
          return null;
        }
      }),
    );

    // Filter valid galleries
    const validGalleries = galleries.filter(
      (
        g,
      ): g is {
        id: number;
        relatedIds: number[];
        historyId: string;
        batchIndex: number;
      } => g !== null,
    );

    // Process each gallery and add to pool
    // Use batchIndex to get correct cycle index (startIndex + batchIndex + 1)
    for (const g of validGalleries) {
      const cycleIndex = startIndex + g.batchIndex + 1;

      // Add the read manga as [rN]
      if (
        Number.isFinite(g.id) &&
        g.id > 0 &&
        !this.relatedPoolSeenIds.has(g.id)
      ) {
        this.relatedPoolCache!.push({
          id: g.id,
          tag: `[r${cycleIndex}]`,
          cycleIndex,
        });
        this.relatedPoolSeenIds.add(g.id);
      }

      // Add related items (allow duplicates across cycles, but avoid duplicates within the same base)
      let relatedCount = 0;
      const localSeen = new Set<number>();
      for (const rid of g.relatedIds) {
        if (relatedCount >= this.RELATED_PER_HISTORY) break;
        if (!Number.isFinite(rid) || rid <= 0) continue;
        if (rid === g.id) continue;
        if (this.relatedPoolSeenIds.has(rid)) continue;
        if (localSeen.has(rid)) continue;
        if (this.relatedPoolHistoryIds.has(rid)) continue;
        localSeen.add(rid);
        relatedCount++;
        this.relatedPoolCache!.push({
          id: rid,
          tag: `[${relatedCount}]`,
          cycleIndex,
        });
        this.relatedPoolSeenIds.add(rid);
      }
    }

    // IMPORTANT: Always advance to endIndex, not startIndex + validGalleries.length
    // This ensures we don't re-process failed items or get stuck in a loop
    this.relatedPoolLastHistoryIndex = endIndex;
  }

  /** Persist related pool state once (called after the expansion while-loop). */
  private persistRelatedPool(): void {
    try {
      const sanitizedPool = this.sanitizeRelatedPool(this.relatedPoolCache);
      this.relatedPoolCache = sanitizedPool;
      Application.setState(sanitizedPool, this.RELATED_POOL_STATE_KEY);
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
    // Clear in-memory cache - will rebuild lazily on next access
    this.relatedPoolCache = null;
    this.relatedPoolLastHistoryIndex = 0;
    this.relatedPoolSeenIds = new Set<number>();
    this.relatedPoolHistoryIds = new Set<number>();
    this.relatedFirstSeenPage = new Map<number, number>();

    // Clear persisted state
    try {
      Application.setState(undefined, this.RELATED_POOL_STATE_KEY);
      Application.setState(undefined, this.RELATED_POOL_HISTORY_INDEX_KEY);
      Application.setState(undefined, this.RELATED_POOL_SEEN_IDS_KEY);
    } catch {
      // Ignore
    }

    console.log("[Hitomi Related] Pool invalidated");
  }

  async getRelatedSection(
    metadata: { page?: number; offset?: number | string } | undefined,
    options?: { carousel?: boolean },
  ): Promise<PagedResults<DiscoverSectionItem>> {
    if (!getEnableRelatedSetting()) return { items: [], metadata: undefined };

    const offset = getEffectiveScanOffset(metadata, getDiscoverPageSize());
    const relatedCarouselTiles = getCarouselTiles();
    const expandedPageSize = getDiscoverPageSize();
    const limit =
      options?.carousel === false
        ? expandedPageSize
        : offset === 0
          ? relatedCarouselTiles
          : expandedPageSize;
    const minItems =
      options?.carousel === false
        ? Math.min(getCarouselTiles(), expandedPageSize)
        : relatedCarouselTiles;

    try {
      const history = getReadCache().ordered;
      if (history.length === 0) {
        console.log("[Hitomi Related] No history");
        return { items: [], metadata: undefined };
      }

      const prefetchBuffer = options?.carousel === false ? 24 : 8;
      const expandStep = options?.carousel === false ? 24 : 12;
      let neededItems = offset + limit + prefetchBuffer;
      let pool = this.sanitizeRelatedPool(
        await this.fetchRelatedPool(neededItems),
      );

      if (pool.length === 0) {
        console.log("[Hitomi Related] Empty pool");
        return { items: [], metadata: undefined };
      }

      // Apply hideReadInRelated filter while preserving [rN] cycle anchors.
      const hideReadInRelated = getHideReadInRelatedSetting();
      const readCacheLocal = hideReadInRelated ? getReadCache() : null;
      // When mark-read-on-desc is ON, exclude those manga from Related (they go to Last Read only)
      const descMarkedIds =
        getHideReadSetting() && getMarkReadOnViewSetting()
          ? getDescMarkedReadIds()
          : null;

      // Filter pool: remove over-viewed items, session-aged items, AND optionally read items
      const filterPool = (p: typeof pool) => {
        const cycleLastIndex = new Map<number, number>();
        for (let index = 0; index < p.length; index++) {
          cycleLastIndex.set(p[index].cycleIndex, index);
        }

        return p.filter((item) => {
          const tagValue = normalizeBridgeString(item.tag);
          const isBaseCycle = tagValue.startsWith("[r");
          if (
            !isBaseCycle &&
            hideReadInRelated &&
            readCacheLocal &&
            readCacheLocal.has(item.id.toString())
          )
            return false;
          if (
            !isBaseCycle &&
            descMarkedIds &&
            descMarkedIds.has(item.id.toString())
          )
            return false;
          const cycleEndIndex = cycleLastIndex.get(item.cycleIndex);
          if (
            cycleEndIndex !== undefined &&
            offset >= cycleEndIndex + RELATED_AGE_WINDOW_TILES
          )
            return false;
          return true;
        });
      };
      pool = filterPool(pool);

      const reindexBaseTags = (
        value: { id: number; tag: string; cycleIndex: number }[],
      ) => {
        let rCounter = 0;
        for (const item of value) {
          if (normalizeBridgeString(item.tag).startsWith("[r")) {
            rCounter++;
            item.tag = `[r${rCounter}]`;
          }
        }
      };
      reindexBaseTags(pool);
      const alignPoolStart = () => {
        const firstCycleStart = pool.findIndex(
          (item) => normalizeBridgeString(item.tag) === "[r1]",
        );
        if (firstCycleStart > 0) {
          pool = pool.slice(firstCycleStart);
        }
      };
      alignPoolStart();

      for (
        let tries = 0;
        tries < 3 &&
        pool.length < offset + minItems &&
        this.relatedPoolLastHistoryIndex < history.length;
        tries++
      ) {
        neededItems += expandStep;
        pool = filterPool(
          this.sanitizeRelatedPool(await this.fetchRelatedPool(neededItems)),
        );
        reindexBaseTags(pool);
        alignPoolStart();
      }

      if (
        pool.length < offset + minItems &&
        this.relatedPoolLastHistoryIndex < history.length
      ) {
        pool = filterPool(
          this.sanitizeRelatedPool(
            await this.fetchRelatedPool(
              offset + limit + prefetchBuffer + expandStep,
            ),
          ),
        );
        reindexBaseTags(pool);
        alignPoolStart();

        if (pool.length <= offset) {
          return { items: [], metadata: undefined };
        }
      }

      let cursor = Math.min(offset, pool.length);
      if (cursor >= pool.length) {
        return { items: [], metadata: undefined };
      }

      await this.syncGG();

      const items: DiscoverSectionItem[] = [];
      const displayOptions = getDisplayOptionsSetting();
      const showRelatedOrder = displayOptions.includes("show_related_order");
      const seenIds = new Set<number>();

      const loadBatchItems = async (
        batchSlice: { id: number; tag: string; cycleIndex: number }[],
      ): Promise<void> => {
        const galleryPromises = batchSlice
          .filter((item) => Number.isFinite(item.id) && item.id > 0)
          .filter((item) => !seenIds.has(item.id))
          .map(async (item) => {
            try {
              const gallery = await this.loadGallery(item.id.toString());
              return { item, gallery };
            } catch {
              return null;
            }
          });

        const results = await Promise.all(galleryPromises);
        for (const result of results) {
          if (!result) continue;
          const { item, gallery } = result;
          if (!Number.isFinite(gallery.id) || gallery.id <= 0) continue;
          if (seenIds.has(item.id)) continue;
          seenIds.add(item.id);

          const mangaId = normalizeBridgeString(gallery.id, item.id.toString());
          if (mangaId === "0") continue;

          const baseSubtitle = normalizeBridgeString(
            generateSubtitle(
              gallery,
              getReadCache().has(mangaId),
              getRereadCount(mangaId),
            ),
          );
          const orderPrefix = normalizeBridgeString(item.tag);
          const subtitle = showRelatedOrder
            ? normalizeBridgeString(
              orderPrefix
                ? `${orderPrefix} ${baseSubtitle}`.trim()
                : baseSubtitle,
            )
            : baseSubtitle;

          items.push({
            type: "simpleCarouselItem",
            mangaId,
            title: normalizeBridgeString(
              gallery.title?.display,
              normalizeBridgeString(
                gallery.title?.japanese,
                `Gallery ${mangaId}`,
              ),
            ),
            subtitle,
            imageUrl: normalizeBridgeString(
              this.getCoverImageSync(gallery),
              HitomiExtension.PLACEHOLDER_COVER,
            ),
          });

          incrementRelatedViewCount(item.id);
          if (items.length >= limit) {
            break;
          }
        }
      };

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

          neededItems += expandStep;
          pool = filterPool(
            this.sanitizeRelatedPool(await this.fetchRelatedPool(neededItems)),
          );
          reindexBaseTags(pool);
          alignPoolStart();
          expansions++;

          if (cursor >= pool.length) {
            continue;
          }
        }

        const nextCursor = Math.min(cursor + batchSize, pool.length);
        const batchSlice = pool.slice(cursor, nextCursor);
        cursor = nextCursor;
        await loadBatchItems(batchSlice);

        if (items.length >= minItems && options?.carousel !== false) {
          break;
        }
      }

      const hasMoreInPool = cursor < pool.length;
      const hasMoreHistory = this.relatedPoolLastHistoryIndex < history.length;
      const hasMore = hasMoreInPool || hasMoreHistory;
      recordDisplayedTiles(items);

      return {
        items,
        metadata: hasMore
          ? buildOffsetMetadata(offset + items.length, limit, cursor)
          : undefined,
      };
    } catch (e) {
      console.error("[Hitomi Related] Failed", e);
      return { items: [], metadata: undefined };
    }
  }

  async getTopRereadSection(
    metadata: { page?: number; offset?: number } | undefined,
    options?: { carousel?: boolean },
  ): Promise<PagedResults<DiscoverSectionItem>> {
    try {
      const offset = getEffectiveScanOffset(metadata, getDiscoverPageSize());
      const limit =
        options?.carousel === false || offset > 0
          ? getDiscoverPageSize()
          : getCarouselTiles();

      const allReread = getAllRereadManga();
      if (allReread.length === 0) {
        return { items: [], metadata: undefined };
      }

      if (offset >= allReread.length) {
        return { items: [], metadata: undefined };
      }

      await this.syncGG();

      const items: DiscoverSectionItem[] = [];
      const BATCH_SIZE = Math.max(1, Math.min(4, limit));
      let cursor = offset;
      while (cursor < allReread.length && items.length < limit) {
        const batch = allReread.slice(
          cursor,
          Math.min(cursor + BATCH_SIZE, allReread.length),
        );
        cursor += batch.length;
        const batchResults = await Promise.all(
          batch.map(async (entry): Promise<DiscoverSectionItem | null> => {
            try {
              const gallery = await this.loadGallery(entry.mangaId);
              if (!gallery) return null;
              const isRead = getReadCache().has(entry.mangaId);
              const subtitle = generateSubtitle(gallery, isRead, entry.count);
              return {
                mangaId: gallery.id.toString(),
                title:
                  gallery.title?.display ||
                  gallery.title?.japanese ||
                  entry.title ||
                  `Gallery ${entry.mangaId}`,
                subtitle,
                imageUrl: this.getCoverImageSync(gallery),
                metadata: undefined,
                type: "simpleCarouselItem",
              };
            } catch {
              return null;
            }
          }),
        );
        for (const entry of batchResults) {
          if (!entry) continue;
          items.push(entry);
          if (items.length >= limit) break;
        }
      }

      const hasMore = cursor < allReread.length;
      recordDisplayedTiles(items);
      return {
        items,
        metadata: hasMore
          ? buildOffsetMetadata(offset + items.length, limit, cursor)
          : undefined,
      };
    } catch (e) {
      console.error("[Hitomi Top Reread] Failed", e);
      return { items: [], metadata: undefined };
    }
  }

  async getGalleryDetails(
    ids: number[],
    pageFilter?: { min?: number; max?: number; exact?: number },
    options?: { skipHideRead?: boolean },
  ): Promise<DiscoverSectionItem[]> {
    const hideRead = options?.skipHideRead ? false : getHideReadSetting();
    const readCacheLocal = getReadCache();
    const results: DiscoverSectionItem[] = [];
    const BATCH_SIZE = 8;

    // Ensure GG is synced once before processing
    await this.syncGG();

    // Filter out read items first to reduce requests
    const filteredIds = hideRead
      ? ids.filter((id) => !readCacheLocal.has(id.toString()))
      : ids;

    for (let i = 0; i < filteredIds.length; i += BATCH_SIZE) {
      const batch = filteredIds.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (id) => {
          try {
            const gallery = await this.loadGalleryForBackground(id.toString());

            if (!gallery || !gallery.files || !Array.isArray(gallery.files)) {
              console.log(`[Hitomi] Invalid gallery data for id ${id}`);
              return null;
            }

            const pages = gallery.files.length;
            if (pageFilter) {
              if (pageFilter.exact !== undefined && pages !== pageFilter.exact)
                return null;
              if (pageFilter.min !== undefined && pages < pageFilter.min)
                return null;
              if (pageFilter.max !== undefined && pages > pageFilter.max)
                return null;
            }

            const isRead = readCacheLocal.has(id.toString());
            return {
              mangaId: gallery.id.toString(),
              title:
                gallery.title?.display ||
                gallery.title?.japanese ||
                `Gallery ${id}`,
              imageUrl: this.getCoverImageSync(gallery),
              subtitle: generateSubtitle(
                gallery,
                isRead,
                getRereadCount(id.toString()),
              ),
              type: "simpleCarouselItem",
            } satisfies DiscoverSectionItem;
          } catch (e) {
            console.log(`Failed to fetch gallery ${id}`, e);
            return null;
          }
        }),
      );
      for (const result of batchResults) if (result) results.push(result);
    }
    return results;
  }

  async loadGallery(id: string): Promise<HitomiGallery> {
    const cached = this.getCachedGallery(id);
    if (cached) {
      return cached;
    }
    const pending = this.galleryPending.get(id);
    if (pending) return pending;
    const fetchPromise = getGallery(id, (url) => this.fetchText(url));
    this.galleryPending.set(id, fetchPromise);
    const gallery = await fetchPromise.finally(() => {
      this.galleryPending.delete(id);
    });
    this.setCachedGallery(id, gallery);
    return gallery;
  }

  private markForegroundGalleryPressure(): void {
    this.foregroundGalleryPressureUntil = Math.max(
      this.foregroundGalleryPressureUntil,
      Date.now() + this.FOREGROUND_GALLERY_GRACE_MS,
    );
  }

  private async waitForForegroundGalleryQuiet(): Promise<void> {
    const waitMs = this.foregroundGalleryPressureUntil - Date.now();
    if (waitMs > 0) {
      await this.delay(waitMs);
    }
  }

  private async withBackgroundGallerySlot<T>(
    job: () => Promise<T>,
  ): Promise<T> {
    await this.waitForForegroundGalleryQuiet();
    if (
      this.activeBackgroundGalleryLoads >= this.MAX_BACKGROUND_GALLERY_LOADS
    ) {
      await new Promise<void>((resolve) => {
        this.pendingBackgroundGalleryResolvers.push(resolve);
      });
    }

    this.activeBackgroundGalleryLoads++;
    try {
      return await job();
    } finally {
      this.activeBackgroundGalleryLoads = Math.max(
        0,
        this.activeBackgroundGalleryLoads - 1,
      );
      const next = this.pendingBackgroundGalleryResolvers.shift();
      if (next) {
        next();
      }
    }
  }

  private async loadGalleryForBackground(id: string): Promise<HitomiGallery> {
    return this.withBackgroundGallerySlot(() => this.loadGallery(id));
  }

  private async loadGalleryWithRetry(
    id: string,
    maxAttempts = 2,
  ): Promise<HitomiGallery> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this.loadGallery(id);
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts - 1) break;
        await this.delay(150 * (attempt + 1));
      }
    }
    throw lastError;
  }

  private recordTagNozomiFetch(
    info: { type: "male" | "female" | "tag"; slug: string },
    ok: boolean,
  ): void {
    if (!ok) return;
    const { slug, type } = info;
    if (!slug) return;

    let changed = false;
    const existing = this.tagData.get(slug);
    if (!existing) {
      const ref = type === "tag" ? slug : `${type}:${slug}`;
      this.tagData.set(slug, {
        slug,
        display: formatTagTitle(slug),
        count: 0,
        ref,
        type,
      });
      changed = true;
    } else if (existing.type === "tag" && type !== "tag") {
      const ref = `${type}:${slug}`;
      this.tagData.set(slug, { ...existing, ref, type });
      changed = true;
    }

    if (type === "male" || type === "female") {
      const existingType = this.tagData.get(slug)?.type;
      if (existingType && existingType !== type && existingType !== "tag") {
        if (!this.mergedMaleFemaleTagSlugs.has(slug)) {
          this.mergedMaleFemaleTagSlugs.add(slug);
          changed = true;
        }
      }
    }

    ensureTagTypeCacheInitialized();
    if (tagTypeCache) {
      if (this.mergedMaleFemaleTagSlugs.has(slug))
        tagTypeCache.set(slug, "ambiguous");
      else tagTypeCache.set(slug, type);
    }

    if (changed) {
      try {
        Application.setState(
          Array.from(this.tagData.values()),
          TAG_CACHE_STATE_KEY,
        );
        Application.setState(
          Array.from(this.mergedMaleFemaleTagSlugs),
          MERGED_TAGS_CACHE_KEY,
        );
      } catch {
        /* ignore */
      }
    }
  }

  cacheCover(id: number, url: string) {
    if (!url) return;
    const quality = getThumbnailQualitySetting();
    const key = `${id}:${quality}`;
    this.coverCache.set(key, url);
    if (this.coverCache.size > this.coverCacheLimit) {
      const oldestKey = this.coverCache.keys().next().value;
      if (oldestKey !== undefined) this.coverCache.delete(oldestKey);
    }
  }

  async fetchText(url: string, retryCount = 0): Promise<string> {
    const MAX_RETRIES = 3;
    const request = {
      url,
      method: "GET",
      headers: {
        Referer: "https://hitomi.la/",
        "User-Agent": await Application.getDefaultUserAgent(),
      },
    } satisfies Request;

    try {
      const [response, data] = await Application.scheduleRequest(request);
      if (response.status === 403 || response.status === 503) {
        throw new CloudflareError({ url, method: "GET" });
      }
      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      // Success - gradually recover rate limit
      this.onRequestSuccess();

      return Application.arrayBufferToUTF8String(data);
    } catch (e: unknown) {
      const errorMsg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Unknown error";
      const isCancelled =
        errorMsg.toLowerCase().includes("cancelled") ||
        errorMsg.includes("-999");
      const is503 =
        errorMsg.includes("503") || errorMsg.includes("Service Unavailable");
      const is429 =
        errorMsg.includes("429") || errorMsg.includes("Too Many Requests");
      const is404 = errorMsg.includes("404") || errorMsg.includes("Not Found");

      if (isCancelled && retryCount < MAX_RETRIES) {
        const retryMs = retryCount === 0 ? 150 : 450;
        logHitomiNotice(
          "fetchText:cancelled-retry",
          `[Hitomi] Request cancelled (-999 style), retrying in ${retryMs}ms`,
          8000,
        );
        await this.delay(retryMs);
        return this.fetchText(url, retryCount + 1);
      }

      // Handle rate limiting (503/429)
      if (is503 || is429) {
        this.onRateLimitDetected();

        if (retryCount < MAX_RETRIES) {
          const backoffMs = Math.min(900, 120 * 2 ** retryCount);
          logHitomiNotice(
            "fetchText:rate-limit",
            `[Hitomi] Rate limited, retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`,
            10000,
          );
          await this.delay(backoffMs);
          return this.fetchText(url, retryCount + 1);
        }
      }

      // Handle 404 - might be stale gg.js
      if (
        is404 &&
        url.includes("gold-usergeneratedcontent.net") &&
        !url.includes("gg.js")
      ) {
        logHitomiNotice(
          "fetchText:gg-refresh",
          "[Hitomi] 404 detected, forcing gg.js refresh",
          10000,
        );
        await this.forceGGRefresh();

        if (retryCount < 1) {
          return this.fetchText(url, retryCount + 1);
        }
      }

      throw e;
    }
  }

  /**
   * Fetch binary with failure-based error handling.
   */
  async fetchBinary(
    url: string,
    headers?: Record<string, string>,
    retryCount = 0,
  ): Promise<ArrayBuffer> {
    const MAX_RETRIES = 3;
    const request = {
      url,
      method: "GET",
      headers: {
        Referer: "https://hitomi.la/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        ...(headers || {}),
      },
    } satisfies Request;

    try {
      const [response, data] = await Application.scheduleRequest(request);
      const tagInfo = parseNozomiTagFromUrl(url);
      if (response.status === 403 || response.status === 503) {
        if (tagInfo) this.recordTagNozomiFetch(tagInfo, false);
        throw new CloudflareError({ url, method: "GET" });
      }
      if (response.status >= 400) {
        if (tagInfo) this.recordTagNozomiFetch(tagInfo, false);
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      if (tagInfo) this.recordTagNozomiFetch(tagInfo, true);
      this.onRequestSuccess();
      return data;
    } catch (e: unknown) {
      const errorMsg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Unknown error";
      const isCancelled =
        errorMsg.toLowerCase().includes("cancelled") ||
        errorMsg.includes("-999");
      const is503 = errorMsg.includes("503");
      const is429 = errorMsg.includes("429");
      const is404 = errorMsg.includes("404");

      if (isCancelled && retryCount < MAX_RETRIES) {
        const retryMs = retryCount === 0 ? 150 : 450;
        logHitomiNotice(
          "fetchBinary:cancelled-retry",
          `[Hitomi] Binary request cancelled (-999 style), retrying in ${retryMs}ms`,
          8000,
        );
        await this.delay(retryMs);
        return this.fetchBinary(url, headers, retryCount + 1);
      }

      if (is503 || is429) {
        this.onRateLimitDetected();

        if (retryCount < MAX_RETRIES) {
          const backoffMs = Math.min(900, 120 * 2 ** retryCount);
          logHitomiNotice(
            "fetchBinary:rate-limit",
            `[Hitomi] Rate limited on binary fetch, retrying in ${backoffMs}ms`,
            10000,
          );
          await this.delay(backoffMs);
          return this.fetchBinary(url, headers, retryCount + 1);
        }
      }

      if (
        is404 &&
        url.includes("gold-usergeneratedcontent.net") &&
        !url.includes(".nozomi")
      ) {
        logHitomiNotice(
          "fetchBinary:gg-refresh",
          "[Hitomi] 404 on binary fetch, forcing gg.js refresh",
          10000,
        );
        await this.forceGGRefresh();

        if (retryCount < 1) {
          return this.fetchBinary(url, headers, retryCount + 1);
        }
      }

      throw e;
    }
  }

  private onRequestSuccess(): void {
    if (this.consecutiveFailures > 0) {
      this.consecutiveFailures = Math.max(0, this.consecutiveFailures - 1);
    }

    // Gradually restore rate multiplier after sustained success
    if (
      this.currentRateMultiplier < 1.0 &&
      Date.now() - this.lastFailureTime > this.RATE_RECOVERY_DELAY
    ) {
      this.currentRateMultiplier = Math.min(
        1.0,
        this.currentRateMultiplier + 0.15,
      );
    }
  }

  private onRateLimitDetected(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    // Exponentially reduce rate on consecutive failures
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.currentRateMultiplier = Math.max(
        0.25,
        this.currentRateMultiplier * 0.5,
      );
      logHitomiNotice(
        "hitomi:rate-limit-reduced",
        `[Hitomi] Rate limit detected, reducing rate to ${(this.currentRateMultiplier * 100).toFixed(0)}%`,
        10000,
      );
    }
  }

  private async forceGGRefresh(): Promise<void> {
    if (this.ggRefreshInProgress) return;

    this.ggRefreshInProgress = true;
    ImageUriResolver.invalidate(); // Force re-sync

    try {
      await this.syncGG();
    } finally {
      this.ggRefreshInProgress = false;
    }
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }
    return Application.sleep(ms / 1000);
  }

  private async resolveChapterPageUrl(
    file: HitomiFile,
    extensions: ("webp" | "avif")[],
  ): Promise<string> {
    const attempts = ImageUriResolver.needsSync() ? 2 : 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      for (const ext of extensions) {
        try {
          const resolved = ImageUriResolver.getImageUri(file, ext, {
            isThumbnail: false,
          });
          if (resolved && resolved.startsWith("https://")) {
            return resolved;
          }
        } catch {
          // Try the next extension, then refresh gg.js below if needed.
        }
      }

      if (attempt < attempts - 1) {
        ImageUriResolver.invalidate();
        await this.syncGG();
      }
    }

    return "";
  }

  async syncGG(): Promise<void> {
    // Only sync if needed and avoid duplicate in-flight syncs
    if (!ImageUriResolver.needsSync()) {
      return;
    }
    if (this.ggSyncPromise) {
      return this.ggSyncPromise;
    }

    this.ggSyncPromise = (async () => {
      const now = Date.now();
      if (
        this.lastGgSyncAt > 0 &&
        now - this.lastGgSyncAt < this.GG_SYNC_MIN_INTERVAL_MS &&
        !ImageUriResolver.needsSync()
      ) {
        return;
      }
      try {
        // Add cache-busting query parameter to ensure fresh fetch
        const cacheBuster = Date.now();
        const url = `https://ltn.gold-usergeneratedcontent.net/gg.js?_=${cacheBuster}`;
        const ggScript = await this.fetchGGScript(url);
        ImageUriResolver.parseGG(ggScript);
        this.lastGgSyncAt = Date.now();
      } catch (e) {
        console.log("[Hitomi] syncGG: FAILED to fetch/parse gg.js:", e);
        // DO NOT mark as synced on failure - next request will try again
        // DO NOT call parseGG with empty string - that would fail anyway
        throw e;
      } finally {
        this.ggSyncPromise = null;
      }
    })();

    return this.ggSyncPromise;
  }

  /**
   * Fetch gg.js with browser-like headers.
   * The server uses header-based content negotiation and returns different
   * versions of gg.js depending on the User-Agent and Referer headers.
   */
  private async fetchGGScript(url: string): Promise<string> {
    const request = {
      url,
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        Referer: "https://hitomi.la/",
      },
    } satisfies Request;

    const [, data] = await Application.scheduleRequest(request);
    this.onRequestSuccess();
    return Application.arrayBufferToUTF8String(data);
  }



  // Placeholder for items where cover URL cannot be resolved yet (GG.js not synced)
  private static readonly PLACEHOLDER_COVER = "https://hitomi.la/favicon.ico";

  getCoverImageSync(gallery: HitomiGallery): string {
    const quality = getThumbnailQualitySetting();
    const preferredImageFormat = getPreferredImageFormatSetting();
    const cacheKey = `${gallery.id}:${quality}`;
    const cached = this.coverCache.get(cacheKey);
    if (cached) {
      // LRU: move to end of Map iteration order
      this.coverCache.delete(cacheKey);
      this.coverCache.set(cacheKey, cached);
      return cached;
    }

    // Add defensive checks
    if (!gallery || !gallery.files || gallery.files.length === 0)
      return HitomiExtension.PLACEHOLDER_COVER;

    const file = gallery.files[0];
    const hash = normalizeBridgeString(file?.hash).trim();
    if (!hash || hash.length < 8) {
      return HitomiExtension.PLACEHOLDER_COVER;
    }

    const extCandidates: string[] = [];
    if (preferredImageFormat === "avif") {
      if (file.hasAvif) extCandidates.push("avif");
      if (file.hasWebp) extCandidates.push("webp");
    } else {
      if (file.hasWebp) extCandidates.push("webp");
      if (file.hasAvif) extCandidates.push("avif");
    }
    if (extCandidates.length === 0) {
      extCandidates.push("webp");
    }

    const uniqueExtCandidates = Array.from(new Set(extCandidates));

    // If GG isn't synced yet, use a placeholder URL which the interceptor
    // can rewrite once gg.js is refreshed. This avoids empty/invalid requests.
    const thumbSize = quality === "low" ? "small" : "big";
    const placeholderUrl = `hitomi://thumb/${hash}/${uniqueExtCandidates[0]}/${thumbSize}`;
    if (ImageUriResolver.needsSync()) {
      return placeholderUrl;
    }

    // Always use thumbnails for covers - "high" means big thumbnail, "low" means small thumbnail
    // Never load full images as covers (too slow and unnecessary)
    let attempts: { isThumbnail: boolean; isSmall: boolean }[] = [];
    if (quality === "high") {
      // High quality = big thumbnail first, then small as fallback
      attempts = [
        { isThumbnail: true, isSmall: false },
        { isThumbnail: true, isSmall: true },
      ];
    } else if (quality === "low") {
      // Low quality = small thumbnail first, then big as fallback
      attempts = [
        { isThumbnail: true, isSmall: true },
        { isThumbnail: true, isSmall: false },
      ];
    } else {
      // Default = big thumbnail first
      attempts = [
        { isThumbnail: true, isSmall: false },
        { isThumbnail: true, isSmall: true },
      ];
    }

    for (const ext of uniqueExtCandidates) {
      for (const opts of attempts) {
        try {
          const url = ImageUriResolver.getImageUri(file, ext, opts);
          if (!url || !url.startsWith("https://")) continue;
          this.cacheCover(gallery.id, url);
          return url;
        } catch {
          continue;
        }
      }
    }
    return placeholderUrl;
  }

  async getCoverImage(gallery: HitomiGallery): Promise<string> {
    await this.syncGG();
    return this.getCoverImageSync(gallery);
  }

  convertTags(gallery: HitomiGallery): TagSection[] {
    const sections: TagSection[] = [];
    const displayOptions = getDisplayOptionsSetting();
    const parodiesInDesc = displayOptions.includes("parodies_bottom");
    const buildId = (type: string, name: string) => {
      const safeName = name.replace(/[^a-zA-Z0-9]/g, "_");
      return `${type}_${safeName}`;
    };

    if (!gallery || !gallery.tags) {
      console.log("[Hitomi] convertTags: Invalid gallery or tags");
      return sections;
    }

    // Separate type tags (doujinshi, manga, etc.) from regular tags
    const typeTags: HitomiTag[] = [];
    const regularTags: HitomiTag[] = [];

    {
      const promoted =
        this.descriptionTagMap.get(gallery.id) ?? new Set<string>();
      const filteredTags = gallery.tags
        .filter((tag) => tag.type !== "language")
        .filter((tag) => {
          const slug = normalizeTagSlug(cleanTagName(tag.name));
          if (promoted.has(slug)) return false;
          if (isUglyConventionTag(slug)) return false;
          // Only exclude series/character from tags if they're shown in description
          if (parodiesInDesc && ["series", "character"].includes(tag.type))
            return false;
          if (["group", "artist"].includes(tag.type)) return false;
          return true;
        });

      // Split into type tags and regular tags
      for (const tag of filteredTags) {
        if (tag.type === "type" || this.isTypeTag(tag, gallery.type)) {
          typeTags.push(tag);
        } else {
          regularTags.push(tag);
        }
      }

      const sortedTags = this.sortTags(regularTags);
      const contentTags: HitomiTag[] = [];
      const technicalTags: HitomiTag[] = [];
      for (const tag of sortedTags) {
        if (this.isTechnicalTag(tag)) technicalTags.push(tag);
        else contentTags.push(tag);
      }
      const reorderedTags = [...contentTags, ...technicalTags];
      if (reorderedTags.length > 0) {
        // Deduplicate by slug (male/female same-slug tags should appear only once)
        const seenSlugs = new Set<string>();
        const dedupedTags = reorderedTags.filter((tag) => {
          const slug = normalizeTagSlug(cleanTagName(tag.name));
          if (seenSlugs.has(slug)) return false;
          seenSlugs.add(slug);
          return true;
        });
        sections.push({
          id: "tags",
          title: "Tags",
          tags: dedupedTags.map((tag) => {
            const cleaned = cleanTagName(tag.name);
            const slug = normalizeTagSlug(cleaned);
            return { id: buildId(tag.type, slug), title: formatTagTitle(slug) };
          }),
        });
      }
    }

    // Only show Series/Characters in scroller if NOT shown in description
    if (!parodiesInDesc && gallery.series.length > 0) {
      sections.push({
        id: "series",
        title: "Series",
        tags: gallery.series.map((x) => ({
          id: buildId("series", x),
          title: x,
        })),
      });
    }

    if (!parodiesInDesc && gallery.characters.length > 0) {
      sections.push({
        id: "character",
        title: "Characters",
        tags: gallery.characters.map((x) => ({
          id: buildId("character", x),
          title: x,
        })),
      });
    }

    if (gallery.artists.length > 0) {
      const uniqueArtists = [...new Set(gallery.artists)];
      sections.push({
        id: "artist",
        title: "Artists",
        tags: uniqueArtists.map((x) => ({
          id: buildId("artist", x),
          title: x,
        })),
      });
    }

    if (gallery.groups.length > 0) {
      const uniqueGroups = [...new Set(gallery.groups)];
      sections.push({
        id: "group",
        title: "Groups",
        tags: uniqueGroups.map((x) => ({
          id: buildId("group", x),
          title: x,
        })),
      });
    }

    // Types section at the end (doujinshi, manga, artistcg, etc.)
    if (typeTags.length > 0) {
      sections.push({
        id: "type",
        title: "Type",
        tags: typeTags.map((tag) => {
          const cleaned = cleanTagName(tag.name);
          const slug = normalizeTagSlug(cleaned);
          return { id: buildId("type", slug), title: formatTagTitle(slug) };
        }),
      });
    }

    // Keep "Original" in scroller at the end when series are shown in description
    if (parodiesInDesc) {
      const originalSeries = gallery.series.filter(
        (x) => x.trim().toLowerCase() === "original",
      );
      if (originalSeries.length > 0) {
        sections.push({
          id: "series",
          title: "Series",
          tags: originalSeries.map((x) => ({
            id: buildId("series", x),
            title: x,
          })),
        });
      }
    }

    if (!displayOptions.includes("desc_show_date")) {
      const d = gallery.publishedDate;
      const dateLabel = formatDateByPattern(d, getDateFormatSetting());
      const hrs = d.getHours();
      const mins = d.getMinutes().toString().padStart(2, "0");
      const period = hrs >= 12 ? "PM" : "AM";
      const hour12 = ((hrs + 11) % 12) + 1;
      sections.push({
        id: "date_added",
        title: "Date",
        tags: [
          {
            id: `date_${gallery.id}`,
            title: `${dateLabel} @ ${hour12}:${mins}${period}`,
          },
        ],
      });
    }

    if (!displayOptions.includes("show_manga_id_in_description")) {
      sections.push({
        id: "gallery_id",
        title: "ID",
        tags: [{ id: `id_${gallery.id}`, title: gallery.id.toString() }],
      });
    }

    const artistSections = sections.filter(
      (section) => section.id === "artist" || section.id === "group",
    );
    if (artistSections.length > 0) {
      const nonArtistSections = sections.filter(
        (section) => section.id !== "artist" && section.id !== "group",
      );
      const idTarget = nonArtistSections.findIndex(
        (section) => section.id === "gallery_id",
      );
      if (idTarget >= 0) {
        nonArtistSections.splice(idTarget, 0, ...artistSections);
      } else {
        nonArtistSections.push(...artistSections);
      }
      return nonArtistSections;
    }

    return sections;
  }

  // Check if tag represents a gallery type (doujinshi, manga, artistcg, etc.)
  isTypeTag(tag: HitomiTag, galleryType: string): boolean {
    const name = tag.name.toLowerCase().replace(/ /g, "_");
    const typeNames = [
      "doujinshi",
      "manga",
      "artistcg",
      "artist_cg",
      "gamecg",
      "game_cg",
      "anime",
      "imageset",
      "image_set",
    ];
    if (typeNames.includes(name)) return true;
    if (galleryType && name === galleryType.toLowerCase()) return true;
    if (galleryType === "artistcg" && name === "artist_cg") return true;
    if (galleryType === "gamecg" && name === "game_cg") return true;
    return false;
  }

  sortTags(tags: HitomiTag[]): HitomiTag[] {
    if (!tags || tags.length === 0) return [];
    if (this.tagData.size === 0) return tags;
    const known: HitomiTag[] = [];
    const unknown: HitomiTag[] = [];
    for (const tag of tags) {
      const slug = normalizeTagSlug(cleanTagName(tag.name));
      if (this.tagData.has(slug)) known.push(tag);
      else unknown.push(tag);
    }
    known.sort((a, b) => {
      const slugA = normalizeTagSlug(cleanTagName(a.name));
      const slugB = normalizeTagSlug(cleanTagName(b.name));
      const countA = this.tagData.get(slugA)?.count ?? 0;
      const countB = this.tagData.get(slugB)?.count ?? 0;
      return countB - countA;
    });
    return [...known, ...unknown];
  }

  isTechnicalTag(tag: HitomiTag): boolean {
    const name = tag.name.toLowerCase().replace(/ /g, "_");
    // Note: type tags (doujinshi, manga, etc.) are handled separately by isTypeTag
    // This function now only handles other technical/meta tags
    if (name.endsWith("_censorship")) return true;
    if (name.includes("translation") || name === "translated") return true;
    const meta = [
      "sample",
      "speechless",
      "image_set",
      "variant_set",
      "rewrite",
      "webtoon",
    ];
    return meta.includes(name);
  }

  buildSynopsis(gallery: HitomiGallery, isRead: boolean): string {
    const displayOptions = getDisplayOptionsSetting();
    const { langCode } = buildLanguageParts(gallery);
    const pages = gallery.files.length;
    const rereadCount = getRereadCount(gallery.id.toString());
    const showReread = rereadCount > 1;
    const d = gallery.publishedDate;
    const dateFormat = getDateFormatSetting();
    const dateString = formatDateByPattern(d, dateFormat);
    const hrs = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, "0");
    const period = hrs >= 12 ? "PM" : "AM";
    const hour12 = ((hrs + 11) % 12) + 1;
    const timeString = `${hour12}:${mins}${period}`;
    const showReadLetter = displayOptions.includes("hide_read_letter"); // Note: Despite the name, this now means "show" when present
    const showPageCount = displayOptions.includes("show_page_count");
    const pagesPart = showReread
      ? `${rereadCount}r${pages}p`
      : `${isRead && showReadLetter ? "r" : ""}${pages}p`;
    const headerParts = [langCode];
    if (showPageCount) headerParts.push(pagesPart);

    if (displayOptions.includes("desc_show_date")) {
      if (dateString) headerParts.push(`${dateString} @ ${timeString}`);
      else headerParts.push(`@ ${timeString}`);
    }
    if (displayOptions.includes("desc_relative_date")) {
      const relativeStr = relativeDateString(d);
      if (relativeStr) headerParts.push(relativeStr);
    }

    if (displayOptions.includes("show_manga_id_in_description")) {
      headerParts.push(gallery.id.toString());
    }

    const removeSpaces = getRemoveSeparatorSpacesSetting();
    const headerSeparator = removeSpaces ? "|" : " | ";
    const headerLine = headerParts.join(headerSeparator);
    const rawTags = gallery.tags.filter((t) =>
      ["tag", "male", "female"].includes(t.type),
    );
    const sorted = this.sortTags(rawTags);
    const seen = new Set<string>();
    const tagObjs: { slug: string; tag: HitomiTag; count: number }[] = [];
    for (const t of sorted) {
      const slug = normalizeTagSlug(cleanTagName(t.name));
      if (!slug || this.isTechnicalTag(t)) continue;
      if (isUglyConventionTag(slug)) continue;
      if (!seen.has(slug)) {
        seen.add(slug);
        const count = this.tagData.get(slug)?.count ?? 0;
        tagObjs.push({ slug, tag: t, count });
      }
    }

    // Include all tag types (male/female/tag), sorted by popularity
    // Show roughly half in description, half stays in the tag scroller (max 15 in desc)
    const sortedTags = tagObjs.sort((a, b) => b.count - a.count);
    const totalTags = sortedTags.length;
    const promoteEnabled = getAddTagsToDescriptionSetting();

    // Tag distribution: scroller capped at 5 until description reaches 15
    //   ≤4:  all in description, 0 scroller
    //   5:   1 in scroller
    //   6-8: scroller = total-5 (1,2,3)
    //   9-20: scroller = min(5, floor(total*0.4))
    //   >20: scroller = total-15 (description capped at 15)
    let promoteCount = 0;
    if (promoteEnabled) {
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
      promoteCount = totalTags - scrollerCount;

      // If any would-be scroller tag has a long name (>14 chars), cap scroller at 4
      // Only apply when scroller already has >= 3 tags to avoid collapsing small scrollers
      if (scrollerCount >= 3 && scrollerCount > 4) {
        const scrollerTags = sortedTags.slice(promoteCount);
        if (scrollerTags.some((x) => formatTagTitle(x.slug).length > 14)) {
          scrollerCount = 4;
          promoteCount = totalTags - scrollerCount;
        }
      }
      // Hard cap: description never receives more than 15 tags regardless of formula
      if (promoteCount > 15) {
        promoteCount = 15;
      }
    }

    const promotedTags = sortedTags.slice(0, promoteCount);
    const promotedSlugs = new Set(promotedTags.map((x) => x.slug));
    this.descriptionTagMap.set(gallery.id, promotedSlugs);
    if (this.descriptionTagMap.size > this.descriptionTagMapLimit) {
      const oldestKey = this.descriptionTagMap.keys().next().value;
      if (oldestKey !== undefined) this.descriptionTagMap.delete(oldestKey);
    }

    const lines: string[] = [headerLine];
    const parodyLines: string[] = [];
    const seriesForDescription = gallery.series.filter(
      (x) => x.trim().toLowerCase() !== "original",
    );
    if (seriesForDescription.length > 0)
      parodyLines.push(`Series: ${seriesForDescription.join(", ")}`);
    if (gallery.characters.length > 0)
      parodyLines.push(`Characters: ${gallery.characters.join(", ")}`);

    if (promotedTags.length > 0) {
      const promotedLine = promotedTags
        .map((x) => formatTagTitle(x.slug))
        .join(", ");
      lines.push(promotedLine);
    }

    const listParodiesInDesc = displayOptions.includes("parodies_bottom");
    if (listParodiesInDesc && parodyLines.length > 0)
      lines.push(...parodyLines);
    return lines.join("\n");
  }
}

export const Hitomi = new HitomiExtension();
