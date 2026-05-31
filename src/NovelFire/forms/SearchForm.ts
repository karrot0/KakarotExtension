import { AdvancedSearchForm, Section, SelectRow, TriStateSelectRow } from "@paperback/types";
import { type NovelFireSearchMeta, GENRES, SORTS, STATUSES } from "../model";

export class NovelFireSearchForm extends AdvancedSearchForm {
  private genres: Record<string, "included" | "excluded">;
  private status: string[];

  constructor(initialMeta?: NovelFireSearchMeta) {
    super();
    this.genres = initialMeta?.genres ?? {};
    this.status = [initialMeta?.status ?? "status-all"];
  }

  async updateGenres(value: Record<string, "included" | "excluded">): Promise<void> {
    this.genres = value;
    this.reloadForm();
  }

  async updateStatus(value: string[]): Promise<void> {
    this.status = value;
    this.reloadForm();
  }

  getSearchQueryMetadata() {
    return {
      searchMeta: {
        genres: this.genres,
        sort: "sort-latest-release",
        status: this.status[0] ?? "status-all",
      } satisfies NovelFireSearchMeta,
    };
  }

  override getSections() {
    return [
      Section("filters", [
        TriStateSelectRow("genres", {
          title: "Genre",
          layout: "flow",
          value: this.genres,
          items: GENRES.map((g) => ({ id: g.id, title: g.label })),
          allowExclusion: true,
          allowEmptySelection: true,
          onValueChange: Application.Selector<NovelFireSearchForm, (value: Record<string, "included" | "excluded">) => Promise<void>>(
            this,
            "updateGenres",
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
