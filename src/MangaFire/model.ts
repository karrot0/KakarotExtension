export interface MangaFireMetadata {
  page?: number;
  collectedIds?: string[];
  searchCollectedIds?: string[];
}

export interface MangaFireResult {
  status: number;
  result: { html: string; title_format: string };
}

export interface MangaFirePageResponse {
  status: number;
  result: { images: MangaFireImageData[] };
}

export interface MangaFireFilterOption {
  id: string;
  name: string;
  type: "type" | "genres";
}

export interface MangaFireSearchFilter {
  id: string;
  value: string;
}

// Represents each image entry in the "images" array
// Each entry is an array where:
// - index 0 is a string (image URL)
// - index 1 is a number (possibly an identifier or category)
// - index 2 is a number (possibly a flag or status indicator)
export type MangaFireImageData = [string, number, number];

export const MangaFireTypes: { [key: string]: string } = {};
