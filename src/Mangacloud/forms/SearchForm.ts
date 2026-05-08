import { AdvancedSearchForm, NavigationRow, Section, SelectRow } from "@paperback/types";
import type { JSONObject } from "@paperback/types";
import { Formats, Genres, Statuses, Themes, Types } from "../model";
import { TagFilterForm, type TagFilterState } from "./TagFilterForm";

export interface MangacloudSearchMetadata extends JSONObject {
  type: string;
  status: string;
  genreIncluded: string[];
  genreExcluded: string[];
  themeIncluded: string[];
  themeExcluded: string[];
  formatIncluded: string[];
  formatExcluded: string[];
}

export class MangacloudSearchForm extends AdvancedSearchForm {
  private type: string[];
  private status: string[];
  private genreForm: TagFilterForm;
  private themeForm: TagFilterForm;
  private formatForm: TagFilterForm;

  constructor(initialMeta?: MangacloudSearchMetadata) {
    super();
    this.type = initialMeta?.type ? [initialMeta.type] : [];
    this.status = initialMeta?.status ? [initialMeta.status] : [];

    this.genreForm = new TagFilterForm(
      Genres.map((g) => ({ id: g.id, name: g.name })),
      "genres",
      {
        included: initialMeta?.genreIncluded ?? [],
        excluded: initialMeta?.genreExcluded ?? [],
      },
    );

    this.themeForm = new TagFilterForm(
      Themes.map((t) => ({ id: t.id, name: t.name })),
      "themes",
      {
        included: initialMeta?.themeIncluded ?? [],
        excluded: initialMeta?.themeExcluded ?? [],
      },
    );

    this.formatForm = new TagFilterForm(
      Formats.map((f) => ({ id: f.id, name: f.name })),
      "formats",
      {
        included: initialMeta?.formatIncluded ?? [],
        excluded: initialMeta?.formatExcluded ?? [],
      },
    );
  }

  async updateType(value: string[]): Promise<void> {
    this.type = value;
    this.reloadForm();
  }

  async updateStatus(value: string[]): Promise<void> {
    this.status = value;
    this.reloadForm();
  }

  getSearchQueryMetadata() {
    const genres: TagFilterState = this.genreForm.getState();
    const themes: TagFilterState = this.themeForm.getState();
    const formats: TagFilterState = this.formatForm.getState();

    return {
      searchMeta: {
        type: this.type[0] ?? "",
        status: this.status[0] ?? "",
        genreIncluded: genres.included,
        genreExcluded: genres.excluded,
        themeIncluded: themes.included,
        themeExcluded: themes.excluded,
        formatIncluded: formats.included,
        formatExcluded: formats.excluded,
      } satisfies MangacloudSearchMetadata,
    };
  }

  private getSubtitle(state: TagFilterState): string {
    const total = state.included.length + state.excluded.length;
    return total > 0 ? `${total} selected` : "";
  }

  override getSections() {
    return [
      Section("general", [
        SelectRow("type", {
          title: "Type",
          value: this.type,
          options: Types.map((t) => ({ id: t.id, title: t.name })),
          minItemCount: 0,
          maxItemCount: 1,
          onValueChange: Application.Selector<MangacloudSearchForm, (value: string[]) => Promise<void>>(
            this,
            "updateType",
          ),
        }),
        SelectRow("status", {
          title: "Status",
          value: this.status,
          options: Statuses.map((s) => ({ id: s.id, title: s.name })),
          minItemCount: 0,
          maxItemCount: 1,
          onValueChange: Application.Selector<MangacloudSearchForm, (value: string[]) => Promise<void>>(
            this,
            "updateStatus",
          ),
        }),
      ]),
      Section("genres_section", [
        NavigationRow("genres_nav", {
          title: "Genres",
          subtitle: this.getSubtitle(this.genreForm.getState()),
          form: this.genreForm,
        }),
      ]),
      Section("themes_section", [
        NavigationRow("themes_nav", {
          title: "Themes",
          subtitle: this.getSubtitle(this.themeForm.getState()),
          form: this.themeForm,
        }),
      ]),
      Section("formats_section", [
        NavigationRow("formats_nav", {
          title: "Formats",
          subtitle: this.getSubtitle(this.formatForm.getState()),
          form: this.formatForm,
        }),
      ]),
    ];
  }
}
