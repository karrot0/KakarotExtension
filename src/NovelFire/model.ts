export interface NovelFireMetadata {
  page?: number;
  collectedIds?: string[];
  searchCollectedIds?: string[];
}

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