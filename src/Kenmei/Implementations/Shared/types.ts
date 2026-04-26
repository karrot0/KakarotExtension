// ────────────────────────────────────────────────────────
// Kenmei API Types
// ────────────────────────────────────────────────────────

// Auth
export interface KenmeiLoginResponse {
  access: string;
  refresh?: string;
  user_id: number;
  username: string;
  avatar: KenmeiImageVariants;
  banner: KenmeiImageVariants;
  email: string;
  unconfirmedEmail: string | null;
  role: string;
  features: string[];
  hasEntries: boolean;
  hasTags: boolean;
  premium: {
    tier: string | null;
    isPastDue: boolean;
    isActive: boolean;
    hasAccount: boolean;
  };
  termsAccepted: boolean;
  privacy_level: string;
  themePreference: string;
  themeMode: string;
}

// Shared image variant types
export interface KenmeiImageSet {
  large: string;
  small: string;
}

export interface KenmeiImageVariants {
  webp: KenmeiImageSet | null;
  jpeg: KenmeiImageSet | null;
  gif?: KenmeiImageSet | null;
}

export interface KenmeiCover {
  webp: KenmeiImageSet | null;
  jpeg: KenmeiImageSet | null;
  twitter: string | null;
  open_graph: string | null;
}

// Search
export interface KenmeiSearchResult {
  id: number;
  url: string;
  slug: string;
  score: string;
  title: string;
  contentType: string;
  highlighted: string;
  highlightedTitle: string;
  alternativeTitles: string[];
  usersTracking: number;
  chapterCount: number;
  entryExists: boolean;
  existingEntry: KenmeiEntry | null;
  cover: KenmeiCover;
}

export interface KenmeiPagy {
  count: number;
  from: number;
  next: number | null;
  page: number;
  pages: number;
  prev: number | null;
  scaffold_url: string;
  series: (string | number)[];
  to: number;
}

export interface KenmeiSearchResponse {
  data: KenmeiSearchResult[];
  pagy: KenmeiPagy;
}

// Series detail
export interface KenmeiScoreDistribution {
  [score: string]: number;
}

export interface KenmeiClassification {
  category: string;
  name: string;
}

export interface KenmeiChapterInfo {
  id: number;
  url: string;
  volume: number | null;
  chapter: number;
  title: string;
  locked: boolean | null;
  chapterIdentifier: string;
  releasedAt: string;
}

export interface KenmeiMangaSource {
  id: number;
  manga_series_id: number;
  name: string;
  seriesURL: string;
  deprecated: boolean;
  siteActive: boolean;
  regionLocked: boolean;
  siteType: number;
  siteId: number;
  chaptersCount: number;
  latestChapter: KenmeiChapterInfo | null;
  firstChapter: KenmeiChapterInfo | null;
}

export interface KenmeiMangaSeries {
  id: number;
  url: string;
  slug: string;
  title: string;
  score: string;
  scoreDistribution: KenmeiScoreDistribution;
  titleEN: string | null;
  titleENJP: string | null;
  contentType: string;
  contentRating: string;
  publicationStatus: string;
  classifications: KenmeiClassification[];
  description: string;
  malID: number | null;
  mangaSources: KenmeiMangaSource[];
  alternativeTitles: string[];
  usersTracking: number;
  chaptersCount: number;
  cover: KenmeiCover;
  topListings: string[];
}

export interface KenmeiMangaSeriesResponse {
  data: KenmeiMangaSeries;
}

