import { AdvancedSearchForm, Section, SelectRow } from "@paperback/types";
import { type NovelFireSearchMeta, GENRES, SORTS, STATUSES } from "../model";

export class NovelFireSearchForm extends AdvancedSearchForm {
  private genre: string[];
  private sort: string[];
  private status: string[];

  constructor(initialMeta?: NovelFireSearchMeta) {
    super();
    this.genre = [initialMeta?.genre ?? "genre-all"];
    this.sort = [initialMeta?.sort ?? "sort-latest-release"];
    this.status = [initialMeta?.status ?? "status-all"];
  }

  async updateGenre(value: string[]): Promise<void> {
    this.genre = value;
    this.reloadForm();
  }

  async updateSort(value: string[]): Promise<void> {
    this.sort = value;
    this.reloadForm();
  }

  async updateStatus(value: string[]): Promise<void> {
    this.status = value;
    this.reloadForm();
  }

  getSearchQueryMetadata() {
    return {
      searchMeta: {
        genre: this.genre[0] ?? "genre-all",
        sort: this.sort[0] ?? "sort-latest-release",
        status: this.status[0] ?? "status-all",
      } satisfies NovelFireSearchMeta,
    };
  }

  override getSections() {
    return [
      Section("filters", [
        SelectRow("genre", {
          title: "Genre",
          value: this.genre,
          options: GENRES.map((g) => ({ id: g.id, title: g.label })),
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector<NovelFireSearchForm, (value: string[]) => Promise<void>>(
            this,
            "updateGenre",
          ),
        }),
        SelectRow("sort", {
          title: "Sort By",
          value: this.sort,
          options: SORTS.map((s) => ({ id: s.id, title: s.label })),
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector<NovelFireSearchForm, (value: string[]) => Promise<void>>(
            this,
            "updateSort",
          ),
        }),
        SelectRow("status", {
          title: "Status",
          value: this.status,
          options: STATUSES.map((s) => ({ id: s.id, title: s.label })),
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector<NovelFireSearchForm, (value: string[]) => Promise<void>>(
            this,
            "updateStatus",
          ),
        }),
      ]),
    ];
  }
}
