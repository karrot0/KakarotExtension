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

export type SearchMangaResponse = {
  id: string;
  title: string;
  alt_titles?: string | null;
  number?: number;
  chapter_id?: string;
  cover?: {
    id: string;
    w: number;
    h: number;
    f: string;
  };
}[];

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

// static filter values for browse/search UI
export const Types = [
  { id: "Manga", name: "Manga" },
  { id: "Manhua", name: "Manhua" },
  { id: "Manhwa", name: "Manhwa" },
];

export const Statuses = [
  { id: "Ongoing", name: "Ongoing" },
  { id: "Completed", name: "Completed" },
  { id: "Cancelled", name: "Cancelled" },
  { id: "Hiatus", name: "Hiatus" },
  { id: "Unknown", name: "Unknown" },
];

export const SortOptions = [
  { id: "chapter_date-DESC", name: "Latest Chapter" },
  { id: "chapter_date-ASC", name: "Oldest Chapter" },
  { id: "title-ASC", name: "Title Ascending" },
  { id: "title-DESC", name: "Title Descending" },
  { id: "created_date-DESC", name: "Recently Added" },
  { id: "created_date-ASC", name: "Oldest Added" },
];

export const Genres = [
  { id: "131179581037085763", name: "Action" },
  { id: "131179581028697093", name: "Adventure" },
  { id: "131179581037085764", name: "Comedy" },
  { id: "131179581028697098", name: "Crime" },
  { id: "131179581028697105", name: "Drama" },
  { id: "131179581028697094", name: "Fantasy" },
  { id: "131179581028697103", name: "Healing" },
  { id: "131179581028697095", name: "Historical" },
  { id: "131179581028697096", name: "Horror" },
  { id: "131179581028697102", name: "Isekai" },
  { id: "131179581037085766", name: "Mystery" },
  { id: "131179581028697106", name: "Philosophical" },
  { id: "131179581028697107", name: "Psychological" },
  { id: "131179581028697097", name: "Romance" },
  { id: "131179581028697099", name: "Sci-Fi" },
  { id: "131179581028697092", name: "Slice of Life" },
  { id: "131179581028697104", name: "Sports" },
  { id: "131179581028697100", name: "Thriller" },
  { id: "262922194814764598", name: "Tragedy" },
  { id: "131179581028697101", name: "Wuxia" },
];

export const Themes = [
  { id: "131179581037085751", name: "Agriculture" },
  { id: "131179581037085768", name: "Aliens" },
  { id: "131179581037085742", name: "Angels" },
  { id: "131179581037085769", name: "Animals" },
  { id: "131179581045474384", name: "Board Games" },
  { id: "131179581037085770", name: "Books" },
  { id: "131179581037085738", name: "Cooking" },
  { id: "131179581028697110", name: "Cultivation" },
  { id: "131179581037085772", name: "Delinquents" },
  { id: "131179581037085773", name: "Demons" },
  { id: "131179581037085749", name: "Dungeon" },
  { id: "131179581037085736", name: "Educational" },
  { id: "131179581045474382", name: "Elves" },
  { id: "131179581037085737", name: "Food" },
  { id: "131179581045474383", name: "Ghosts" },
  { id: "131179581037085734", name: "Gore" },
  { id: "131179581037085728", name: "Growth" },
  { id: "131179581037085757", name: "Gyaru" },
  { id: "131179581037085729", name: "Harem" },
  { id: "131179581037085741", name: "Kingdom Building" },
  { id: "131179581037085758", name: "Mafia" },
  { id: "131179581028697117", name: "Magic" },
  { id: "131179581037085752", name: "Martial Arts" },
  { id: "131179581037085733", name: "Mecha" },
  { id: "131179581037085743", name: "Medical" },
  { id: "131179581037085732", name: "Medieval" },
  { id: "131179581037085727", name: "Military" },
  { id: "131179581045474385", name: "Monsters" },
  { id: "131179581028697114", name: "Music" },
  { id: "131179581037085750", name: "Nature" },
  { id: "131179581028697113", name: "Ninja" },
  { id: "131179581037085744", name: "Nobility" },
  { id: "131179581045474386", name: "Office Workers" },
  { id: "131179581028697112", name: "Overpowered" },
  { id: "131179581037085759", name: "Police" },
  { id: "131179581037085746", name: "Political" },
  { id: "131179581037085756", name: "Post-Apocalyptic" },
  { id: "131179581037085771", name: "Power Cheat" },
  { id: "131179581028697111", name: "Reincarnation" },
  { id: "131179581028697109", name: "Revenge" },
  { id: "131179581037085755", name: "Samurai" },
  { id: "131179581037085748", name: "School Club" },
  { id: "131179581037085726", name: "School Life" },
  { id: "131179581028697108", name: "Second Chance" },
  { id: "131179581037085731", name: "Superhero" },
  { id: "131179581037085767", name: "Supernatural" },
  { id: "131179581028697115", name: "Survival" },
  { id: "131179581028697116", name: "Time Travel" },
  { id: "267744811266607078", name: "Tower" },
  { id: "131179581037085747", name: "Training" },
  { id: "131179581045474387", name: "Vampires" },
  { id: "131179581045474388", name: "Video Games" },
  { id: "131179581037085739", name: "Villain" },
  { id: "131179581037085730", name: "Villainess" },
  { id: "131179581037085735", name: "Violence" },
  { id: "131179581037085765", name: "Virtual Reality" },
  { id: "131179581037085754", name: "Virtual System" },
  { id: "131179581037085745", name: "War" },
  { id: "131179581037085740", name: "Witch" },
  { id: "131179581045474389", name: "Zombies" },
];

export const Formats = [
  { id: "131179581020308481", name: "Adapted from Anime" },
  { id: "131179581028697091", name: "Adapted to Anime" },
  { id: "131179581037085753", name: "Award Winning" },
  { id: "131179581028697090", name: "Full Color" },
  { id: "131179581037085760", name: "Long Strip" },
  { id: "131179581037085762", name: "Oneshot" },
  { id: "131179581037085761", name: "Web Comic" },
];