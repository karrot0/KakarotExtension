export interface NovelFireMetadata {
  page?: number;
  collectedIds?: string[];
  searchCollectedIds?: string[];
}

export interface NovelFireSearchMeta {
  genre: string;
  sort: string;
  status: string;
}

export const GENRES = [
  { id: "genre-all", label: "All" },
  { id: "genre-action", label: "Action" },
  { id: "genre-adventure", label: "Adventure" },
  { id: "genre-comedy", label: "Comedy" },
  { id: "genre-drama", label: "Drama" },
  { id: "genre-fantasy", label: "Fantasy" },
  { id: "genre-horror", label: "Horror" },
  { id: "genre-josei", label: "Josei" },
  { id: "genre-martial-arts", label: "Martial Arts" },
  { id: "genre-mature", label: "Mature" },
  { id: "genre-mecha", label: "Mecha" },
  { id: "genre-mystery", label: "Mystery" },
  { id: "genre-psychological", label: "Psychological" },
  { id: "genre-romance", label: "Romance" },
  { id: "genre-school-life", label: "School Life" },
  { id: "genre-sci-fi", label: "Sci-Fi" },
  { id: "genre-seinen", label: "Seinen" },
  { id: "genre-shoujo", label: "Shoujo" },
  { id: "genre-shounen", label: "Shounen" },
  { id: "genre-slice-of-life", label: "Slice of Life" },
  { id: "genre-sport", label: "Sport" },
  { id: "genre-supernatural", label: "Supernatural" },
  { id: "genre-tragedy", label: "Tragedy" },
  { id: "genre-wuxia", label: "Wuxia" },
  { id: "genre-xianxia", label: "Xianxia" },
  { id: "genre-xuanhuan", label: "Xuanhuan" },
];

export const SORTS = [
  { id: "sort-latest-release", label: "Latest Release" },
  { id: "sort-popular", label: "Popular" },
  { id: "sort-new", label: "New" },
];

export const STATUSES = [
  { id: "status-all", label: "All" },
  { id: "status-ongoing", label: "Ongoing" },
  { id: "status-completed", label: "Completed" },
];

export interface NovelFireResult {
  status: number;
  result: { html: string; title_format?: string };
}

export interface NovelFirePageResponse {
  status: number;
  result: { content: string };
}

export interface NovelFireFilterOption {
  id: string;
  name: string;
  type: "type" | "genres";
}

export interface NovelFireSearchFilter {
  id: string;
  value: string;
}