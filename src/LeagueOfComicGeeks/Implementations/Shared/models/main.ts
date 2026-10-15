export interface LOFCGSession {
  username: string;
  userId: string;
}

export interface LOFCGComicSeries {
  id: string;
  name: string;
  url: string;
  cover: string | null;
  publisher: string;
  issueCount: number;
}

export interface LOFCGComicIssue {
  id: string;
  variantId: string | null;
  name: string;
  url: string;
  cover: string | null;
  publisher: string;
  releaseDate: string;
  description: string;
}

export type LOFCGListType = "series" | "issue" | "thumbs";

export interface LOFCGGetComicsParams {
  list: string | number;
  list_option?: LOFCGListType;
  user_id?: string;
  view?: string;
  order?: string;
  title?: string;
  date?: string;
  date_type?: string;
  page?: number;
  per_page?: number;
}

export const LIST_IDS = {
  PULL_LIST: 1,
  COLLECTION: 2,
  WISH_LIST: 3,
  READ_LIST: 5,
  SEARCH: "search",
  RELEASES: "releases",
} as const;

export const LIST_NAMES: Record<number, string> = {
  1: "Pull List",
  2: "Collection",
  3: "Wish List",
  5: "Read List",
};

/** One issue of a series with the logged-in user's state for it. */
export interface LOFCGIssueEntry {
  /** Numeric issue id, used by my_list_move and post_rating. */
  issueId: string;
  title: string;
  /** Issue number parsed from the title (e.g. 12 for "Batman #12"), null if none. */
  number: number | null;
  /** True for annuals, specials and other off-numbering issues. */
  offNumbering: boolean;
  cover: string | null;
  releaseDate: string;
  pull: boolean;
  collected: boolean;
  read: boolean;
  wanted: boolean;
  /** The user's rating, 0 (unrated) to 5. */
  rating: number;
}

export interface LOFCGSeriesStatus {
  seriesId: string;
  title: string;
  /** Whether the series is on the user's pull list (subscribed). */
  pulled: boolean;
  issues: LOFCGIssueEntry[];
}
