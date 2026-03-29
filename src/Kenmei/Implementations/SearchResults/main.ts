import {
  type PagedResults,
  type SearchFilter,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
} from "@paperback/types";
import { searchSeries } from "../../Services/Requests";

export class SearchResultsImplementation {
  async getSearchFilters(): Promise<SearchFilter[]> {
    return [];
  }

  async getSortingOptions(): Promise<SortingOption[]> {
    return [];
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: { page?: number } | undefined,
    _?: SortingOption, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const searchTerm = query.title?.trim() ?? "";

    if (!searchTerm) {
      return { items: [], metadata: undefined };
    }

    const response = await searchSeries(searchTerm, page);
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
