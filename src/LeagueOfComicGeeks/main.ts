import { BasicRateLimiter, CookieStorageInterceptor, type Extension, type MangaProviding } from "@paperback/types";
import { DiscoverSectionImplementation } from "./Implementations/DiscoverSection/main";
import { applyMixins } from "./Implementations/helper";
import { MangaImplementation } from "./Implementations/Manga/main";
import { MangaProgressImplementation } from "./Implementations/MangaProgress/main";
import { SearchResultsImplementation } from "./Implementations/SearchResults/main";
import { SettingsFormImplementation } from "./Implementations/SettingsForm/main";
import { LOFCGHeaderInterceptor } from "./interceptors";

export interface LeagueOfComicGeeksImplementation
  extends SettingsFormImplementation,
    SearchResultsImplementation,
    DiscoverSectionImplementation,
    MangaImplementation,
    MangaProgressImplementation {}

export class LeagueOfComicGeeksExtension implements Omit<Extension, keyof MangaProviding> {
  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 3,
    bufferInterval: 1,
    ignoreImages: true,
  });

  headerInterceptor: LOFCGHeaderInterceptor = new LOFCGHeaderInterceptor("locg-headers");
  cookieStorageInterceptor = new CookieStorageInterceptor({ storage: "stateManager" });

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.headerInterceptor.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
  }
}

applyMixins(LeagueOfComicGeeksExtension, [
  SettingsFormImplementation,
  SearchResultsImplementation,
  DiscoverSectionImplementation,
  MangaImplementation,
  MangaProgressImplementation,
]);

export const LeagueOfComicGeeks = new LeagueOfComicGeeksExtension();
