export interface metadata {
  page?: number;
  collectedIds?: string[];
  searchCollectedIds?: string[];
}

export interface searchFilter {
  id: string;
  value: string;
}

export interface searchItem {
  id: string;
  title: string;
  url?: string;
  cover?: string;
  thumbnail?: string;
  score?: string;
  votes?: number;
  status: string;
  year?: string;
  type: string;
  description: string;
  alt_titles?: string[];
  authors?: string[];
  permalink?: string;
  slug?: string;
}

export type SearchAPIResponse = searchItem[] | { data: searchItem[] };

// Latest chapters (Recently Updated) API
export interface LatestChapterEntry {
  manga_id: string;
  title: string;
  permalink: string;
  cover: string;
  chapter: string;
  time: string;
  manga_type: string;
  manga_status: string;
  last_3_chapters: Array<{
    title: string;
    chapter: string;
    link: string;
    time: string;
    is_new: boolean;
  }>
}

export interface LatestChaptersResponse {
  success: boolean;
  data: LatestChapterEntry[];
}

// Popular slider data-initial
export interface PopularItem {
  cover: string;
  title: string;
  permalink: string;
  manga_type: string;
}