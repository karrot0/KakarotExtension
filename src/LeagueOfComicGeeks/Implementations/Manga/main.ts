import { ContentRating, type MangaProviding, type SourceManga } from "@paperback/types";
import { getSeriesPage } from "../../Services/Requests";
import { comic } from "../Shared/parser/main";

export class MangaImplementation implements MangaProviding {
  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const logPrefix = `[Manga:getMangaDetails] mangaId=${mangaId}`;
    console.log(`${logPrefix} starts`);

    try {
      const html = await getSeriesPage(mangaId);
      const result = comic.parseSeriesPageDetails(html, mangaId);
      console.log(`${logPrefix} complete: ${result.mangaInfo.primaryTitle}`);
      return result;
    } catch (e) {
      console.log(`${logPrefix} error: ${String(e)}`);
      // Return a minimal SourceManga if details fetch fails
      return {
        mangaId,
        mangaInfo: {
          primaryTitle: `Series #${mangaId}`,
          secondaryTitles: [],
          thumbnailUrl: "",
          synopsis: "",
          rating: undefined,
          contentRating: ContentRating.EVERYONE,
          status: undefined,
          author: undefined,
          artist: undefined,
          tagGroups: [],
        },
      };
    }
  }
}
