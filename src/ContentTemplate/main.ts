// TODO: Add English name to title view, additional info?

import {
  BasicRateLimiter,
  Chapter,
  ChapterDetails,
  ChapterProviding,
  ContentRating,
  DiscoverSection,
  DiscoverSectionItem,
  DiscoverSectionProviding,
  DiscoverSectionType,
  Extension,
  Form,
  MangaProviding,
  PagedResults,
  PaperbackInterceptor,
  Request,
  Response,
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SettingsFormProviding,
  SourceManga,
  Tag,
  TagSection,
} from "@paperback/types";
// Template content
import content from "../../content.json";
// Extension settings file
import { SettingsForm } from "./SettingsForm";

// Should match the capabilities which you defined in pbconfig.ts
type ContentTemplateImplementation = SettingsFormProviding &
  Extension &
  DiscoverSectionProviding &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding;

// Intercepts all the requests and responses and allows you to make changes to them
class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    return data;
  }
}

// Main extension class
export class ContentTemplateExtension implements ContentTemplateImplementation {
  // Implementation of the main rate limiter
  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 15,
    bufferInterval: 10,
    ignoreImages: true,
  });

  // Implementation of the main interceptor
  mainInterceptor = new MainInterceptor("main");

  // Method from the Extension interface which we implement, initializes the rate limiter, interceptor, discover sections and search filters
  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.mainInterceptor.registerInterceptor();

    // Template search filter
    Application.registerSearchFilter({
      id: "search-filter-template",
      type: "dropdown",
      options: [
        { id: "include", value: "include" },
        { id: "exclude", value: "exclude" },
      ],
      value: "Exclude",
      title: "Search Filter Template",
    });
  }

  // Implements the settings form, check SettingsForm.ts for more info
  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    // First template discover section, gets populated by the getDiscoverSectionItems method
    const discover_section_template1: DiscoverSection = {
      id: "discover-section-template1",
      title: "Discover Section Template 1",
      subtitle: "This is a template",
      type: DiscoverSectionType.prominentCarousel,
    };

    // Second template discover section, gets populated by the getDiscoverSectionItems method
    const discover_section_template2: DiscoverSection = {
      id: "discover-section-template2",
      title: "Discover Section Template 2",
      subtitle: "This is another template",
      type: DiscoverSectionType.simpleCarousel,
    };

    return [discover_section_template1, discover_section_template2];
  }

  // Populates both the discover sections
  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    void metadata;

    let i: number;
    let type: string;
    switch (section.id) {
      case "discover-section-template1":
        i = 0;
        type = "prominentCarouselItem";
        break;
      case "discover-section-template2":
        i = content.length / 2;
        type = "simpleCarouselItem";
        break;
    }

    return {
      items: Array.from(Array(content.length / 2)).map(() => {
        const result = {
          mangaId: content[i].titleId,
          title: content[i].primaryTitle
            ? content[i].primaryTitle
            : "Unknown Title",
          subtitle: content[i].secondaryTitles[0],
          imageUrl: content[i].thumbnailUrl ? content[i].thumbnailUrl : "",
          type: type,
        } as DiscoverSectionItem;
        ++i;
        return result;
      }),
    };
  }

  // Populates search
  async getSearchResults(
    query: SearchQuery,
    metadata?: number,
  ): Promise<PagedResults<SearchResultItem>> {
    void metadata;

    const results: PagedResults<SearchResultItem> = { items: [] };

    for (let i = 0; i < content.length; i++) {
      if (
        (content[i].primaryTitle
          .toLowerCase()
          .indexOf(query.title.toLowerCase()) != -1 &&
          query.filters[0].value == "include") ||
        (content[i].primaryTitle
          .toLowerCase()
          .indexOf(query.title.toLowerCase()) == -1 &&
          query.filters[0].value == "exclude")
      ) {
        if (content[i].titleId) {
          const result: SearchResultItem = {
            mangaId: content[i].titleId,
            title: content[i].primaryTitle
              ? content[i].primaryTitle
              : "Unknown Title",
            subtitle: content[i].secondaryTitles[0],
            imageUrl: content[i].thumbnailUrl ? content[i].thumbnailUrl : "",
          };
          results.items.push(result);
        }
      } else {
        for (let j = 0; j < content[i].secondaryTitles.length; j++) {
          if (
            (content[i].secondaryTitles[j]
              .toLowerCase()
              .indexOf(query.title.toLowerCase()) != -1 &&
              query.filters[0].value == "include") ||
            (content[i].secondaryTitles[j]
              .toLowerCase()
              .indexOf(query.title.toLowerCase()) == -1 &&
              query.filters[0].value == "exclude")
          ) {
            if (content[i].titleId) {
              const result: SearchResultItem = {
                mangaId: content[i].titleId,
                title: content[i].primaryTitle
                  ? content[i].primaryTitle
                  : "Unknown Title",
                subtitle: content[i].secondaryTitles[0],
                imageUrl: content[i].thumbnailUrl
                  ? content[i].thumbnailUrl
                  : "",
              };
              results.items.push(result);
            }
            break;
          }
        }
      }
    }
    return results;
  }

  // Populates the title details
  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    for (let i = 0; i < content.length; i++) {
      if (mangaId == content[i].titleId) {
        let contentRating: ContentRating;
        switch (content[i].contentRating) {
          case "EVERYONE":
            contentRating = ContentRating.EVERYONE;
            break;
          case "MATURE":
            contentRating = ContentRating.MATURE;
            break;
          case "ADULT":
            contentRating = ContentRating.ADULT;
            break;
          default:
            contentRating = ContentRating.EVERYONE;
            break;
        }

        const genres: TagSection = { id: "genres", title: "Genres", tags: [] };
        for (let j = 0; j < content[i].genres.length; j++) {
          const genre: Tag = {
            id: content[i].genres[j].toLowerCase().replace(" ", "-"),
            title: content[i].genres[j],
          };
          genres.tags.push(genre);
        }

        const tags: TagSection = { id: "tags", title: "Tags", tags: [] };
        for (let j = 0; j < content[i].tags.length; j++) {
          const tag: Tag = {
            id: content[i].tags[j].toLowerCase().replace(" ", "-"),
            title: content[i].tags[j],
          };
          tags.tags.push(tag);
        }

        return {
          mangaId,
          mangaInfo: {
            thumbnailUrl: content[i].thumbnailUrl
              ? content[i].thumbnailUrl
              : "",
            synopsis: content[i].synopsis
              ? content[i].synopsis
              : "No synopsis.",
            primaryTitle: content[i].primaryTitle
              ? content[i].primaryTitle
              : "Unknown Title",
            secondaryTitles: content[i].secondaryTitles
              ? content[i].secondaryTitles
              : [],
            contentRating,
            status: content[i].status,
            author: content[i].author,
            rating: content[i].rating,
            tagGroups: [genres, tags],
            artworkUrls: [content[i].thumbnailUrl],
          },
        };
      }
    }
    throw new Error("No title with this id exists");
  }

  // Populates the chapter list
  async getChapters(
    sourceManga: SourceManga,
    sinceDate?: Date,
  ): Promise<Chapter[]> {
    // Can be used to only return new chapters. Not used here, instead the whole chapter list gets returned
    void sinceDate;

    for (let i = 0; i < content.length; i++) {
      if (sourceManga.mangaId == content[i].titleId) {
        const chapters: Chapter[] = [];

        for (let j = 0; j < content[i].chapters.length; j++) {
          if (content[i].chapters[j].chapterId) {
            const chapter: Chapter = {
              chapterId: content[i].chapters[j].chapterId,
              sourceManga,
              langCode: content[i].chapters[j].languageCode
                ? content[i].chapters[j].languageCode
                : "EN",
              chapNum: content[i].chapters[j].chapterNumber
                ? content[i].chapters[j].chapterNumber
                : j + 1,
              title: content[i].primaryTitle,
              volume: content[i].chapters[j].volumeNumber,
            };
            chapters.push(chapter);
          }
        }
        return chapters;
      }
    }
    throw new Error("No title with this id exists");
  }

  // Populates a chapter with images
  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    for (let i = 0; i < content.length; i++) {
      if (chapter.sourceManga.mangaId == content[i].titleId) {
        for (let j = 0; j < content[i].chapters.length; j++) {
          if (chapter.chapterId == content[i].chapters[j].chapterId) {
            const chapterDetails: ChapterDetails = {
              id: chapter.chapterId,
              mangaId: chapter.sourceManga.mangaId,
              pages: content[i].chapters[j].pages,
            };
            return chapterDetails;
          }
        }
        throw new Error("No chapter with this id exists");
      }
    }
    throw new Error("No title with this id exists");
  }
}

export const ContentTemplate = new ContentTemplateExtension();
