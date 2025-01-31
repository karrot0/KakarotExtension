import {
  ButtonRow,
  CloudflareError,
  Form,
  InputRow,
  LabelRow,
  ManagedCollectionProviding,
  Request,
  SearchResultItem,
  Section,
  SourceManga,
} from "@paperback/types";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import { xml } from "../utils/importer";
import { fetchRawText, isValidDataUrl } from "../utils/rawTextFetcher";
import { URLBuilder } from "../utils/url-builder/base";

const baseUrl = "https://mangafire.to";

export class MangaFireSettingsForm extends Form {
  private statusMessage: string = "";

  override getSections(): Application.FormSectionElement[] {
    return [
      Section("MangaFire Importer", [
        InputRow("mangafireUrl", {
          title: "Import URL (Pastebin/Raw)",
          value: "",
          onValueChange: async (txt) => {
            if (txt && !isValidDataUrl(txt)) {
              this.statusMessage =
                "Please enter a valid Pastebin or raw text URL";
              this.updateStatus();
            }
          },
        }),
        ButtonRow("import_button", {
          title: "Import MangaFire Collection",
          onSelect: async () => {
            const input = document.getElementById(
              "mangafireUrl",
            ) as HTMLInputElement;
            if (!input?.value) {
              this.statusMessage = "Please enter a valid URL";
              this.updateStatus();
              return;
            }
            await this.addToCollection(input.value);
          },
        }),
        LabelRow("status", {
          title: "Status",
          value: this.statusMessage,
        }),
      ]),
    ];
  }

  private updateStatus(): void {
    const statusLabel = document.getElementById("status") as HTMLElement;
    if (statusLabel) {
      statusLabel.textContent = this.statusMessage;
    }
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

  async addToCollection(url: string) {
    try {
      if (!isValidDataUrl(url)) {
        throw new Error(
          "Invalid URL format. Please use Pastebin or raw text URL",
        );
      }

      this.statusMessage = "Fetching data...";
      this.updateStatus();

      const rawText = await fetchRawText(url);
      if (!rawText) {
        throw new Error("No data found");
      }

      // Parse XML content
      this.statusMessage = "Processing XML data...";
      this.updateStatus();

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
        this.statusMessage = "Collection creation not implemented";
        this.updateStatus();
        return;
      }

      for (const manga of mangaList) {
        try {
          this.statusMessage = `Searching for: ${manga.title}`;
          this.updateStatus();

          const searchResults = await this.searchManga(manga.title);
          const match = await this.findBestMatch(manga.title, searchResults);

          if (match) {
            // Add to collection
            await (
              Application as unknown as ManagedCollectionProviding
            ).commitManagedCollectionChanges({
              collection,
              additions: [
                {
                  mangaId: match.mangaId,
                  mangaInfo: {
                    primaryTitle: match.title,
                  },
                } as SourceManga,
              ],
              deletions: [],
            });
            addedCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          failedCount++;
          console.error(`Failed to import: ${manga.title}`, err);
        }
      }

      this.statusMessage = `Import completed. Added: ${addedCount}, Failed: ${failedCount}`;
    } catch (error) {
      this.statusMessage = `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    }

    this.updateStatus();
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
