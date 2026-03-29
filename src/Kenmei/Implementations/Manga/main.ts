import {
  ContentRating,
  type MangaProviding,
  type SourceManga,
} from "@paperback/types";
import { getSeriesDetail } from "../../Services/Requests";

export class MangaImplementation implements MangaProviding {
  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const { data } = await getSeriesDetail(mangaId);

    const genres = data.classifications
      .filter((c) => c.category === "genre")
      .map((c) => c.name);

    const themes = data.classifications
      .filter((c) => c.category === "theme")
      .map((c) => c.name);

    const contentRating =
      data.contentRating === "Explicit"
        ? ContentRating.ADULT
        : data.contentRating === "Suggestive"
          ? ContentRating.MATURE
          : ContentRating.EVERYONE;

    const tagGroups = [];
    if (genres.length) {
      tagGroups.push({
        id: "genres",
        title: "Genres",
        tags: genres.map((g) => ({ id: g.toLowerCase().replace(/\s+/g, "-"), title: g })),
      });
    }
    if (themes.length) {
      tagGroups.push({
        id: "themes",
        title: "Themes",
        tags: themes.map((t) => ({ id: t.toLowerCase().replace(/\s+/g, "-"), title: t })),
      });
    }

    const thumbnailUrl =
      data.cover.jpeg?.large ??
      data.cover.webp?.large ??
      data.cover.twitter ??
      "";

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: data.title,
        secondaryTitles: data.alternativeTitles,
        thumbnailUrl,
        synopsis: data.description,
        rating: data.score ? parseFloat(data.score) : 0,
        contentRating,
        status: data.publicationStatus,
        tagGroups,
      },
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `https://www.kenmei.co/series/${mangaId}`;
  }
}
