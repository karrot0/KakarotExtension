declare namespace MangaFire {
  interface Metadata {
    offset?: number;
    collectedIds?: string[];
  }
  interface Result {
    status: number;
    result: {
      html: string;
      title_format: string;
    };
  }

  interface PageResponse {
    status: number;
    result: {
      images: ImageData[];
    };
  }

  const Types: {
    [key: string]: string;
  };

  interface FilterOption {
    id: string;
    name: string;
    type: "type" | "genres";
  }

  interface SearchFilter {
    id: string;
    value: string;
  }

  const FilterOptions: FilterOption[] = [
    // Will actually implement this later
    { id: "manhua", name: "Manhua", type: "type" },
    { id: "manhwa", name: "Manhwa", type: "type" },
    { id: "manga", name: "Manga", type: "type" },
    { id: "action", name: "Action", type: "genres" },
    { id: "adventure", name: "Adventure", type: "genres" },
    { id: "avant-garde", name: "Avant Garde", type: "genres" },
    { id: "boys-love", name: "Boys Love", type: "genres" },
    { id: "comedy", name: "Comedy", type: "genres" },
    { id: "demons", name: "Demons", type: "genres" },
    { id: "drama", name: "Drama", type: "genres" },
    { id: "ecchi", name: "Ecchi", type: "genres" },
    { id: "fantasy", name: "Fantasy", type: "genres" },
    { id: "girls-love", name: "Girls Love", type: "genres" },
    { id: "gourmet", name: "Gourmet", type: "genres" },
    { id: "harem", name: "Harem", type: "genres" },
    { id: "horror", name: "Horror", type: "genres" },
    { id: "isekai", name: "Isekai", type: "genres" },
    { id: "iyashikei", name: "Iyashikei", type: "genres" },
    { id: "josei", name: "Josei", type: "genres" },
    { id: "kids", name: "Kids", type: "genres" },
    { id: "magic", name: "Magic", type: "genres" },
    { id: "mahou-shoujo", name: "Mahou Shoujo", type: "genres" },
    { id: "martial-arts", name: "Martial Arts", type: "genres" },
    { id: "mecha", name: "Mecha", type: "genres" },
    { id: "military", name: "Military", type: "genres" },
    { id: "music", name: "Music", type: "genres" },
    { id: "mystery", name: "Mystery", type: "genres" },
    { id: "parody", name: "Parody", type: "genres" },
    { id: "psychological", name: "Psychological", type: "genres" },
    { id: "reverse-harem", name: "Reverse Harem", type: "genres" },
    { id: "romance", name: "Romance", type: "genres" },
    { id: "school", name: "School", type: "genres" },
    { id: "sci-fi", name: "Sci-Fi", type: "genres" },
    { id: "seinen", name: "Seinen", type: "genres" },
    { id: "shoujo", name: "Shoujo", type: "genres" },
    { id: "shounen", name: "Shounen", type: "genres" },
    { id: "slice-of-life", name: "Slice of Life", type: "genres" },
    { id: "space", name: "Space", type: "genres" },
    { id: "sports", name: "Sports", type: "genres" },
    { id: "super-power", name: "Super Power", type: "genres" },
    { id: "supernatural", name: "Supernatural", type: "genres" },
    { id: "suspense", name: "Suspense", type: "genres" },
    { id: "thriller", name: "Thriller", type: "genres" },
    { id: "vampire", name: "Vampire", type: "genres" },
  ];

  // Represents each image entry in the "images" array
  // Each entry is an array where:
  // - index 0 is a string (image URL)
  // - index 1 is a number (possibly an identifier or category)
  // - index 2 is a number (possibly a flag or status indicator)
  type ImageData = [string, number, number];
}
