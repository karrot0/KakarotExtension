import {
  AdvancedSearchForm,
  Section,
  SelectRow,
  type JSONObject,
} from "@paperback/types";

export interface ReadComicsOnlineSearchMeta extends JSONObject {
  status: string;
  types: string;
  categories: string;
}

// Matches the `status_id` <select> options on https://readcomicsonline.ru/advanced-search
export const STATUS_OPTIONS = [
  { id: "", title: "Any" },
  { id: "1", title: "Ongoing" },
  { id: "2", title: "Complete" },
];

// Matches the `type_id` <select> options on https://readcomicsonline.ru/advanced-search
export const TYPE_OPTIONS = [
  { id: "", title: "Any" },
  { id: "1", title: "DC Comics" },
  { id: "2", title: "Marvel Comics" },
  { id: "3", title: "Other Comics" },
];

// Matches the `category` <select> options on https://readcomicsonline.ru/advanced-search
export const CATEGORY_OPTIONS = [
  { id: "", title: "Any" },
  { id: "17", title: "One Shots & TPBs" },
  { id: "33", title: "DC Comics" },
  { id: "34", title: "Marvel Comics" },
  { id: "35", title: "Boom Studios" },
  { id: "36", title: "Dynamite" },
  { id: "37", title: "Rebellion" },
  { id: "38", title: "Dark Horse" },
  { id: "39", title: "IDW" },
  { id: "40", title: "Archie" },
  { id: "41", title: "Graphic India" },
  { id: "42", title: "Darby Pop" },
  { id: "43", title: "Oni Press" },
  { id: "44", title: "Icon Comics" },
  { id: "45", title: "United Plankton" },
  { id: "46", title: "Udon" },
  { id: "47", title: "Image Comics" },
  { id: "48", title: "Valiant" },
  { id: "49", title: "Vertigo" },
  { id: "50", title: "Devils Due" },
  { id: "51", title: "Aftershock Comics" },
  { id: "52", title: "Antartic Press" },
  { id: "53", title: "Action Lab" },
  { id: "54", title: "American Mythology" },
  { id: "55", title: "Zenescope" },
  { id: "56", title: "Top Cow" },
  { id: "57", title: "Hermes Press" },
  { id: "58", title: "451" },
  { id: "59", title: "Black Mask" },
  { id: "60", title: "Chapterhouse Comics" },
  { id: "61", title: "Red 5" },
  { id: "62", title: "Heavy Metal" },
  { id: "63", title: "Bongo" },
  { id: "64", title: "Top Shelf" },
  { id: "65", title: "Bubble" },
  { id: "66", title: "Boundless" },
  { id: "67", title: "Avatar Press" },
  { id: "68", title: "Space Goat Productions" },
  { id: "69", title: "BroadSword Comics" },
  { id: "70", title: "AAM-Markosia" },
  { id: "71", title: "Fantagraphics" },
  { id: "72", title: "Aspen" },
  { id: "73", title: "American Gothic Press" },
  { id: "74", title: "Vault" },
  { id: "75", title: "215 Ink" },
  { id: "76", title: "Abstract Studio" },
  { id: "77", title: "Albatross" },
  { id: "78", title: "ARH Comix" },
  { id: "79", title: "Legendary Comics" },
  { id: "80", title: "Monkeybrain" },
  { id: "81", title: "Joe Books" },
  { id: "82", title: "MAD" },
  { id: "83", title: "Comics Experience" },
  { id: "84", title: "Alterna Comics" },
  { id: "85", title: "Lion Forge" },
  { id: "86", title: "Benitez" },
  { id: "87", title: "Storm King" },
  { id: "88", title: "Sucker" },
  { id: "89", title: "Amryl Entertainment" },
  { id: "90", title: "Ahoy Comics" },
  { id: "91", title: "Mad Cave" },
  { id: "92", title: "Coffin Comics" },
  { id: "93", title: "Magnetic Press" },
  { id: "94", title: "Ablaze" },
  { id: "95", title: "Europe Comics" },
  { id: "96", title: "Humanoids" },
  { id: "97", title: "TKO" },
  { id: "98", title: "Soleil" },
  { id: "99", title: "SAF Comics" },
  { id: "100", title: "Scholastic" },
  { id: "101", title: "AWA Studios" },
  { id: "102", title: "Stranger Comics" },
  { id: "103", title: "Inverse" },
  { id: "104", title: "Virus" },
  { id: "105", title: "Black Panel Press" },
  { id: "106", title: "Scout Comics" },
  { id: "107", title: "Source Point Press" },
  { id: "108", title: "First Second" },
  { id: "109", title: "DSTLRY" },
  { id: "110", title: "Yen Press" },
  { id: "111", title: "Alien Books" },
  { id: "112", title: "Ignition Press" },
];

export class ReadComicsOnlineSearchForm extends AdvancedSearchForm {
  private status: string;
  private types: string;
  private categories: string;

  constructor(initialMeta?: ReadComicsOnlineSearchMeta) {
    super();
    this.status = initialMeta?.status ?? "";
    this.types = initialMeta?.types ?? "";
    this.categories = initialMeta?.categories ?? "";
  }

  async updateStatus(value: string[]): Promise<void> {
    this.status = value[0] ?? "";
    this.reloadForm();
  }

  async updateTypes(value: string[]): Promise<void> {
    this.types = value[0] ?? "";
    this.reloadForm();
  }

  async updateCategories(value: string[]): Promise<void> {
    this.categories = value[0] ?? "";
    this.reloadForm();
  }

  getSearchQueryMetadata() {
    return {
      searchMeta: {
        status: this.status,
        types: this.types,
        categories: this.categories,
      } satisfies ReadComicsOnlineSearchMeta,
    };
  }

  override getSections() {
    return [
      Section("filters", [
        SelectRow("status", {
          title: "Status",
          value: this.status ? [this.status] : [],
          options: STATUS_OPTIONS,
          minItemCount: 0,
          maxItemCount: 1,
          onValueChange: Application.Selector<
            ReadComicsOnlineSearchForm,
            (value: string[]) => Promise<void>
          >(this, "updateStatus"),
        }),
        SelectRow("types", {
          title: "Type",
          value: this.types ? [this.types] : [],
          options: TYPE_OPTIONS,
          minItemCount: 0,
          maxItemCount: 1,
          onValueChange: Application.Selector<
            ReadComicsOnlineSearchForm,
            (value: string[]) => Promise<void>
          >(this, "updateTypes"),
        }),
        SelectRow("categories", {
          title: "Category",
          value: this.categories ? [this.categories] : [],
          options: CATEGORY_OPTIONS,
          minItemCount: 0,
          maxItemCount: 1,
          onValueChange: Application.Selector<
            ReadComicsOnlineSearchForm,
            (value: string[]) => Promise<void>
          >(this, "updateCategories"),
        }),
      ]),
    ];
  }
}
