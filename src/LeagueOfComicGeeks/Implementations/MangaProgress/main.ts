import {
  type ChapterReadActionQueueProcessingResult,
  Form,
  type MangaProgress,
  type MangaProgressProviding,
  type SourceManga,
  type TrackedMangaChapterReadAction,
} from "@paperback/types";
import {
  getSeriesStatus,
  issueNumericId,
  seriesNumericId,
  setIssueOnList,
} from "../../Services/Requests";
import { LIST_IDS, type LOFCGSeriesStatus } from "../Shared/models/main";
import { comic, session } from "../Shared/parser/main";
import { MangaProgressForm } from "./form";

/**
 * League of Comic Geeks tracks every issue separately (pull, collection, read,
 * wish list, rating) rather than keeping one "chapters read" counter like AniList.
 * So each chapter you finish is matched to the issue with the same number and
 * only that issue is marked read; nothing else in the series is touched.
 */
export class MangaProgressImplementation implements MangaProgressProviding {
  async getMangaProgressManagementForm(sourceManga: SourceManga): Promise<Form> {
    session.assertMustBeAuthenticated();
    return new MangaProgressForm(sourceManga.mangaId);
  }

  async getMangaProgress(sourceManga: SourceManga): Promise<MangaProgress | undefined> {
    if (!session.getSession()) return undefined;

    const seriesId = seriesNumericId(sourceManga.mangaId);
    if (!seriesId) return undefined;

    const status = await getSeriesStatus(seriesId);
    const readIssues = status.issues.filter((i) => i.read && i.number !== null && !i.offNumbering);
    if (readIssues.length === 0) return undefined;

    const latest = readIssues.reduce((a, b) => ((b.number ?? 0) > (a.number ?? 0) ? b : a));
    return {
      sourceManga,
      lastReadChapter: {
        chapterId: latest.issueId,
        sourceManga,
        langCode: "🇬🇧",
        chapNum: latest.number ?? 0,
        title: latest.title,
        volume: 0,
      },
    };
  }

  async processChapterReadActionQueue(
    actions: TrackedMangaChapterReadAction[],
  ): Promise<ChapterReadActionQueueProcessingResult> {
    const logPrefix = "[MangaProgress:processChapterReadActionQueue]";
    const result: ChapterReadActionQueueProcessingResult = { successfulItems: [], failedItems: [] };

    const markRead = session.getAutoMarkRead();
    const addToCollection = session.getAutoAddToCollection();
    if (!session.getSession() || (!markRead && !addToCollection)) {
      // Nothing to send: clear the queue rather than retrying forever.
      result.successfulItems.push(...actions.map((a) => a.id));
      return result;
    }

    console.log(`${logPrefix} starts - ${actions.length} action(s)`);
    const seriesCache = new Map<string, LOFCGSeriesStatus>();

    for (const action of actions) {
      try {
        const done = await this.trackRead(action, seriesCache, markRead, addToCollection);
        console.log(`${logPrefix} ${action.sourceManga.mangaId} #${action.chapterNum}: ${done}`);
        result.successfulItems.push(action.id);
      } catch (e) {
        console.log(`${logPrefix} failed ${action.sourceManga.mangaId} #${action.chapterNum}: ${String(e)}`);
        result.failedItems.push(action.id);
      }
    }

    console.log(
      `${logPrefix} complete - success=${result.successfulItems.length} failed=${result.failedItems.length}`,
    );
    return result;
  }

  /** Marks the one issue matching this read; returns what happened, for the log. */
  private async trackRead(
    action: TrackedMangaChapterReadAction,
    seriesCache: Map<string, LOFCGSeriesStatus>,
    markRead: boolean,
    addToCollection: boolean,
  ): Promise<string> {
    const mangaId = action.sourceManga.mangaId;

    // Tracked as a single issue (e.g. opened from New This Week).
    const singleIssue = issueNumericId(mangaId);
    if (singleIssue) {
      if (markRead) await setIssueOnList(singleIssue, LIST_IDS.READ_LIST, true);
      if (addToCollection) await setIssueOnList(singleIssue, LIST_IDS.COLLECTION, true);
      return "marked single issue";
    }

    const seriesId = seriesNumericId(mangaId);
    if (!seriesId) return "skipped: not a series or issue id";

    let status = seriesCache.get(seriesId);
    if (!status) {
      status = await getSeriesStatus(seriesId);
      seriesCache.set(seriesId, status);
    }

    const issue = comic.findIssueForChapter(status.issues, action.chapterNum);
    // No issue with that number (a reading source numbering things differently):
    // nothing to mark, and retrying would not change that.
    if (!issue) return "skipped: no issue with that number";

    if (markRead && !issue.read) {
      await setIssueOnList(issue.issueId, LIST_IDS.READ_LIST, true);
      issue.read = true;
    }
    if (addToCollection && !issue.collected) {
      await setIssueOnList(issue.issueId, LIST_IDS.COLLECTION, true);
      issue.collected = true;
    }
    return `issue ${issue.title}`;
  }
}
