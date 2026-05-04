import { AdvancedSearchForm, Section, SelectRow } from "@paperback/types";
import type { JSONObject } from "@paperback/types";

export interface LOCGSearchMetadata extends JSONObject {
  format: string;
}

export class LOCGSearchForm extends AdvancedSearchForm {
  private format: string[];

  constructor(initialMeta?: LOCGSearchMetadata) {
    super();
    this.format = [initialMeta?.format ?? "series"];
  }

  async updateFormat(value: string[]): Promise<void> {
    this.format = value;
    this.reloadForm();
  }

  getSearchQueryMetadata() {
    return {
      searchMeta: {
        format: this.format[0] ?? "series",
      } satisfies LOCGSearchMetadata,
    };
  }

  override getSections() {
    return [
      Section("general", [
        SelectRow("format", {
          title: "Format",
          value: this.format,
          options: [
            { id: "series", title: "Series" },
            { id: "issue", title: "Issues" },
          ],
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector<LOCGSearchForm, (value: string[]) => Promise<void>>(
            this,
            "updateFormat",
          ),
        }),
      ]),
    ];
  }
}
