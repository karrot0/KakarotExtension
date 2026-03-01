export interface MangacloudMetadata {
  page?: number;
  collectedIds?: string[];
}

export interface ApiResponse<T> {
  data: T;
}

export type MostViewedMangaResponse = {
  list: {
    id: string;
    title: string;
    chapter_id: string;
    number: number;
    created_date: string; // ISO 8601
    cover: {
      // Have to build the cover URL ourselves, as the API only returns the ID and file extension
      id: string;
      w: number;
      h: number;
      f: string;
    };
  }[];
};

export type UpdatedMangaResponse = {
  list: {
    id: string;
    title: string;
    type?: string;
    cover?: {
      id: string;
      w: number;
      h: number;
      f: string;
    };
    chapters: {
      number: number;
      id: string;
      created_date: string; // ISO 8601
    }[];
  }[];
};

export type SearchMangaResponse = {};

export type BrowseMangaResponse = {
  id: string;
  title: string;
  alt_titles?: string | null;
  nat_titles?: string | null;
  description?: string | null;
  status?: string | null;
  created_date?: string; // ISO 8601
  updated_date?: string; // ISO 8601
  type?: string | null;
  authors?: string | null;
  artists?: string | null;
  official_raw?: string | null;
  official_english?: string | null;
  anilist_id?: number | null;
  comick_hid?: string | null;
  start_year?: number | null;
  end_year?: number | null;
  content_rating?: string | null;
  str_filters?: string | null;
  comick_slug?: string | null;
  start_month?: number | null;
  start_day?: number | null;
  end_month?: number | null;
  end_day?: number | null;
  quality_checked?: boolean;
  mature_content?: boolean;
  scan_groups?: any | null;
  src_path?: string | null;
  src_group?: string | null;
  mangadex_id?: string | null;
  is_hidden?: boolean;
  mangaupdates_id?: number | null;
  myanimelist_id?: number | null;
  notice?: string | null;
  staff_note?: string | null;
  rating_score?: number | null;
  cover?: {
    id: string;
    w: number;
    h: number;
    f: string;
  } | null;
}[];

export type MangaInfo = {
  id: string;
  title: string;
  alt_titles?: string | null;
  nat_titles?: string | null;
  description?: string | null;
  status?: string | null;
  start_year?: number | null;
  end_year?: number | null;
  type?: string | null;
  authors?: string | null;
  artists?: string | null;
  official_raw?: string | null;
  official_english?: string | null;
  links?: {
    al?: number;
    mal?: number;
    md?: string;
    mu?: string;
    [key: string]: any;
  };
  tags?: {
    id: string;
    name: string;
    type: string;
  }[];
  chapters?: {
    id: string;
    number: number;
    name?: string | null;
    created_date: string; // ISO 8601
  }[];
  cover?: {
    id: string;
    w: number;
    h: number;
    f: string;
  } | null;
  banner?: any | null;
  relations?: any[];
}

export type ChapterInfo = {
  id: string;
  comic_id: string;
  name?: string | null;
  number?: number;
  images: {
    id: string;
    w: number;
    h: number;
    f: string;
  }[];
};