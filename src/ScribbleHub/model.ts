import { JSONObject } from "@paperback/types";

export interface ScribbleHubMetadata extends JSONObject {
  page?: number;
  collectedIds?: string[];
}

export interface ScribbleHubSearchMeta {
  genres: Record<string, "included" | "excluded">;
}

export const GENRES = [
  { id: "0",   label: "All",          slug: null },
  { id: "9",   label: "Action",       slug: "action" },
  { id: "1",   label: "Adventure",    slug: "adventure" },
  { id: "7",   label: "Comedy",       slug: "comedy" },
  { id: "903", label: "Drama",        slug: "drama" },
  { id: "8",   label: "Fan Fiction",  slug: "fan-fiction" },
  { id: "19",  label: "Fantasy",      slug: "fantasy" },
  { id: "4",   label: "Harem",        slug: "harem" },
  { id: "3",   label: "Historical",   slug: "historical" },
  { id: "10",  label: "Horror",       slug: "horror" },
  { id: "11",  label: "Isekai",       slug: "isekai" },
  { id: "12",  label: "Martial Arts", slug: "martial-arts" },
  { id: "909", label: "Mystery",      slug: "mystery" },
  { id: "910", label: "Psychological",slug: "psychological" },
  { id: "6",   label: "Romance",      slug: "romance" },
  { id: "18",  label: "School Life",  slug: "school-life" },
  { id: "912", label: "Sci-fi",       slug: "sci-fi" },
  { id: "16",  label: "Slice of Life",slug: "slice-of-life" },
  { id: "5",   label: "Supernatural", slug: "supernatural" },
  { id: "13",  label: "Tragedy",      slug: "tragedy" },
  { id: "14",  label: "Wuxia",        slug: "wuxia" },
  { id: "15",  label: "Xianxia",      slug: "xianxia" },
];

export const SORTS = [
  { id: "1", label: "Rank" },
  { id: "2", label: "Latest Update" },
  { id: "3", label: "Most Readers" },
  { id: "4", label: "Reviews" },
  { id: "5", label: "Chapters" },
  { id: "6", label: "Reading Lists" },
  { id: "7", label: "Favorites" },
];

export interface ScribbleHubSearchResult {
  status?: number;
  result?: { html: string };
}
