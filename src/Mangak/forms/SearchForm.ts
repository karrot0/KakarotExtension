import { AdvancedSearchForm, NavigationRow, Section, SelectRow } from "@paperback/types";
import type { JSONObject } from "@paperback/types";
import { TagFilterForm, type TagFilterState } from "./TagFilterForm";

export interface BuddySearchMetadata extends JSONObject {
  genreIncluded: string[];
  genreExcluded: string[];
  status: string;
  orderby: string;
}

const GENRE_LIST = [
  { id: "action", name: "Action" },
  { id: "adaptation", name: "Adaptation" },
  { id: "adult", name: "Adult" },
  { id: "adventure", name: "Adventure" },
  { id: "animal", name: "Animal" },
  { id: "anthology", name: "Anthology" },
  { id: "cartoon", name: "Cartoon" },
  { id: "comedy", name: "Comedy" },
  { id: "comic", name: "Comic" },
  { id: "cooking", name: "Cooking" },
  { id: "demons", name: "Demons" },
  { id: "doujinshi", name: "Doujinshi" },
  { id: "drama", name: "Drama" },
  { id: "ecchi", name: "Ecchi" },
  { id: "fantasy", name: "Fantasy" },
  { id: "full-color", name: "Full Color" },
  { id: "game", name: "Game" },
  { id: "gender-bender", name: "Gender Bender" },
  { id: "ghosts", name: "Ghosts" },
  { id: "harem", name: "Harem" },
  { id: "historical", name: "Historical" },
  { id: "horror", name: "Horror" },
  { id: "isekai", name: "Isekai" },
  { id: "josei", name: "Josei" },
  { id: "long-strip", name: "Long Strip" },
  { id: "mafia", name: "Mafia" },
  { id: "magic", name: "Magic" },
  { id: "manga", name: "Manga" },
  { id: "manhua", name: "Manhua" },
  { id: "manhwa", name: "Manhwa" },
  { id: "martial-arts", name: "Martial Arts" },
  { id: "mature", name: "Mature" },
  { id: "mecha", name: "Mecha" },
  { id: "medical", name: "Medical" },
  { id: "military", name: "Military" },
  { id: "monster", name: "Monster" },
  { id: "monster-girls", name: "Monster Girls" },
  { id: "monsters", name: "Monsters" },
  { id: "music", name: "Music" },
  { id: "mystery", name: "Mystery" },
  { id: "office", name: "Office" },
  { id: "office-workers", name: "Office Workers" },
  { id: "one-shot", name: "One Shot" },
  { id: "police", name: "Police" },
  { id: "psychological", name: "Psychological" },
  { id: "reincarnation", name: "Reincarnation" },
  { id: "romance", name: "Romance" },
  { id: "school-life", name: "School Life" },
  { id: "sci-fi", name: "Sci-Fi" },
  { id: "science-fiction", name: "Science Fiction" },
  { id: "seinen", name: "Seinen" },
  { id: "shoujo", name: "Shoujo" },
  { id: "shoujo-ai", name: "Shoujo Ai" },
  { id: "shounen", name: "Shounen" },
  { id: "shounen-ai", name: "Shounen Ai" },
  { id: "slice-of-life", name: "Slice of Life" },
  { id: "smut", name: "Smut" },
  { id: "soft-yaoi", name: "Soft Yaoi" },
  { id: "sports", name: "Sports" },
  { id: "super-power", name: "Super Power" },
  { id: "superhero", name: "Superhero" },
  { id: "supernatural", name: "Supernatural" },
  { id: "thriller", name: "Thriller" },
  { id: "time-travel", name: "Time Travel" },
  { id: "tragedy", name: "Tragedy" },
  { id: "vampire", name: "Vampire" },
  { id: "vampires", name: "Vampires" },
  { id: "video-games", name: "Video Games" },
  { id: "villainess", name: "Villainess" },
  { id: "web-comic", name: "Web Comic" },
  { id: "webtoons", name: "Webtoons" },
  { id: "yaoi", name: "Yaoi" },
  { id: "yuri", name: "Yuri" },
  { id: "zombies", name: "Zombies" },
];

export class MangabuddySearchForm extends AdvancedSearchForm {
  private status: string[];
  private orderby: string[];
  private genreForm: TagFilterForm;

  constructor(initialMeta?: BuddySearchMetadata) {
    super();
    this.status = initialMeta?.status ? [initialMeta.status] : ["all"];
    this.orderby = initialMeta?.orderby ? [initialMeta.orderby] : ["relevance"];

    this.genreForm = new TagFilterForm(GENRE_LIST, "genres", {
      included: initialMeta?.genreIncluded ?? [],
      excluded: initialMeta?.genreExcluded ?? [],
    });
  }

  async updateStatus(value: string[]): Promise<void> {
    this.status = value;
    this.reloadForm();
  }

  async updateOrderby(value: string[]): Promise<void> {
    this.orderby = value;
    this.reloadForm();
  }

  getSearchQueryMetadata() {
    const genres: TagFilterState = this.genreForm.getState();
    return {
      searchMeta: {
        genreIncluded: genres.included,
        genreExcluded: genres.excluded,
        status: this.status[0] ?? "all",
        orderby: this.orderby[0] ?? "views",
      } satisfies BuddySearchMetadata,
    };
  }

  private getGenreSubtitle(): string {
    const state = this.genreForm.getState();
    const total = state.included.length + state.excluded.length;
    return total > 0 ? `${total} selected` : "";
  }

  override getSections() {
    return [
      Section("general", [
        SelectRow("status", {
          title: "Status",
          value: this.status,
          options: [
            { id: "all", title: "All" },
            { id: "ongoing", title: "Ongoing" },
            { id: "completed", title: "Completed" },
          ],
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector<MangabuddySearchForm, (value: string[]) => Promise<void>>(
            this,
            "updateStatus",
          ),
        }),
        SelectRow("orderby", {
          title: "Sort By",
          value: this.orderby,
          options: [
            { id: "relevance", title: "Relevance" },
            { id: "views", title: "Views" },
            { id: "updated", title: "Updated" },
            { id: "created", title: "Created" },
            { id: "name", title: "Name A-Z" },
            { id: "rating", title: "Rating" },
          ],
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector<MangabuddySearchForm, (value: string[]) => Promise<void>>(
            this,
            "updateOrderby",
          ),
        }),
      ]),
      Section("genres_section", [
        NavigationRow("genres_nav", {
          title: "Genres",
          subtitle: this.getGenreSubtitle(),
          form: this.genreForm,
        }),
      ]),
    ];
  }
}
