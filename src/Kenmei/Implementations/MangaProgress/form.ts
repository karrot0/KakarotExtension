import {
  ButtonRow,
  Form,
  InputRow,
  LabelRow,
  Section,
  SelectRow,
  StepperRow,
  ToggleRow,
} from "@paperback/types";
import {
  createEntryV2,
  deleteEntryV2,
  getEntryBySeriesId,
  getSeriesDetail,
  updateEntryV2,
} from "../../Services/Requests";
import { assertMustBeAuthenticated } from "../Shared/session";
import {
  KENMEI_READ_STATUS_LABELS,
  KENMEI_STATUS_CODES,
  KENMEI_STATUS_TO_CODE,
  type KenmeiEntryV2,
  type KenmeiReadStatus,
  type KenmeiReadStatusCode,
} from "../Shared/types";

export class MangaProgressForm extends Form {
  loading = true;
  error: Error | null = null;
  entry: KenmeiEntryV2 | null = null;
  seriesId: number | null = null;
  mangaSourceId: number | null = null;

  // Pending edits (all null = unchanged)
  selectedStatus: KenmeiReadStatus | null = null;
  selectedChapterId: number | null = null;
  selectedScore: number | null = null;
  selectedNotes: string | null = null;
  selectedHidden: boolean | null = null;
  selectedFavourite: boolean | null = null;

  constructor(private readonly mangaId: string) {
    super();
  }

  override get requiresExplicitSubmission(): boolean {
    return true;
  }

  override formWillAppear(): void {
    assertMustBeAuthenticated();
    void this.loadData();
  }

  override async formDidSubmit(): Promise<void> {
    await this.saveChanges();
  }

  override getSections() {
    if (this.loading) {
      return [
        Section("loading", [
          LabelRow("loading", { title: "Loading...", subtitle: "Fetching your tracking status" }),
        ]),
      ];
    }

    if (this.error) {
      return [
        Section("error", [
          LabelRow("error", { title: "Error", subtitle: String(this.error) }),
        ]),
      ];
    }

    const statusOptions = Object.entries(KENMEI_READ_STATUS_LABELS).map(([id, title]) => ({
      id,
      title,
    }));

    const currentStatusCode = this.entry?.attributes.status as KenmeiReadStatusCode | undefined;
    const currentStatus =
      currentStatusCode != null ? (KENMEI_STATUS_CODES[currentStatusCode] ?? null) : null;

    const statusValue =
      this.selectedStatus != null
        ? [this.selectedStatus]
        : currentStatus != null
          ? [currentStatus]
          : [];

    const currentLabel =
      currentStatus != null ? KENMEI_READ_STATUS_LABELS[currentStatus] : "Not tracked";

    // Chapter selector — build options from the entry's available chapters
    const chapterOptions =
      this.entry?.chapters.chapters.map((c) => ({
        id: String(c.id),
        title: c.title ? `Ch. ${c.chapter} – ${c.title}` : `Ch. ${c.chapter}`,
      })) ?? [];

    const currentChapterId =
      this.entry?.mangaSourceChapter?.id != null
        ? String(this.entry.mangaSourceChapter.id)
        : null;

    const chapterValue =
      this.selectedChapterId != null
        ? [String(this.selectedChapterId)]
        : currentChapterId != null
          ? [currentChapterId]
          : [];

    const score = this.selectedScore ?? this.entry?.attributes.score ?? 0;
    const notes = this.selectedNotes ?? this.entry?.attributes.notes ?? "";
    const hidden = this.selectedHidden ?? this.entry?.attributes.hidden ?? false;
    const favourite = this.selectedFavourite ?? this.entry?.attributes.favourite ?? false;

    return [
      // ── Status ──────────────────────────────────────────────────────────────
      Section({ id: "status-section", header: "Tracking Status" }, [
        LabelRow("current-status", {
          title: "Current Status",
          value: currentLabel,
        }),
      ]),
      Section(
        {
          id: "edit-section",
          header: "Update Status",
          footer: "Select a status and tap Save.",
        },
        [
          SelectRow("status-select", {
            title: "Status",
            options: statusOptions,
            value: statusValue,
            minItemCount: 0,
            maxItemCount: 1,
            onValueChange: Application.Selector(this as MangaProgressForm, "onStatusChange"),
          }),
        ],
      ),

      // ── Last read chapter ────────────────────────────────────────────────────
      ...(chapterOptions.length > 0
        ? [
            Section(
              {
                id: "chapter-section",
                header: "Last Read Chapter",
                footer: "Select the last chapter you read.",
              },
              [
                SelectRow("chapter-select", {
                  title: "Chapter",
                  options: chapterOptions,
                  value: chapterValue,
                  minItemCount: 0,
                  maxItemCount: 1,
                  onValueChange: Application.Selector(
                    this as MangaProgressForm,
                    "onChapterChange",
                  ),
                }),
              ],
            ),
          ]
        : []),

      // ── Rating & Notes ───────────────────────────────────────────────────────
      Section(
        {
          id: "rating-section",
          header: "Rating & Notes",
          footer: "Score from 0 (unrated) to 10.",
        },
        [
          StepperRow("score", {
            title: "Score",
            value: score,
            minValue: 0,
            maxValue: 10,
            stepValue: 1,
            loopOver: false,
            onValueChange: Application.Selector(this as MangaProgressForm, "onScoreChange"),
          }),
          InputRow("notes", {
            title: "Notes",
            value: notes,
            onValueChange: Application.Selector(this as MangaProgressForm, "onNotesChange"),
          }),
        ],
      ),

      // ── Privacy ──────────────────────────────────────────────────────────────
      Section(
        {
          id: "privacy-section",
          header: "Privacy",
          footer: "Hidden entries are not shown on your public profile.",
        },
        [
          ToggleRow("hidden", {
            title: "Hidden",
            value: hidden,
            onValueChange: Application.Selector(this as MangaProgressForm, "onHiddenChange"),
          }),
          ToggleRow("favourite", {
            title: "Favourite",
            value: favourite,
            onValueChange: Application.Selector(this as MangaProgressForm, "onFavouriteChange"),
          }),
        ],
      ),

      // ── Remove ───────────────────────────────────────────────────────────────
      ...(this.entry != null
        ? [
            Section(
              { id: "remove-section", footer: "Remove this series from your Kenmei library." },
              [
                ButtonRow("remove-button", {
                  title: "Remove from Kenmei",
                  onSelect: Application.Selector(this as MangaProgressForm, "onRemove"),
                }),
              ],
            ),
          ]
        : []),
    ];
  }

