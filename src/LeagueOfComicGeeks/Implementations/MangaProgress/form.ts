import {
  ButtonRow,
  Form,
  type FormSectionElement,
  LabelRow,
  Section,
  SelectRow,
} from "@paperback/types";
import { addToList, getComics, removeFromList } from "../../Services/Requests";
import { LIST_IDS, LIST_NAMES } from "../Shared/models/main";
import { session } from "../Shared/parser/main";
import * as cheerio from "cheerio";

export class MangaProgressForm extends Form {
  loading = true;
  error: Error | null = null;
  currentListId: number | null = null;
  selectedListId: number | null = null;
  title = "";

  constructor(private readonly mangaId: string) {
    super();
  }

  override get requiresExplicitSubmission(): boolean {
    return true;
  }

  override formWillAppear(): void {
    session.assertMustBeAuthenticated();
    void this.loadData();
  }

  override async formDidSubmit(): Promise<void> {
    await this.saveChanges();
  }

  override getSections(): FormSectionElement[] {
    if (this.loading) {
      return [
        Section("loading", [
          LabelRow("loading", {
            title: "Loading...",
            subtitle: "Checking your collection status",
          }),
        ]),
      ];
    }

    if (this.error) {
      return [
        Section("error", [
          LabelRow("error", {
            title: "Error",
            subtitle: String(this.error),
          }),
        ]),
      ];
    }

    const listOptions = Object.entries(LIST_NAMES).map(([id, name]) => ({
      id,
      title: name,
    }));

    const selectedList =
      this.selectedListId != null
        ? [String(this.selectedListId)]
        : this.currentListId != null
          ? [String(this.currentListId)]
          : [];

    const inAnyList = this.currentListId != null;
    const currentListName = inAnyList ? LIST_NAMES[this.currentListId!] : "Not tracked";

    return [
      Section({ id: "status-section", header: "Tracking Status" }, [
        LabelRow("current-status", {
          title: "Current List",
          value: currentListName,
        }),
      ]),
      Section(
        {
          id: "list-section",
          header: "Manage Tracking",
          footer: "Select a list to add this series to, then tap Save.",
        },
        [
          SelectRow("list-select", {
            title: "Add to List",
            options: listOptions,
            value: selectedList,
            minItemCount: 0,
            maxItemCount: 1,
            onValueChange: Application.Selector(this as MangaProgressForm, "onListChange"),
          }),
        ],
      ),
      ...(inAnyList
        ? [
            Section({ id: "remove-section", footer: "Remove this series from your tracking list." }, [
              ButtonRow("remove-button", {
                title: "Remove from List",
                onSelect: Application.Selector(this as MangaProgressForm, "onRemove"),
              }),
            ]),
          ]
        : []),
    ];
  }

  async onListChange(listIds: string[]): Promise<void> {
    this.selectedListId = listIds[0] != null ? parseInt(listIds[0], 10) : null;
    this.reloadForm();
  }

  async onRemove(): Promise<void> {
    if (this.currentListId == null) return;
    const logPrefix = `[MangaProgressForm:onRemove] mangaId=${this.mangaId}`;
    console.log(`${logPrefix} starts`);
    try {
      this.loading = true;
      this.reloadForm();
      await removeFromList(this.mangaId, this.currentListId);
      this.currentListId = null;
      this.selectedListId = null;
      console.log(`${logPrefix} complete`);
    } catch (e) {
      this.error = e as Error;
      console.log(`${logPrefix} error: ${String(e)}`);
    } finally {
      this.loading = false;
      this.reloadForm();
    }
  }

  async saveChanges(): Promise<void> {
    const logPrefix = `[MangaProgressForm:save] mangaId=${this.mangaId}`;
    if (this.selectedListId == null) return;

    try {
      this.loading = true;
      this.reloadForm();

      // If already on a different list, remove first
      if (this.currentListId != null && this.currentListId !== this.selectedListId) {
        await removeFromList(this.mangaId, this.currentListId);
      }

      if (this.currentListId !== this.selectedListId) {
        await addToList(this.mangaId, this.selectedListId);
        this.currentListId = this.selectedListId;
      }

      this.selectedListId = null;
      console.log(`${logPrefix} complete`);
      // Verify the change actually saved by re-fetching status from the server
      void this.loadData();
    } catch (e) {
      this.error = e as Error;
      console.log(`${logPrefix} error: ${String(e)}`);
      throw e;
    } finally {
      this.loading = false;
      this.reloadForm();
    }
  }

  async loadData(): Promise<void> {
    const logPrefix = `[MangaProgressForm:loadData] mangaId=${this.mangaId}`;
    console.log(`${logPrefix} starts`);
    try {
      // Check collection (list 2, the primary list)
      const userSession = session.getSession();
      const userId = userSession?.userId;
      console.log(`${logPrefix} userId="${userId ?? ""}"`);

      // Extract numeric ID from URL-path mangaId once, reuse across loop
      const numericIdMatch = this.mangaId.match(/\/(\d+)(\/|$)/);
      const numericId = numericIdMatch ? numericIdMatch[1] : this.mangaId;
      console.log(`${logPrefix} numericId="${numericId}"`);

      // Resolve user_id: prefer session value, but fall back to my_user_id
      // returned by the API (populated from the authenticated session cookie).
      // We need the user_id before the loop so every list request is filtered.
      let resolvedUserId = userId ? String(userId) : undefined;
      if (!resolvedUserId) {
        try {
          const probe = await getComics({ list: LIST_IDS.COLLECTION, list_option: "series" });
          if (probe.myUserId) {
            resolvedUserId = String(probe.myUserId);
            console.log(`${logPrefix} resolved myUserId=${resolvedUserId} from API`);
          }
        } catch {
          // proceed without user_id — all list checks will return empty but won't crash
        }
      }

      const listToCheck = [
        LIST_IDS.COLLECTION,
        LIST_IDS.PULL_LIST,
        LIST_IDS.WISH_LIST,
        LIST_IDS.READ_LIST,
      ];

      for (const listId of listToCheck) {
        try {
          const response = await getComics({
            list: listId,
            list_option: "series",
            user_id: resolvedUserId,
          });

          if (response.list) {
            console.log(`${logPrefix} list ${listId} HTML preview: ${response.list.substring(0, 300)}`);
            const $ = cheerio.load(response.list);
            const found = $(`li .cover a[data-id="${numericId}"], li a[data-id="${numericId}"]`).length > 0;
            console.log(`${logPrefix} list ${listId} found=${found}`);
            if (found) {
              this.currentListId = listId;
              break;
            }
          }
        } catch {
          // skip this list check
        }
      }

      console.log(`${logPrefix} complete, currentListId=${this.currentListId}`);
    } catch (e) {
      this.error = e as Error;
      console.log(`${logPrefix} error: ${String(e)}`);
    } finally {
      this.loading = false;
      this.reloadForm();
    }
  }
}
