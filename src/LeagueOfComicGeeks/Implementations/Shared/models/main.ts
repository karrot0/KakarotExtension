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

export type LOFCGListType = "series" | "issue";

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
