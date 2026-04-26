import {
  type PagedResults,
  type SearchFilter,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
} from "@paperback/types";
import { type KenmeiSearchOptions, searchSeries } from "../../Services/Requests";

// ── Filter IDs ────────────────────────────────────────────────────────────────
const FILTER_CONTENT_TYPE = "content_type";
const FILTER_PUBLICATION_STATUS = "publication_status";
const FILTER_TAGS = "classifications_name";
const FILTER_RELEASED_ON = "released_on";

// ── Option definitions ────────────────────────────────────────────────────────
const CONTENT_TYPE_OPTIONS = [
  { id: "manga", value: "Manga" },
  { id: "manhwa", value: "Manhwa" },
  { id: "manhua", value: "Manhua" },
  { id: "other", value: "Other" },
];

const PUBLICATION_STATUS_OPTIONS = [
  { id: "releasing", value: "Releasing" },
  { id: "finished", value: "Finished" },
  { id: "on_hiatus", value: "On Hiatus" },
  { id: "cancelled", value: "Cancelled" },
  { id: "not_yet_released", value: "Not Yet Released" },
];

// IDs must be alphanumeric (with underscores). The `value` is the exact
// classification name sent to the Kenmei API via the tag filter helper below.
const TAG_OPTIONS = [
  // Genre
  { id: "action", value: "Action" },
  { id: "adventure", value: "Adventure" },
  { id: "comedy", value: "Comedy" },
  { id: "drama", value: "Drama" },
  { id: "fantasy", value: "Fantasy" },
  { id: "horror", value: "Horror" },
  { id: "mystery", value: "Mystery" },
  { id: "psychological", value: "Psychological" },
  { id: "romance", value: "Romance" },
  { id: "scifi", value: "Sci-Fi" },
  { id: "slice_of_life", value: "Slice of Life" },
  { id: "sports", value: "Sports" },
  // Theme
  { id: "crossdressing", value: "Crossdressing" },
  { id: "delinquents", value: "Delinquents" },
  { id: "harem", value: "Harem" },
  { id: "martial_arts", value: "Martial Arts" },
  { id: "military", value: "Military" },
  { id: "music", value: "Music" },
  { id: "reincarnation", value: "Reincarnation" },
  { id: "reverse_harem", value: "Reverse Harem" },
  { id: "samurai", value: "Samurai" },
  { id: "school", value: "School" },
  { id: "survival", value: "Survival" },
  { id: "boys_love", value: "Boys' Love" },
  { id: "girls_love", value: "Girls' Love" },
  { id: "villainess", value: "Villainess" },
  { id: "mecha", value: "Mecha" },
  { id: "vampire", value: "Vampire" },
  { id: "historical", value: "Historical" },
  { id: "regression", value: "Regression" },
  // Character
  { id: "female_protagonist", value: "Female Protagonist" },
  { id: "male_protagonist", value: "Male Protagonist" },
  // Content Warning
  { id: "gore", value: "Gore" },
  { id: "suicide", value: "Suicide" },
  { id: "torture", value: "Torture" },
];

const RELEASED_ON_OPTIONS = [
  { id: "this_month", value: "This Month" },
  { id: "last_month", value: "Last Month" },
  { id: "this_year", value: "This Year" },
];

// ── Sort options ──────────────────────────────────────────────────────────────
const SORTING_OPTIONS: SortingOption[] = [
  { id: "newest", label: "Newest" },
  { id: "score", label: "Score" },
  { id: "popularity", label: "Popularity" },
  { id: "chapters released", label: "Chapters Released" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Maps a slug ID back to its display value for a given options list. */
function slugToValue(slug: string, options: { id: string; value: string }[]): string {
  return options.find((o) => o.id === slug)?.value ?? slug;
}

function getIncludedValues(
  filters: SearchFilter[] | undefined,
  id: string,
  options?: { id: string; value: string }[],
): string[] {
  const filter = filters?.find((f) => f.id === id);
  if (!filter) return [];
  const slugs = Object.entries(filter.value as Record<string, string>)
    .filter(([, v]) => v === "included")
    .map(([k]) => k);
  return options ? slugs.map((s) => slugToValue(s, options)) : slugs;
}

function getDropdownValue(filters: SearchFilter[] | undefined, id: string): string | undefined {
  const filter = filters?.find((f) => f.id === id);
  return filter ? (filter.value as string) || undefined : undefined;
}

// ── Implementation ────────────────────────────────────────────────────────────
export class SearchResultsImplementation {
  async getSearchFilters(): Promise<SearchFilter[]> {
    return [
      {
        id: FILTER_CONTENT_TYPE,
        title: "Type",
        type: "multiselect",
        options: CONTENT_TYPE_OPTIONS,
        allowExclusion: false,
        value: {},
        allowEmptySelection: true,
        maximum: undefined,
      },
      {
        id: FILTER_TAGS,
        title: "Tags",
        type: "multiselect",
        options: TAG_OPTIONS,
        allowExclusion: false,
        value: {},
        allowEmptySelection: true,
        maximum: undefined,
      },
      {
        id: FILTER_PUBLICATION_STATUS,
        title: "Publication Status",
        type: "multiselect",
        options: PUBLICATION_STATUS_OPTIONS,
        allowExclusion: false,
        value: {},
        allowEmptySelection: true,
        maximum: undefined,
      },
      {
        id: FILTER_RELEASED_ON,
        title: "Release Period",
        type: "dropdown",
        options: RELEASED_ON_OPTIONS,
        value: "",
      },
    ];
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    return SORTING_OPTIONS;
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: { page?: number } | undefined,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const searchTerm = query.title?.trim() ?? "";

    const options: KenmeiSearchOptions = {
      contentTypes: getIncludedValues(query.filters, FILTER_CONTENT_TYPE),
      publicationStatuses: getIncludedValues(query.filters, FILTER_PUBLICATION_STATUS),
      // Resolve slugified IDs back to real tag names for the API.
      tags: getIncludedValues(query.filters, FILTER_TAGS, TAG_OPTIONS),
      releasedOn: getDropdownValue(query.filters, FILTER_RELEASED_ON),
      sort: sortingOption?.id,
    };

    const response = await searchSeries(searchTerm, page, options);
    const items: SearchResultItem[] = response.data.map((series) => ({
      mangaId: series.slug,
      title: series.title,
      imageUrl:
        series.cover.jpeg?.large ??
        series.cover.webp?.large ??
        series.cover.twitter ??
        "",
      subtitle: series.contentType,
      metadata: undefined,
    }));

    const hasNextPage = response.pagy.next != null;

    return {
      items,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }
}
