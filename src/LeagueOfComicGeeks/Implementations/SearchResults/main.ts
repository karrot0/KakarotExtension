import {
  type PagedResults,
  type SearchFilter,
  type SearchQuery,
  type SearchResultItem,
  type SearchResultsProviding,
  type SortingOption,
} from "@paperback/types";
import { getComics, searchAjax } from "../../Services/Requests";
import { LIST_IDS } from "../Shared/models/main";
import { MangaImplementation } from "../Manga/main";
import { comic } from "../Shared/parser/main";

export class SearchResultsImplementation extends MangaImplementation implements SearchResultsProviding {
  async getSearchFilters(): Promise<SearchFilter[]> {
    return [
      {
        type: "dropdown",
        id: "format",
        title: "Format",
        options: [
          { id: "series", value: "Series" },
          { id: "issue", value: "Issues" },
        ],
        value: "series",
      },
    ];
  }

  async getSortingOptions(query: SearchQuery): Promise<SortingOption[]> {
    void query;
    return [
      { id: "alpha-asc", label: "A-Z" },
      { id: "alpha-desc", label: "Z-A" },
      { id: "community", label: "Community Rating" },
      { id: "pulls", label: "Most Pulled" },
    ];
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: number | undefined,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const logPrefix = "[SearchResults:getSearchResults]";
    console.log(`${logPrefix} starts: ${query.title}`);

    const page = metadata ?? 1;

    const formatFilter = query.filters.find((f) => f.id === "format");
    const listOption = formatFilter?.value === "issue" ? "issue" : "series";
    const order = sortingOption?.id ?? "alpha-asc";

    const PAGE_SIZE = 25;

    try {
      let allSeries;

      if (query.title) {
        const html = await searchAjax(query.title);
        allSeries = comic.parseAjaxSeriesHtml(html);
        const items: SearchResultItem[] = allSeries.map((s) => comic.seriestoSearchResultItem(s));
        console.log(`${logPrefix} complete: ${items.length} results`);
        return { items};
      } else {
        const response = await getComics({
          list: LIST_IDS.SEARCH,
          list_option: listOption,
          order: String(order),
          page: 1,
        });
        if (!response.list) {
          return { items: [], metadata: -1 };
        }
        allSeries = comic.parseSeriesHtml(response.list);
      }

      const start = (page - 1) * PAGE_SIZE;
      const series = allSeries.slice(start, start + PAGE_SIZE);
      const items: SearchResultItem[] = series.map((s) => comic.seriestoSearchResultItem(s));
      // If we have fewer results than the page size, there's no next page. Otherwise, we assume there is one, even if the next page might be empty (e.g. if items were removed since the initial search).
      const nextPage = start + PAGE_SIZE < allSeries.length ? page + 1 : -1;

      console.log(`${logPrefix} complete: ${items.length} results`);
      return { items, metadata: nextPage };
    } catch (e) {
      console.log(`${logPrefix} error: ${String(e)}`);
      throw e;
    }
  }
}
