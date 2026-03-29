import {
  Form,
  type ChapterReadActionQueueProcessingResult,
  type MangaProgress,
  type MangaProgressProviding,
  type SourceManga,
  type TrackedMangaChapterReadAction,
} from "@paperback/types";
import {
  getEntryBySeriesId,
  getMangaSourceChapters,
  getMangaSources,
  getSeriesDetail,
  updateEntryV2,
} from "../../Services/Requests";
import { assertMustBeAuthenticated } from "../Shared/session";
import { type KenmeiReadStatusCode } from "../Shared/types";
import { MangaProgressForm } from "./form";

export class MangaProgressImplementation implements MangaProgressProviding {
  async getMangaProgressManagementForm(sourceManga: SourceManga): Promise<Form> {
    assertMustBeAuthenticated();
    return new MangaProgressForm(sourceManga.mangaId);
  }

  async getMangaProgress(sourceManga: SourceManga): Promise<MangaProgress | undefined> {
    const session = assertMustBeAuthenticated();
    const logPrefix = `[Kenmei:getMangaProgress] mangaId=${sourceManga.mangaId}`;
    try {
      const seriesDetail = await getSeriesDetail(sourceManga.mangaId);
      const entry = await getEntryBySeriesId(seriesDetail.data.id);
      if (!entry || !entry.readChapter) return undefined;

      const statusCode = entry.attributes.status as KenmeiReadStatusCode;
      void statusCode;

      const lastReadChapter = entry.readChapter;
      return {
        sourceManga,
        lastReadChapter: {
          chapterId: String(lastReadChapter.chapter),
          sourceManga,
          langCode: "en",
          chapNum: lastReadChapter.chapter,
          title: lastReadChapter.title,
        },
        lastReadTime: entry.attributes.last_read_at
          ? new Date(entry.attributes.last_read_at)
          : undefined,
        userRating: entry.attributes.score > 0 ? entry.attributes.score : undefined,
      };
    } catch (e) {
      console.log(`${logPrefix} error: ${String(e)}`);
      void session;
      return undefined;
    }
  }

  async processChapterReadActionQueue(
    actions: TrackedMangaChapterReadAction[],
  ): Promise<ChapterReadActionQueueProcessingResult> {
    const logPrefix = "[Kenmei:processChapterReadActionQueue]";
    const successfulItems: string[] = [];
    const failedItems: string[] = [];

    console.log(`${logPrefix} starts - ${actions.length} action(s)`);

    // Group actions by manga and keep only the highest chapterNum per manga
    const byManga = actions.reduce<Record<string, TrackedMangaChapterReadAction>>(
      (acc, action) => {
        const id = action.sourceManga.mangaId;
        const existing = acc[id];
        if (!existing || action.chapterNum > existing.chapterNum) {
          acc[id] = action;
        }
        return acc;
      },
      {},
    );

    for (const [mangaId, action] of Object.entries(byManga)) {
      const mangaActions = actions.filter((a) => a.sourceManga.mangaId === mangaId);
      try {
        const seriesDetail = await getSeriesDetail(mangaId);
        const mangaSeriesId = seriesDetail.data.id;

        const entry = await getEntryBySeriesId(mangaSeriesId);
        if (!entry) {
          console.log(`${logPrefix} ${mangaId} not in user list, skipping`);
          successfulItems.push(...mangaActions.map((a) => a.id));
          continue;
        }

        let kenmeiChapterId: number | undefined;

        const entryMatch = entry.chapters.chapters.find(
          (c) =>
            c.chapterIdentifier === action.chapterSourceId ||
            c.chapter === action.chapterNum,
        );
        if (entryMatch?.id != null) {
          kenmeiChapterId = entryMatch.id;
        } else {
          // Fetch sources for this series and try each until we find a chapter match
          const sourcesResp = await getMangaSources(mangaSeriesId);
          for (const source of sourcesResp.data) {
            const chaptersResp = await getMangaSourceChapters(source.id);
            const match = chaptersResp.data.find(
              (c) =>
                c.chapterIdentifier === action.chapterSourceId ||
                c.chapter === action.chapterNum,
            );
            if (match != null) {
              kenmeiChapterId = match.id;
              break;
            }
          }
        }

        if (kenmeiChapterId != null) {
          await updateEntryV2(entry.id, { manga_source_chapter_id: kenmeiChapterId });
          console.log(
            `${logPrefix} updated ${mangaId} → chapter ${action.chapterNum} (id=${kenmeiChapterId})`,
          );
        } else {
          console.log(
            `${logPrefix} ${mangaId}: no matching chapter for num=${action.chapterNum} sourceId=${action.chapterSourceId}`,
          );
        }

        successfulItems.push(...mangaActions.map((a) => a.id));
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

