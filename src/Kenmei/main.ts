import { BasicRateLimiter, type Extension, type MangaProviding } from "@paperback/types";
import { applyMixins } from "./Implementations/helper";
import { DiscoverSectionImplementation } from "./Implementations/DiscoverSection/main";
import { MangaImplementation } from "./Implementations/Manga/main";
import { MangaProgressImplementation } from "./Implementations/MangaProgress/main";
import { SearchResultsImplementation } from "./Implementations/SearchResults/main";
import { SettingsFormImplementation } from "./Implementations/SettingsForm/main";

export interface KenmeiImplementation
  extends SettingsFormImplementation,
    SearchResultsImplementation,
    DiscoverSectionImplementation,
    MangaImplementation,
    MangaProgressImplementation {}

export class KenmeiExtension implements Omit<Extension, keyof MangaProviding> {
  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 10,
    bufferInterval: 1,
    ignoreImages: true,
  });

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
  }
}

applyMixins(KenmeiExtension, [
  SettingsFormImplementation,
  SearchResultsImplementation,
  DiscoverSectionImplementation,
  MangaImplementation,
  MangaProgressImplementation,
]);

export const Kenmei = new KenmeiExtension();
