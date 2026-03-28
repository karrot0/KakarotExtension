import {
  type ChapterReadActionQueueProcessingResult,
  Form,
  type MangaProgress,
  type MangaProgressProviding,
  type SourceManga,
  type TrackedMangaChapterReadAction,
} from "@paperback/types";
import { addToList } from "../../Services/Requests";
import { LIST_IDS } from "../Shared/models/main";
import { session } from "../Shared/parser/main";
import { MangaProgressForm } from "./form";

export class MangaProgressImplementation implements MangaProgressProviding {
  async getMangaProgressManagementForm(sourceManga: SourceManga): Promise<Form> {
    session.assertMustBeAuthenticated();
    return new MangaProgressForm(sourceManga.mangaId);
  }

  async getMangaProgress(sourceManga: SourceManga): Promise<MangaProgress | undefined> {
    // LOCG doesn't expose a per-series progress endpoint.
    // Return undefined and let the management form handle status.
    void sourceManga;
    return undefined;
  }

  async processChapterReadActionQueue(
    actions: TrackedMangaChapterReadAction[],
  ): Promise<ChapterReadActionQueueProcessingResult> {
    const logPrefix = "[MangaProgress:processChapterReadActionQueue]";
    const successfulItems: string[] = [];
    const failedItems: string[] = [];

    console.log(`${logPrefix} starts - ${actions.length} action(s)`);

    // Group by manga series
    const byManga = actions.reduce<Record<string, TrackedMangaChapterReadAction[]>>(
      (acc, action) => {
        const id = action.sourceManga.mangaId;
        if (!acc[id]) acc[id] = [];
        acc[id]?.push(action);
        return acc;
      },
      {},
    );

    for (const [mangaId, mangaActions] of Object.entries(byManga)) {
      try {
        // Add series to Collection when a chapter is first read
        await addToList(mangaId, LIST_IDS.COLLECTION);
        successfulItems.push(...mangaActions.map((a) => a.id));
        console.log(`${logPrefix} added ${mangaId} to collection`);
      } catch (e) {
        console.log(`${logPrefix} failed for ${mangaId}: ${String(e)}`);
        failedItems.push(...mangaActions.map((a) => a.id));
      }
    }

    console.log(
      `${logPrefix} complete - success=${successfulItems.length} failed=${failedItems.length}`,
    );
    return { successfulItems, failedItems };
  }
}