  async onStatusChange(statuses: string[]): Promise<void> {
    this.selectedStatus = (statuses[0] as KenmeiReadStatus) ?? null;
    this.reloadForm();
  }

  async onChapterChange(ids: string[]): Promise<void> {
    this.selectedChapterId = ids[0] != null ? parseInt(ids[0], 10) : null;
    this.reloadForm();
  }

  async onScoreChange(value: number): Promise<void> {
    this.selectedScore = value;
    this.reloadForm();
  }

  async onNotesChange(value: string): Promise<void> {
    this.selectedNotes = value;
    this.reloadForm();
  }

  async onHiddenChange(value: boolean): Promise<void> {
    this.selectedHidden = value;
    this.reloadForm();
  }

  async onFavouriteChange(value: boolean): Promise<void> {
    this.selectedFavourite = value;
    this.reloadForm();
  }

  async onRemove(): Promise<void> {
    if (!this.entry) return;
    const logPrefix = `[MangaProgressForm:onRemove] mangaId=${this.mangaId}`;
    console.log(`${logPrefix} starts`);
    try {
      this.loading = true;
      this.reloadForm();
      await deleteEntryV2(this.entry.id);
      this.entry = null;
      this.selectedStatus = null;
      console.log(`${logPrefix} complete`);
    } catch (e) {
      this.error = e as Error;
      console.log(`${logPrefix} error: ${String(e)}`);
    } finally {
      this.loading = false;
      this.reloadForm();
    }
  }

  private async loadData(): Promise<void> {
    const logPrefix = `[MangaProgressForm:loadData] mangaId=${this.mangaId}`;
    console.log(`${logPrefix} starts`);
    try {
      const seriesDetail = await getSeriesDetail(this.mangaId);
      this.seriesId = seriesDetail.data.id;
      this.mangaSourceId = seriesDetail.data.mangaSources[0]?.id ?? null;

      this.entry = await getEntryBySeriesId(this.seriesId);
      console.log(`${logPrefix} entry=${this.entry?.id ?? "none"}`);
    } catch (e) {
      this.error = e as Error;
      console.log(`${logPrefix} error: ${String(e)}`);
    } finally {
      this.loading = false;
      this.reloadForm();
    }
  }

  private async saveChanges(): Promise<void> {
    const logPrefix = `[MangaProgressForm:saveChanges] mangaId=${this.mangaId}`;
    if (!this.seriesId) return;

    const currentStatusCode = this.entry?.attributes.status as KenmeiReadStatusCode | undefined;
    const currentStatus = currentStatusCode != null ? (KENMEI_STATUS_CODES[currentStatusCode] ?? "reading") : "reading";
    const statusToSave = this.selectedStatus ?? (this.entry ? currentStatus : null);
    if (!statusToSave) return;

    const statusCode = KENMEI_STATUS_TO_CODE[statusToSave];

    const payload: Parameters<typeof updateEntryV2>[1] = { status: statusCode };

    if (this.selectedChapterId != null) {
      payload.manga_source_chapter_id = this.selectedChapterId;
    }
    if (this.selectedScore != null) {
      payload.score = this.selectedScore;
    }
    if (this.selectedNotes != null) {
      payload.notes = this.selectedNotes;
    }
    if (this.selectedHidden != null) {
      payload.hidden = this.selectedHidden;
    }
    if (this.selectedFavourite != null) {
      payload.favourite = this.selectedFavourite;
    }

    console.log(`${logPrefix} starts - status=${statusToSave} (${statusCode})`);
    try {
      if (this.entry) {
        this.entry = await updateEntryV2(this.entry.id, payload);
      } else {
        this.entry = await createEntryV2({
          status: statusCode,
          manga_source_id: this.mangaSourceId ?? undefined,
          ...(this.selectedChapterId != null && { manga_source_chapter_id: this.selectedChapterId }),
          ...(this.selectedScore != null && { score: this.selectedScore }),
          ...(this.selectedNotes != null && { notes: this.selectedNotes }),
          ...(this.selectedHidden != null && { hidden: this.selectedHidden }),
          ...(this.selectedFavourite != null && { favourite: this.selectedFavourite }),
        });
      }
      // Reset all pending edits
      this.selectedStatus = null;
      this.selectedChapterId = null;
      this.selectedScore = null;
      this.selectedNotes = null;
      this.selectedHidden = null;
      this.selectedFavourite = null;
      console.log(`${logPrefix} complete`);
    } catch (e) {
      console.log(`${logPrefix} error: ${String(e)}`);
      throw e;
    }
  }
}

