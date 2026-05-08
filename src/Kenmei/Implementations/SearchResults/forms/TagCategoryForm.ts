import { FlowSection, Form, InputRow, LabelRow, Section } from "@paperback/types";

type TagCategory = {
  id: string;
  label: string;
  tags: Array<{ id: string; name: string }>;
};

export type TagCategoryState = {
  included: string[];
  excluded: string[];
};

type TagState = "none" | "included" | "excluded";

const STATE_PREFIX: Record<TagState, string> = {
  none: "",
  included: "✓ ",
  excluded: "X ",
};

export const KENMEI_TAG_CATEGORY: TagCategory = {
  id: "kenmei",
  label: "Tags",
  tags: [
    { id: "action", name: "Action" },
    { id: "adventure", name: "Adventure" },
    { id: "comedy", name: "Comedy" },
    { id: "drama", name: "Drama" },
    { id: "fantasy", name: "Fantasy" },
    { id: "horror", name: "Horror" },
    { id: "mystery", name: "Mystery" },
    { id: "psychological", name: "Psychological" },
    { id: "romance", name: "Romance" },
    { id: "scifi", name: "Sci-Fi" },
    { id: "slice_of_life", name: "Slice of Life" },
    { id: "sports", name: "Sports" },
    { id: "crossdressing", name: "Crossdressing" },
    { id: "delinquents", name: "Delinquents" },
    { id: "harem", name: "Harem" },
    { id: "martial_arts", name: "Martial Arts" },
    { id: "military", name: "Military" },
    { id: "music", name: "Music" },
    { id: "reincarnation", name: "Reincarnation" },
    { id: "reverse_harem", name: "Reverse Harem" },
    { id: "samurai", name: "Samurai" },
    { id: "school", name: "School" },
    { id: "survival", name: "Survival" },
    { id: "boys_love", name: "Boys' Love" },
    { id: "girls_love", name: "Girls' Love" },
    { id: "villainess", name: "Villainess" },
    { id: "mecha", name: "Mecha" },
    { id: "vampire", name: "Vampire" },
    { id: "historical", name: "Historical" },
    { id: "regression", name: "Regression" },
    { id: "female_protagonist", name: "Female Protagonist" },
    { id: "male_protagonist", name: "Male Protagonist" },
    { id: "gore", name: "Gore" },
    { id: "suicide", name: "Suicide" },
    { id: "torture", name: "Torture" },
  ],
};

export class TagCategoryForm extends Form {
  private category: TagCategory;
  private tagStateMap: Map<string, TagState>;
  private searchQuery: string;

  constructor(category: TagCategory, initialState: TagCategoryState = { included: [], excluded: [] }) {
    super();
    this.category = category;
    this.searchQuery = "";

    this.tagStateMap = new Map();
    for (const tag of category.tags) {
      if (initialState.included.includes(tag.id)) {
        this.tagStateMap.set(tag.id, "included");
      } else if (initialState.excluded.includes(tag.id)) {
        this.tagStateMap.set(tag.id, "excluded");
      } else {
        this.tagStateMap.set(tag.id, "none");
      }
    }

    (this as any)["onSearchChange"] = async (value: string) => {
      this.searchQuery = value;
      this.reloadForm();
    };

    for (const tag of category.tags) {
      (this as any)[`toggle_${tag.id}`] = async () => {
        const current = this.tagStateMap.get(tag.id) ?? "none";
        const next: TagState =
          current === "none" ? "included" : current === "included" ? "excluded" : "none";
        this.tagStateMap.set(tag.id, next);
        this.reloadForm();
      };
    }
  }

  getState(): TagCategoryState {
    const included: string[] = [];
    const excluded: string[] = [];
    for (const [id, state] of this.tagStateMap) {
      if (state === "included") included.push(id);
      else if (state === "excluded") excluded.push(id);
    }
    return { included, excluded };
  }

  override getSections() {
    const query = this.searchQuery.toLowerCase().trim();

    return [
      Section("search", [
        InputRow("search_input", {
          title: "Search",
          value: this.searchQuery,
          onValueChange: Application.Selector(this as any, "onSearchChange"),
        }),
      ]),
      FlowSection(
        {
          id: `${this.category.id}_tags`,
          footer: "Tap once to include · Tap again to exclude · Tap once more to reset",
        },
        this.category.tags.map((tag) => {
          const state = this.tagStateMap.get(tag.id) ?? "none";
          const hidden = query.length > 0 && !tag.name.toLowerCase().includes(query);
          return LabelRow(`tag_${tag.id}`, {
            title: `${STATE_PREFIX[state]}${tag.name}`,
            isHidden: hidden,
            onSelect: Application.Selector(this as any, `toggle_${tag.id}`),
          });
        }),
      ),
    ];
  }
}