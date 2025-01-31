import {
  ButtonRow,
  CloudflareError,
  ContentRating,
  Form,
  InputRow,
  ManagedCollectionProviding,
  Request,
  SearchResultItem,
  Section,
  SourceManga,
  TagSection,
} from "@paperback/types";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import { xml } from "../utils/importer";
import { fetchRawText, isValidDataUrl } from "../utils/rawTextFetcher";
import { URLBuilder } from "../utils/url-builder/base";

const baseUrl = "https://mangafire.to";

export class MangaFireSettingsForm extends Form {
  private mangaFireUrl: string = "";

  override getSections(): Application.FormSectionElement[] {
    return [
      Section("MangaFire Importer", [
        InputRow("mangafireUrl", {
          title: "Import URL (Pastebin/Raw)",
          value: "",
          onValueChange: async (txt) => {
            this.mangaFireUrl = txt;
          },
        }),
        ButtonRow("import_button", {
          title: "Import MangaFire Collection",
          onSelect: async () => {
            if (this.mangaFireUrl) {
              await this.addToCollection(this.mangaFireUrl);
            }
          },
        }),
      ]),
    ];
  }

  async getManga(page: number = 1) {
    const searchUrl = new URLBuilder(baseUrl).addPath("filter");

    const request = {
      url: searchUrl.build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const searchResults: SearchResultItem[] = [];

    $(".original.card-lg .unit .inner").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".info > a");
      const title = infoLink.text().trim();
      const image = unit.find("img").attr("src") || "";
      const mangaId = infoLink.attr("href")?.replace("/manga/", "") || "";

      searchResults.push({
        mangaId: mangaId,
        imageUrl: image,
        title: title,
        subtitle: undefined,
        metadata: undefined,
      });
    });

    // Check if there's a next page
    const hasNextPage = !!$(".page-item.active + .page-item .page-link").length;

    return {
      items: searchResults,
      metadata: hasNextPage ? { page: page + 1 } : undefined,
    };
  }

  async searchManga(title: string): Promise<SearchResultItem[]> {
    const searchUrl = new URLBuilder(baseUrl)
      .addPath("filter")
      .addQuery("keyword", title)
      .build();

    const request = {
      url: searchUrl,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const results: SearchResultItem[] = [];

    $(".original.card-lg .unit .inner").each((_, element) => {
      const unit = $(element);
      const infoLink = unit.find(".info > a");
      const title = infoLink.text().trim();
      const image = unit.find("img").attr("src") || "";
      const mangaId = infoLink.attr("href")?.replace("/manga/", "") || "";

      results.push({
        mangaId,
        imageUrl: image,
        title,
        subtitle: undefined,
        metadata: undefined,
      });
    });

    return results;
  }

  async findBestMatch(
    title: string,
    results: SearchResultItem[],
  ): Promise<SearchResultItem | null> {
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");

    return (
      results.find((result) => {
        const normalizedResult = result.title
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        return normalizedResult === normalizedTitle;
      }) || null
    );
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = {
      url: new URLBuilder(baseUrl).addPath("manga").addPath(mangaId).build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    // Extract basic manga details
    const title = $(".manga-detail .info h1").text().trim();
    const altTitles = [$(".manga-detail .info h6").text().trim()];
    const image = $(".manga-detail .poster img").attr("src") || "";
    const description = $(".manga-detail .info .description").text().trim();
    const authors: string[] = [];
    $("#info-rating .meta div").each((_, element) => {
      const label = $(element).find("span").first().text().trim();
      if (label === "Author:") {
        $(element)
          .find("a")
          .each((_, authorElement) => {
            authors.push($(authorElement).text().trim());
          });
      }
    });
    const status = $(".manga-detail .info .min-info")
      .text()
      .includes("Releasing")
      ? "ONGOING"
      : "COMPLETED";

    // Extract tags
    const tags: TagSection[] = [];
    const genres: string[] = [];
    let rating = 1;

    // Parse info-rating section
    $("#info-rating .meta div").each((_, element) => {
      const label = $(element).find("span").first().text().trim();
      if (label === "Genres:") {
        $(element)
          .find("a")
          .each((_, genreElement) => {
            genres.push($(genreElement).text().trim());
          });
      }
    });

    // Get rating if available
    const ratingValue = $("#info-rating .score .live-score").text().trim();
    if (ratingValue) {
      rating = parseFloat(ratingValue) / 2; // Convert 10-point scale to 5-point scale
    }

    if (genres.length > 0) {
      tags.push({
        id: "genres",
        title: "Genres",
        tags: genres.map((genre) => ({
          id: genre.toLowerCase(),
          title: genre,
        })),
      });
    }

    return {
      mangaId: mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: altTitles,
        thumbnailUrl: image,
        synopsis: description,
        rating: rating,
        contentRating: ContentRating.EVERYONE,
        status: status as "ONGOING" | "COMPLETED" | "UNKNOWN",
        tagGroups: tags,
      },
    };
  }

  async addToCollection(url: string) {
    try {
      if (!isValidDataUrl(url)) {
        throw new Error(
          "Invalid URL format. Please use Pastebin or raw text URL",
        );
      }

      const rawText = await fetchRawText(url);
      if (!rawText) {
        throw new Error("No data found");
      }

      // Parse XML content
      const mangaList = xml.parseMAL(rawText);
      if (mangaList.length === 0) {
        throw new Error("No manga found in the XML file");
      }

      let addedCount = 0;
      let failedCount = 0;
      const collectionName = "MAL Import";

      // Get or create managed collection
      const collections = await (
        Application as unknown as ManagedCollectionProviding
      ).getManagedLibraryCollections();

      const collection = collections.find((c) => c.title === collectionName);
      if (!collection) {
        throw new Error("Collection not found");
      }

      for (const manga of mangaList) {
        try {
          const searchResults = await this.searchManga(manga.title);
          const match = await this.findBestMatch(manga.title, searchResults);

          if (match) {
            // Get full manga details instead of basic info
            const sourceManga = await this.getMangaDetails(match.mangaId);

            await (
              Application as unknown as ManagedCollectionProviding
            ).commitManagedCollectionChanges({
              collection,
              additions: [sourceManga],
              deletions: [],
            });
            addedCount++;

            // Add small delay to prevent rate limiting
            await Application.sleep(0.5);
          } else {
            failedCount++;
          }
        } catch (err) {
          failedCount++;
          console.error(`Failed to import: ${manga.title}`, err);
        }
      }

      console.log(
        `Import completed. Added: ${addedCount}, Failed: ${failedCount}`,
      );
    } catch (error) {
      console.error(
        `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  checkCloudflareStatus(status: number): void {
    if (status == 503 || status == 403) {
      throw new CloudflareError({ url: baseUrl, method: "GET" });
    }
  }

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const [response, data] = await Application.scheduleRequest(request);
    this.checkCloudflareStatus(response.status);
    return cheerio.load(Application.arrayBufferToUTF8String(data));
  }
}
