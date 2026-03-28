import {
  type DiscoverSection,
  type DiscoverSectionItem,
  type DiscoverSectionProviding,
  DiscoverSectionType,
  type PagedResults,
  type SimpleCarouselItem,
  type FeaturedCarouselItem,
  type ProminentCarouselItem,
} from "@paperback/types";
import { getComics } from "../../Services/Requests";
import { LIST_IDS } from "../Shared/models/main";
import { comic } from "../Shared/parser/main";

enum SectionId {
  newComics = "new-comics",
  popularSeries = "popular-series",
  highlyRated = "highly-rated",
}

function currentWeekDate(): string {
  const d = new Date();
  // Round to Wednesday of current week (LOCG pull list dates are typically Wednesdays)
  const day = d.getDay();
  const diff = d.getDate() - day + (day >= 3 ? 3 : 3 - 7);
  const wednesday = new Date(d);
  wednesday.setDate(diff);
  const yyyy = wednesday.getFullYear();
  const mm = String(wednesday.getMonth() + 1).padStart(2, "0");
  const dd = String(wednesday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export class DiscoverSectionImplementation implements DiscoverSectionProviding {
  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: SectionId.newComics,
        title: "New This Week",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: SectionId.popularSeries,
        title: "Most Popular Series",
        type: DiscoverSectionType.featured,
      },
      {
        id: SectionId.highlyRated,
        title: "Highly Rated Series",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const logPrefix = `[DiscoverSection:${section.id}]`;
    console.log(`${logPrefix} starts`);

    const page = metadata ?? 1;
    if (page < 0) return { items: [], metadata: -1 };

    try {
      switch (section.id as SectionId) {
        case SectionId.newComics: {
          const date = currentWeekDate();
          const response = await getComics({
            list: LIST_IDS.RELEASES,
            list_option: "issue",
            date_type: "week",
            date,
            order: "pulls",
            view: "list",
            page,
          });
          const items: SimpleCarouselItem[] = comic.parseSeriesHtml(response.list).map((s) => ({
            type: "simpleCarouselItem" as const,
            mangaId: s.id,
            title: s.name,
            imageUrl: s.cover ?? "",
            subtitle: s.publisher || undefined,
          }));
          return { items: items as DiscoverSectionItem[], metadata: items.length >= 20 ? page + 1 : -1 };
        }

        case SectionId.popularSeries: {
          const response = await getComics({
            list: LIST_IDS.SEARCH,
            list_option: "series",
            order: "pulls",
            page,
          });
          const items: FeaturedCarouselItem[] = comic.parseSeriesHtml(response.list).map((s) => ({
            type: "featuredCarouselItem" as const,
            mangaId: s.id,
            title: s.name,
            imageUrl: s.cover ?? "",
            subtitle: s.publisher || undefined,
          }));
          return { items: items as DiscoverSectionItem[], metadata: items.length >= 20 ? page + 1 : -1 };
        }

        case SectionId.highlyRated: {
          const response = await getComics({
            list: LIST_IDS.SEARCH,
            list_option: "series",
            order: "community",
            page,
          });
          const items: ProminentCarouselItem[] = comic.parseSeriesHtml(response.list).map((s) => ({
            type: "prominentCarouselItem" as const,
            mangaId: s.id,
            title: s.name,
            imageUrl: s.cover ?? "",
            subtitle: s.publisher || undefined,
          }));
          return { items: items as DiscoverSectionItem[], metadata: items.length >= 20 ? page + 1 : -1 };
        }

        default:
          console.log(`${logPrefix} unknown section`);
          return { items: [], metadata: -1 };
      }
    } catch (e) {
      console.log(`${logPrefix} error: ${String(e)}`);
      throw e;
    }
  }
}
