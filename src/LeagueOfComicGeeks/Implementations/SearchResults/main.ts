import {
  type AdvancedSearchForm,
  Metadata,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SearchResultsProviding,
  type SortingOption,
} from "@paperback/types";
import { getComics, searchAjax } from "../../Services/Requests";
import { LIST_IDS } from "../Shared/models/main";
import { MangaImplementation } from "../Manga/main";
import { comic } from "../Shared/parser/main";
import { LOCGSearchForm, type LOCGSearchMetadata } from "./forms/SearchForm";

export class SearchResultsImplementation extends MangaImplementation implements SearchResultsProviding {
  async getAdvancedSearchForm(query: SearchQuery<Metadata>): Promise<AdvancedSearchForm> {
    const meta = (query.metadata as { searchMeta?: LOCGSearchMetadata } | undefined)?.searchMeta;
    return new LOCGSearchForm(meta);
  }

  async getSortingOptions(query: SearchQuery<Metadata>): Promise<SortingOption[]> {
    void query;
    return [
      { id: "alpha-asc", label: "A-Z" },
      { id: "alpha-desc", label: "Z-A" },
      { id: "community", label: "Community Rating" },
      { id: "pulls", label: "Most Pulled" },
    ];
  }

  async getSearchResults(
    query: SearchQuery<Metadata>,
    metadata: number | undefined,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const logPrefix = "[SearchResults:getSearchResults]";
    console.log(`${logPrefix} starts: ${query.title}`);

    const page = metadata ?? 1;
    if (page < 1) return { items: [], metadata: -1 };

    const searchMeta = (query.metadata as { searchMeta?: LOCGSearchMetadata } | undefined)?.searchMeta;
    const listOption = searchMeta?.format === "issue" ? "issue" : "series";
    const title = (query.title ?? "").trim();
    const order = sortingOption?.id ?? (title ? "pulls" : "alpha-asc");

    const PAGE_SIZE = 25;

    try {
      // The site's full search goes through get_comics (list=search&title=...),
      // which returns every match in one response. The ajax_issues endpoint the
      // search box uses only returns a handful of suggestions, so it's a fallback.
      const response = await getComics({
        list: LIST_IDS.SEARCH,
        list_option: listOption,
        title: title || undefined,
        order: String(order),
      });

      let allSeries =
        listOption === "issue"
          ? comic.parseIssueListHtml(response.list)
          : comic.parseSeriesHtml(response.list);
      if (allSeries.length === 0 && listOption === "issue") {
        allSeries = comic.parseSeriesHtml(response.list);
      }
      if (allSeries.length === 0 && title) {
        allSeries = comic.parseAjaxSeriesHtml(await searchAjax(title));
      }

      const start = (page - 1) * PAGE_SIZE;
      const items = allSeries
        .slice(start, start + PAGE_SIZE)
        .map((s) => comic.seriestoSearchResultItem(s));
      const nextPage = start + PAGE_SIZE < allSeries.length ? page + 1 : -1;

      console.log(`${logPrefix} complete: ${items.length} of ${allSeries.length} results`);
      return { items, metadata: nextPage };
    } catch (e) {
      console.log(`${logPrefix} error: ${String(e)}`);
      throw e;
    }
  }
}
