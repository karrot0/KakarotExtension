import { AdvancedSearchForm, Section, TriStateSelectRow } from "@paperback/types";
import { type ScribbleHubSearchMeta, GENRES } from "../model";

export class ScribbleHubSearchForm extends AdvancedSearchForm {
  private genres: Record<string, "included" | "excluded">;

  constructor(initialMeta?: ScribbleHubSearchMeta) {
    super();
    this.genres = initialMeta?.genres ?? {};
  }

  async updateGenres(value: Record<string, "included" | "excluded">): Promise<void> {
    this.genres = value;
    this.reloadForm();
  }

  getSearchQueryMetadata() {
    return {
      searchMeta: {
        genres: this.genres,
      } satisfies ScribbleHubSearchMeta,
    };
  }

  override getSections() {
    return [
      Section("filters", [
        TriStateSelectRow("genres", {
          title: "Genre",
          layout: "flow",
          value: this.genres,
          items: GENRES.filter((g) => g.id !== "0").map((g) => ({ id: g.id, title: g.label })),
          allowExclusion: true,
          allowEmptySelection: true,
          onValueChange: Application.Selector<ScribbleHubSearchForm, (value: Record<string, "included" | "excluded">) => Promise<void>>(
            this,
            "updateGenres",
          ),
        }),
      ]),
    ];
  }
}
