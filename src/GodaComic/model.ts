export interface GodaComicMetadata {
  page?: number;
  collectedIds?: string[];
}

export interface ApiResponse<T> {
  data: T;
}
export interface ChapterInfo {
  comic_id: string;
  id: string;
  images?: Array<{
    id: string;
    f: string;
  }>;
}