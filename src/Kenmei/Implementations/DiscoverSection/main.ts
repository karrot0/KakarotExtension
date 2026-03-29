import {
  type DiscoverSection,
  type DiscoverSectionItem,
  type DiscoverSectionProviding,
  type PagedResults,
} from "@paperback/types";

export class DiscoverSectionImplementation implements DiscoverSectionProviding {
  async getDiscoverSections(): Promise<DiscoverSection[]> {
    // TODO: implement discover sections (e.g. trending, recent updates)
    return [];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    void section;
    void metadata;
    return { items: [] };
  }
}
