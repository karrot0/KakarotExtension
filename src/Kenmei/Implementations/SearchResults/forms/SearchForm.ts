import { AdvancedSearchForm, NavigationRow, Section, SelectRow } from "@paperback/types";
import type { JSONObject } from "@paperback/types";

import { KENMEI_TAG_CATEGORY, TagCategoryForm } from "./TagCategoryForm";

export interface KenmeiSearchMetadata extends JSONObject {
  contentTypes: string[];
  tags: string[];
  publicationStatuses: string[];
  releasedOn: string;
}

const CONTENT_TYPE_OPTIONS = [
  { id: "manga", title: "Manga" },
  { id: "manhwa", title: "Manhwa" },
  { id: "manhua", title: "Manhua" },
  { id: "other", title: "Other" },
];

const PUBLICATION_STATUS_OPTIONS = [
  { id: "releasing", title: "Releasing" },
  { id: "finished", title: "Finished" },
  { id: "on_hiatus", title: "On Hiatus" },
  { id: "cancelled", title: "Cancelled" },
  { id: "not_yet_released", title: "Not Yet Released" },
];

const RELEASED_ON_OPTIONS = [
  { id: "this_month", title: "This Month" },
  { id: "last_month", title: "Last Month" },
  { id: "this_year", title: "This Year" },
];

export class KenmeiSearchForm extends AdvancedSearchForm {
  private contentTypes: string[];
  private tagForm: TagCategoryForm;
  private publicationStatuses: string[];
  private releasedOn: string[];

  constructor(initialMeta?: KenmeiSearchMetadata) {
    super();
    this.contentTypes = initialMeta?.contentTypes ?? [];
    this.tagForm = new TagCategoryForm(KENMEI_TAG_CATEGORY, {
      included: initialMeta?.tags ?? [],
      excluded: [],
    });
    this.publicationStatuses = initialMeta?.publicationStatuses ?? [];
    this.releasedOn = initialMeta?.releasedOn ? [initialMeta.releasedOn] : [];
  }

  async updateContentTypes(value: string[]): Promise<void> {
    this.contentTypes = value;
    this.reloadForm();
  }

  async updatePublicationStatuses(value: string[]): Promise<void> {
    this.publicationStatuses = value;
    this.reloadForm();
  }

  async updateReleasedOn(value: string[]): Promise<void> {
    this.releasedOn = value;
    this.reloadForm();
  }

  getSearchQueryMetadata() {
    const tagState = this.tagForm.getState();
    return {
      searchMeta: {
        contentTypes: this.contentTypes,
        tags: tagState.included,
        publicationStatuses: this.publicationStatuses,
        releasedOn: this.releasedOn[0] ?? "",
      } satisfies KenmeiSearchMetadata,
    };
  }

  private getTagSubtitle(): string {
    const tagState = this.tagForm.getState();
    const selectedCount = tagState.included.length + tagState.excluded.length;
    return selectedCount > 0 ? `${selectedCount} selected` : "";
  }

  override getSections() {
    return [
      Section("type", [
        SelectRow("content_type", {
          title: "Type",
          value: this.contentTypes,
          options: CONTENT_TYPE_OPTIONS,
          minItemCount: 0,
          maxItemCount: CONTENT_TYPE_OPTIONS.length,
          onValueChange: Application.Selector<KenmeiSearchForm, (value: string[]) => Promise<void>>(
            this,
            "updateContentTypes",
          ),
        }),
      ]),
      Section("tags", [
        NavigationRow("tags", {
          title: "Tags",
          subtitle: this.getTagSubtitle(),
          form: this.tagForm,
        }),
      ]),
      Section("status", [
        SelectRow("publication_status", {
          title: "Publication Status",
          value: this.publicationStatuses,
          options: PUBLICATION_STATUS_OPTIONS,
          minItemCount: 0,
          maxItemCount: PUBLICATION_STATUS_OPTIONS.length,
          onValueChange: Application.Selector<KenmeiSearchForm, (value: string[]) => Promise<void>>(
            this,
            "updatePublicationStatuses",
          ),
        }),
      ]),
      Section("release", [
        SelectRow("released_on", {
          title: "Release Period",
          value: this.releasedOn,
          options: RELEASED_ON_OPTIONS,
          minItemCount: 0,
          maxItemCount: 1,
          onValueChange: Application.Selector<KenmeiSearchForm, (value: string[]) => Promise<void>>(
            this,
            "updateReleasedOn",
          ),
        }),
      ]),
    ];
  }
}