// User library entry (used by progress)
export interface KenmeiEntry {
  id: number;
  manga_series_id: number;
  status: KenmeiReadStatus;
  chaptersRead: number;
  volumesRead: number | null;
  score: number | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type KenmeiReadStatus =
  | "reading"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_read";

export const KENMEI_READ_STATUS_LABELS: Record<KenmeiReadStatus, string> = {
  reading: "Reading",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
  plan_to_read: "Plan to Read",
};

// Session stored in secure state
export interface KenmeiSession {
  accessToken: string;
  refreshToken?: string;
  /** Unix epoch seconds — when the access token expires (decoded from JWT). */
  expiresAt?: number;
  userId: number;
  username: string;
}

export interface KenmeiUserProfile {
  id: number;
  username: string;
  hasPremium: boolean;
  counts: {
    status: Record<string, number>;
    contentType: Record<string, number>;
    classifications: Record<string, number>;
  };
}

// Entry upsert payload
export interface KenmeiEntryPayload {
  manga_list_entry: {
    manga_series_id: number;
    status?: KenmeiReadStatus;
    chapters_read?: number;
    volumes_read?: number | null;
    score?: number | null;
    notes?: string | null;
  };
}

// Entry list response (GET /api/v1/manga_list_entries/{id} etc.)
export interface KenmeiEntryResponse {
  data: KenmeiEntry;
}

// ── v2 entry API ─────────────────────────────────────────────────────────────

// Numeric status codes used by v2 API
export type KenmeiReadStatusCode = 1 | 2 | 3 | 4 | 5;

export const KENMEI_STATUS_CODES: Record<KenmeiReadStatusCode, KenmeiReadStatus> = {
  1: "reading",
  2: "completed",
  3: "on_hold",
  4: "dropped",
  5: "plan_to_read",
};

export const KENMEI_STATUS_TO_CODE: Record<KenmeiReadStatus, KenmeiReadStatusCode> = {
  reading: 1,
  completed: 2,
  on_hold: 3,
  dropped: 4,
  plan_to_read: 5,
};

export interface KenmeiEntryV2ChapterRef {
  id?: number;
  url?: string;
  volume: number | null;
  chapter: number;
  title: string;
  locked?: boolean;
  chapterIdentifier?: string;
  releasedAt?: string;
  index?: number;
}

export interface KenmeiEntryV2ChaptersInfo {
  count: number;
  chaptersBehind: number;
  page: number;
  pages: number;
  from: KenmeiEntryV2ChapterRef | null;
  next: KenmeiEntryV2ChapterRef | null;
  prev: KenmeiEntryV2ChapterRef | null;
  last: KenmeiEntryV2ChapterRef | null;
  chapters: KenmeiEntryV2ChapterRef[];
}

export interface KenmeiEntryV2Attributes {
  title: string;
  cover: KenmeiImageVariants;
  status: number;
  hidden: boolean;
  favourite: boolean;
  unread: boolean;
  notes: string;
  score: number;
  last_read_at: string | null;
  createdAt: string;
  latestChapter: KenmeiChapterInfo | null;
  contentRating: string;
}

export interface KenmeiEntryV2 {
  id: number;
  slug: string;
  manga_source_id: number;
  manga_series_id: number;
  user_tag_ids: number[];
  attributes: KenmeiEntryV2Attributes;
  links: {
    series_url: string;
    manga_series_url: string;
  };
  chapters: KenmeiEntryV2ChaptersInfo;
  readChapter: { volume: number | null; chapter: number; title: string } | null;
  mangaSourceChapter: KenmeiChapterInfo | null;
}

export interface KenmeiEntryV2Response {
  data: KenmeiEntryV2;
}

export interface KenmeiLibraryResponse {
  entries: KenmeiEntryV2[];
  pagy: KenmeiPagy;
}

// ── manga_sources / manga_source_chapters ─────────────────────────────────────

export interface KenmeiMangaSourceEntry {
  id: number;
  manga_series_id: number;
  name: string;
  seriesURL: string;
  deprecated: boolean;
  siteActive: boolean;
  regionLocked: boolean;
  siteType: number;
  siteId: number;
  chaptersCount: number;
  latestChapter: KenmeiChapterInfo | null;
  firstChapter: KenmeiChapterInfo | null;
}

export interface KenmeiMangaSourcesResponse {
  data: KenmeiMangaSourceEntry[];
}

export interface KenmeiSourceChapter {
  id: number;
  url: string;
  volume: number | null;
  chapter: number;
  title: string | null;
  locked: boolean;
  chapterIdentifier: string;
  releasedAt: string;
}

export interface KenmeiSourceChaptersResponse {
  data: KenmeiSourceChapter[];
}
