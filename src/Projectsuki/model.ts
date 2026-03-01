export interface ProjectsukiMetadata {
  page?: number;
  collectedIds?: string[];
}

export interface ApiResponse<T> {
  data: T;
}

// minimal interfaces based on API responses used in main.ts
export interface MangaInfo {
  id: string;
  title: string;
  alt_titles?: string | null;
  tags?: { id: string; name: string; type: string }[];
  cover?: { id: string; f: string } | null;
  description?: string | null;
  status?: string | null;
  chapters?: {
    id: string;
    number?: number;
    name?: string | null;
    created_date?: string;
  }[];
}

export interface ChapterInfo {
  comic_id: string;
  id: string;
  images: { id: string; f: string }[];
}