export interface HitomiTag {
  type:
    | "tag"
    | "male"
    | "female"
    | "artist"
    | "group"
    | "series"
    | "character"
    | "language"
    | "type"
    | "ambiguous";
  name: string;
  isNegative?: boolean;
  isFuzzy?: boolean;
  forceFuzzy?: boolean;
  orGroup?: number;
}

export interface HitomiFile {
  index: number;
  hash: string;
  name: string;
  hasAvif: boolean;
  hasWebp: boolean;
  width: number;
  height: number;
}

export interface HitomiTranslation {
  id: number;
  languageName: { english: string | null; local: string | null };
}

export interface HitomiGallery {
  id: number;
  title: { display: string; japanese: string | null };
  type: string;
  languageName: { english: string | null; local: string | null };
  artists: string[];
  groups: string[];
  series: string[];
  characters: string[];
  tags: HitomiTag[];
  files: HitomiFile[];
  publishedDate: Date;
  translations: HitomiTranslation[];
  relatedIds: number[];
}

export interface RangeRequest {
  start?: number;
  end?: number;
}

export interface GalleryIdOptions {
  tags?: HitomiTag[];
  range?: RangeRequest;
  popularityOrderBy?: "day" | "week" | "month" | "year" | "index";
  languages?: string[];
  isSearch?: boolean;
}
