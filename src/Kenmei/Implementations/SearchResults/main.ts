import {
  type AdvancedSearchForm,
  type Metadata,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
} from "@paperback/types";
import { type KenmeiSearchOptions, searchSeries } from "../../Services/Requests";
import { KenmeiSearchForm, type KenmeiSearchMetadata } from "./forms/SearchForm";

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

// ── Sort options ──────────────────────────────────────────────────────────────
const SORTING_OPTIONS: SortingOption[] = [
  { id: "newest", label: "Newest" },
  { id: "score", label: "Score" },
  { id: "popularity", label: "Popularity" },
  { id: "chapters released", label: "Chapters Released" },
];

const TAG_SLUG_TO_VALUE = new Map(TAG_OPTIONS.map((o) => [o.id, o.value]));

// ── Implementation ────────────────────────────────────────────────────────────
export class SearchResultsImplementation {
  async getAdvancedSearchForm(query: SearchQuery<Metadata>): Promise<AdvancedSearchForm> {
    const meta = (query.metadata as { searchMeta?: KenmeiSearchMetadata } | undefined)?.searchMeta;
    return new KenmeiSearchForm(meta);
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    return SORTING_OPTIONS;
  }

  async getSearchResults(
    query: SearchQuery<Metadata>,
    metadata: { page?: number } | undefined,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const searchTerm = query.title?.trim() ?? "";

    const searchMeta = (query.metadata as { searchMeta?: KenmeiSearchMetadata } | undefined)?.searchMeta;

    const options: KenmeiSearchOptions = {
      contentTypes: searchMeta?.contentTypes ?? [],
      publicationStatuses: searchMeta?.publicationStatuses ?? [],
      tags: (searchMeta?.tags ?? []).map((slug) => TAG_SLUG_TO_VALUE.get(slug) ?? slug),
      releasedOn: searchMeta?.releasedOn || undefined,
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
