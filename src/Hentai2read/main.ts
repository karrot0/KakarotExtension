import {
  BasicRateLimiter,
  Chapter,
  ChapterDetails,
  ChapterProviding,
  CloudflareError,
  ContentRating,
  DiscoverSection,
  DiscoverSectionItem,
  DiscoverSectionProviding,
  DiscoverSectionType,
  Extension,
  MangaProviding,
  PagedResults,
  Request,
  SearchFilter,
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SourceManga,
  TagSection,
  // TagSearchFilter,
} from "@paperback/types";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import * as htmlparser2 from "htmlparser2";
import { URLBuilder } from "../utils/url-builder/base";
import { Hentai2readInterceptor } from "./interceptors";
import {
  Hentai2readMetadata,
} from "./model";

const baseUrl = "https://hentai2read.com";

type Hentai2readImplementation = Extension &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding &
  DiscoverSectionProviding;

export class Hentai2readExtension implements Hentai2readImplementation {
  requestManager = new Hentai2readInterceptor("main");
  globalRateLimiter = new BasicRateLimiter("rateLimiter", {
    numberOfRequests: 10,
    bufferInterval: 1,
    ignoreImages: true,
  });

  private searchDetails: {
    category: { id: string; label: string }[];
    tags: { id: string; label: string }[];
  } | undefined;

  private baseHtml: CheerioAPI | undefined;

  async initialise(): Promise<void> {
    this.requestManager.registerInterceptor();
    this.globalRateLimiter.registerInterceptor();
    this.searchDetails = await this.getSearchDetails();

    const request = {
      url: baseUrl,
      method: "GET",
    };
    this.baseHtml = await this.fetchCheerio(request);
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "reader_recommendation_section",
        title: "Reader Recommendations",
        type: DiscoverSectionType.featured,
      },
      {
        id: "staff_pick_section",
        title: "Staff Picks",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "reading_now_section",
        title: "Reading Now",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "recently_uploaded_section",
        title: "Recently Uploaded",
        type: DiscoverSectionType.chapterUpdates,
      }
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: Hentai2readMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "staff_pick_section":
        return this.getStaffPickSectionItems(section, metadata);
      case "reading_now_section":
        return this.getReadingNowSectionItems(section, metadata);
      case "reader_recommendation_section":
        return this.getReaderRecommendationSectionItems(section, metadata);
      case "recently_uploaded_section":
        return this.getRecentlyUploadedSectionItems(section, metadata);
      default:
        return { items: [] };
    }
  }

  private async getSearchDetails() {
    try {
      const request = {
        url: `${baseUrl}/hentai-search`,
        method: "GET",
      };

      const $ = await this.fetchCheerio(request);

      const category: { id: string; label: string }[] = [];
      const tags: { id: string; label: string }[] = [];

      $(".col-xs-4.col-sm-3.tag-blocks").each((_, element) => {
        const id = $(element).find("input[name='chk_wpm_pag_mng_sch_mng_tag_inc[]']").attr("value") ?? "";
        const label = $(element).find(".block-content.bh-xs.text-ellipsis").text().trim();
        if (label) {
          category.push({ id, label });
        }
      });
      
      $(".col-xs-4.col-sm-3.tag-blocks").each((_, element) => {
        const id = $(element).find("input[name='chk_wpm_pag_mng_sch_mng_tag_inc[]']").attr("value") ?? "";
        const label = $(element).find(".block-content.bh-xs.text-ellipsis").text().trim();
        if (label) {
          tags.push({ id, label });
        }
      });
      
      // sort tags in alphabetical order
      tags.sort((a, b) => a.label.localeCompare(b.label));

      return {
        category,
        tags,
      };
    } catch (error) {
      console.error("Error fetching search details:", error);
    }
  }

  async getSearchFilters(): Promise<SearchFilter[]> {
    const filters: SearchFilter[] = [];

    const searchDetails = this.searchDetails;

    if (!searchDetails) {
      console.warn("Search details not initialized. Returning empty filters.");
      return [];
    }

    filters.push({
      id: "tags",
      type: "multiselect",
      options:
      searchDetails?.tags?.map((t) => ({ id: t.id, value: t.label })) || [],
      value: {},
      allowExclusion: true,
      title: "Tags Filter",
      allowEmptySelection: false,
      maximum: undefined,
    });

    return filters;
  }

  async getSearchResults(
    query: SearchQuery,
    metadata: { page?: number; nextPageUrl?: string } | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;

    const getFilterValue = (id: string) =>
      query.filters?.find((filter) => filter.id == id)?.value as
        | Record<string, "included" | "excluded">
        | undefined;

    // const categoryFilter = getFilterValue("category");
    const tagsFilter = getFilterValue("tags");
    
    let request: Request;
    
    // If we have a next page URL from previous response, use GET request
    if (metadata?.nextPageUrl) {
      request = {
        url: metadata.nextPageUrl,
        method: "GET",
        headers: {
          "Referer": "https://hentai2read.com/hentai-search"
        }
      };
    } else {
      // First page or filtered search, use POST request
      const formData = {
        data: {} as Record<string, string[]>,
        append(key: string, value: string): void {
        if (!this.data[key]) {
          this.data[key] = [];
        }
        this.data[key].push(value);
        },
        toString(): string {
        return Object.entries(this.data)
          .flatMap(([key, values]) => 
          values.map(value => 
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
          )
          )
          .join('&');
        }
      };
      
      // Add required default form parameters
      formData.append("cmd_wpm_pag_mng_sch_sbm", "");
      formData.append("cbo_wpm_pag_mng_sch_nme", "0"); // Contains title = 0
      formData.append("cbo_wpm_pag_mng_sch_ats", "1");
      formData.append("txt_wpm_pag_mng_sch_ats", "");
      formData.append("cbo_wpm_pag_mng_sch_chr", "1");
      formData.append("txt_wpm_pag_mng_sch_chr", "");
      formData.append("cbo_wpm_pag_mng_sch_rls_yer", "0");
      formData.append("txt_wpm_pag_mng_sch_rls_yer", "");
      formData.append("rad_wpm_pag_mng_sch_sts", "0");
      formData.append("rad_wpm_pag_mng_sch_tag_mde", "and");
      
      // Add title search if provided
      if (query.title) {
        formData.append("txt_wpm_pag_mng_sch_nme", query.title);
      } else {
        formData.append("txt_wpm_pag_mng_sch_nme", "");
      }
      
      // Process tag filters
      if (tagsFilter) {
        // Add included tags
        Object.entries(tagsFilter)
        .filter(([, status]) => status === "included")
        .forEach(([tagId]) => {
          formData.append("chk_wpm_pag_mng_sch_mng_tag_inc[]", tagId);
        });
        
        // Add excluded tags
        Object.entries(tagsFilter)
        .filter(([, status]) => status === "excluded")
        .forEach(([tagId]) => {
          formData.append("chk_wpm_pag_mng_sch_mng_tag_exc[]", tagId);
        });
      }
      
      request = {
        url: new URLBuilder(baseUrl).addPath("hentai-list/advanced-search/").build(),
        method: "POST",
        headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://hentai2read.com/hentai-search"
        },
        body: formData.toString()
      };
    }

    const $ = await this.fetchCheerio(request);
    const searchResults: SearchResultItem[] = [];

    $(".book-grid-item-container").each((_, element) => {
      if ($(element).find(".book-grid-item a[href*='hive.arf.dev']").length > 0) {
      return;
      }
      
      const titleLink = $(element).find(".title, .overlay-title a").first();
      const href = titleLink.attr("href") || "";

      const mangaId = href.replace(/^https?:\/\/hentai2read\.com\//, "").replace(/\/$/, "");

      const title = $(element).find(".title-text, .overlay-title a").first().text().trim();
      
      const subtitle = $(element).find(".overlay-sub div").first().text().trim() || undefined;
      
      let image = "";
      const imgElement = $(element).find("img").first();
      
      if (imgElement.length > 0) {
      image = imgElement.attr("data-src") || 
          imgElement.attr("src") || 
          imgElement.attr("srcset") || "";
          
      if (image && image.startsWith("//")) {
        image = "https:" + image;
      }
      }

      if (!mangaId || !title) {
      return;
      }

      searchResults.push({
        mangaId: mangaId,
        imageUrl: image ?? "",
        title: title,
        contentRating: ContentRating.ADULT,
        subtitle: subtitle,
        metadata: undefined,
      });
    });

    // Extract next page URL from pagination
    const nextPageLink = $("#js-linkNext, .pagination a#js-linkNext").first();
    const nextPageUrl = nextPageLink.attr("href");
    
    return {
      items: searchResults,
      metadata: nextPageUrl ? { page: page + 1, nextPageUrl: nextPageUrl } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = {
      url: new URLBuilder(baseUrl).addPath(mangaId).build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    const title = $(".tagButton:contains('Read')").text().trim() || 
           $(".title .pretty").first().text().trim() || 
           $("title").text().split(" | ")[0].trim();
    
    const altTitles: string[] = [];
    $(".title").each((_, el) => {
      const alt = $(el).text().trim();
      if (alt && alt !== title) altTitles.push(alt);
    });

    let image = "";
    const imgElement = $("#js-linkNext img.img-responsive, .img-container img.img-responsive").first();
    image = imgElement.attr("data-src") || imgElement.attr("src") || "";
    if (image && image.startsWith("//")) {
      image = "https:" + image;
    }

    const description = $(".text-muted:contains('Nothing yet')").length > 0 ? 
              "" : 
              $("li.text-primary:contains('Storyline') p").text().trim();

    let status: "ONGOING" | "COMPLETED" | "UNKNOWN" = "UNKNOWN";
    const statusText = $("li.text-primary:contains('Status') .tagButton").text().trim().toLowerCase();
    if (statusText.includes("completed")) {
      status = "COMPLETED";
    } else if (statusText.includes("ongoing")) {
      status = "ONGOING";
    }

    const tags: TagSection[] = [];
    
    const categoryTags: { id: string; title: string }[] = [];
    $("li.text-primary:contains('Category') .tagButton").each((_, el) => {
      const href = $(el).attr("href") || "";
      const id = href.split("/").filter(Boolean).pop() || "";
      const title = $(el).text().trim();
      if (id && title) categoryTags.push({ id, title });
    });
    
    if (categoryTags.length > 0) {
      tags.push({
      id: "category",
      title: "Category",
      tags: categoryTags
      });
    }
    
    const contentTags: { id: string; title: string }[] = [];
    $("li.text-primary:contains('Content') .tagButton").each((_, el) => {
      const href = $(el).attr("href") || "";
      const id = href.split("/").filter(Boolean).pop() || "";
      const title = $(el).text().trim();
      if (id && title) contentTags.push({ id, title });
    });
    
    if (contentTags.length > 0) {
      tags.push({
      id: "content",
      title: "Content",
      tags: contentTags
      });
    }
    
    const authorTags: { id: string; title: string }[] = [];
    $("li.text-primary:contains('Author') .tagButton").each((_, el) => {
      const href = $(el).attr("href") || "";
      const id = href.split("/").filter(Boolean).pop() || "";
      const title = $(el).text().trim();
      if (id && title) authorTags.push({ id, title });
    });
    
    if (authorTags.length > 0) {
      tags.push({
      id: "author",
      title: "Author",
      tags: authorTags
      });
    }

    const artistTags: { id: string; title: string }[] = [];
    $("li.text-primary:contains('Artist') .tagButton").each((_, el) => {
      const href = $(el).attr("href") || "";
      const id = href.split("/").filter(Boolean).pop() || "";
      const title = $(el).text().trim();
      if (id && title) artistTags.push({ id, title });
    });
    
    if (artistTags.length > 0) {
      tags.push({
      id: "artist",
      title: "Artist",
      tags: artistTags
      });
    }

    let rating = 0;
    const ratingText = $(".js-raty").attr("data-score") || "0";
    const ratingValue = parseFloat(ratingText);
    if (!isNaN(ratingValue)) {
      rating = ratingValue;
    }

    return {
      mangaId: mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: altTitles,
        thumbnailUrl: image,
        synopsis: description,
        rating: rating,
        contentRating: ContentRating.ADULT,
        status: status,
        tagGroups: tags,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const request = {
      url: new URLBuilder(baseUrl).addPath(sourceManga.mangaId).build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const chapters: Chapter[] = [];

    $(".nav-chapters li").each((_, element) => {
      const chapterLink = $(element).find("a.pull-left");
      const href = chapterLink.attr("href") || "";

      const chapterId = href.replace(/^https?:\/\/hentai2read\.com\//, "").replace(/\/$/, "");

      const titleText = chapterLink.text().trim();
      const titleMatch = titleText.match(/(\d+)\s*-\s*(.*)/);
      
      let chapNum = 1;
      let title = titleText;
      
      if (titleMatch) {
        chapNum = parseFloat(titleMatch[1]);
        title = titleMatch[2].trim();
      }
      
      const dateText = $(element).find(".text-muted small").text().trim();
      let publishDate: Date | undefined = undefined;
      
      if (dateText) {
        const aboutMatch = dateText.match(/about\s+(\d+)(\w+)\s+ago/);
        if (aboutMatch) {
          const value = parseInt(aboutMatch[1]);
          const unit = aboutMatch[2].toLowerCase();
          
          const now = new Date();
          if (unit.includes("year")) {
            publishDate = new Date(now.setFullYear(now.getFullYear() - value));
          } else if (unit.includes("month")) {
            publishDate = new Date(now.setMonth(now.getMonth() - value));
          } else if (unit.includes("day")) {
            publishDate = new Date(now.setDate(now.getDate() - value));
          }
        }
      }
      
      if (chapterId && title) {
        chapters.push({
          chapterId: chapterId,
          title: title,
          sourceManga,
          chapNum: chapNum,
          publishDate: publishDate,
          volume: 1,
          langCode: "en"
        });
      }
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const request = {
      url: new URLBuilder(baseUrl).addPath(chapter.chapterId).build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const pages: string[] = [];

    const scriptContent = $("script").filter((_, el) => {
      return ($(el).html() || "").includes("var gData");
    }).html() || "";

    if (scriptContent) {
      const imagesMatch = scriptContent.match(/images['"]\s*:\s*\[(.*?)\]/s);
      
      if (imagesMatch && imagesMatch[1]) {
        const imagePathsStr = imagesMatch[1];
        const pathRegex = /"([^"]+)"/g;
        let match;
        
        while ((match = pathRegex.exec(imagePathsStr)) !== null) {
          let imagePath = match[1];
          imagePath = imagePath.replace(/\\/g, '/');
          if (!imagePath.startsWith('/')) {
            imagePath = '/' + imagePath;
          }
          pages.push("https://static.hentai.direct/hentai" + imagePath);
        }
      }
    }

 
    return {
      mangaId: chapter.sourceManga.mangaId,
      id: chapter.chapterId,
      pages: pages,
    };
  }

  getMangaShareUrl(mangaId: string): string {
    return `${baseUrl}/${mangaId}/`;
  }

  async getStaffPickSectionItems(
    section: DiscoverSection,
    metadata: Hentai2readMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    if (!this.baseHtml) {
      console.warn("Base HTML not initialized. Returning empty section.");
      return { items: [] };
    }

    const $ = this.baseHtml;
    const items: DiscoverSectionItem[] = [];

    $(".row.book-grid > div:not(:last-child)").each((_, element) => {
      const gallery = $(element).find(".book-grid-item");
      const link = gallery.find("a.title");
      const href = link.attr("href") || "";

      const mangaId = href.replace(/\/g\/(\d+)\//, "$1").replace("https://hentai2read.com/", "");
      // https://hentai2read.com/kimi_wa_watashi_no_marmot/ | mangaId = kimi_wa_watashi_no_marmot

      const imgElement = gallery.find("img");
      const image = imgElement.attr("data-src") || imgElement.attr("src") || "";

      const title = link.find(".title-text").text().trim();

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            image: image,
            title: title,
            contentRating: ContentRating.ADULT,
            type: "simpleCarouselItem",
          }),
        );
      }
    });

    const hasNextPage = false;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getReadingNowSectionItems(
    section: DiscoverSection,
    metadata: Hentai2readMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    if (!this.baseHtml) {
      console.warn("Base HTML not initialized. Returning empty section.");
      return { items: [] };
    }

    const $ = this.baseHtml;
    const items: DiscoverSectionItem[] = [];

    $(".block-header:contains('Reading Now') + .block-content .nav-users li").each((_, element) => {
      const link = $(element).find("a.link-effect");
      const href = link.attr("href") || "";

      const mangaId = href.replace("https://hentai2read.com/", "").replace(/\/$/, "");
      
      const imgElement = link.find("img.img-avatar");
      let image = imgElement.attr("src") || "";
      if (image.includes("/42/")) {
        image = image.replace("/42/", "/");
      }

      const title = link.contents().filter((_, node)  => (node as any).type === 'text' && $(node).text().trim() !== '').text().trim();

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
        items.push(
          createDiscoverSectionItem({
            id: mangaId,
            contentRating: ContentRating.ADULT,
            image: image,
            title: title,
            type: "simpleCarouselItem",
          }),
        );
      }
    });

    const hasNextPage = false;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getReaderRecommendationSectionItems(
    section: DiscoverSection,
    metadata: Hentai2readMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    if (!this.baseHtml) {
      console.warn("Base HTML not initialized. Returning empty section.");
      return { items: [] };
    }

    const $ = this.baseHtml;
    const items: DiscoverSectionItem[] = [];

    $(".block-header:contains('Reader Recommendation') + .block-content .nav-users li").each((_, element) => {
      const link = $(element).find("a.link-effect");
      const href = link.attr("href") || "";

      const mangaId = href.replace("https://hentai2read.com/", "").replace(/\/$/, "");
      
      const imgElement = link.find("img.img-avatar");
      let image = imgElement.attr("src") || "";
      if (image.includes("/42/")) {
        image = image.replace("/42/", "/");
      }

      const title = link.contents().filter((_, node)  => (node as any).type === 'text' && $(node).text().trim() !== '').text().trim();
      const heartIcons = $(element).find(".js-rating i.fa-heart.text-city").length;
      const supertitle = `Rating: ${heartIcons}/5`;

      if (title && mangaId && !collectedIds.includes(mangaId)){
        collectedIds.push(mangaId);
        items.push({
          type: "featuredCarouselItem",
          mangaId: mangaId,
          imageUrl: image,
          title: title,
          supertitle: supertitle,
          contentRating: ContentRating.ADULT,
          metadata: undefined,
        });
      }
    });

    const hasNextPage = false;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getRecentlyUploadedSectionItems(
    section: DiscoverSection,
    metadata: Hentai2readMetadata | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const collectedIds = metadata?.collectedIds ?? [];

    const request = {
      url: baseUrl,
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);
    const items: DiscoverSectionItem[] = [];

    $(".block-content .nav-users li").each((_, element) => {
      const link = $(element).find("a.link-effect").first();
      const href = link.attr("href") || "";

      const mangaId = href.replace("https://hentai2read.com/", "").replace(/\/$/, "");
      
      const imgElement = link.find("img.img-avatar");
      let image = imgElement.attr("src") || "";
      if (image.includes("/42/")) {
      image = image.replace("/42/", "/");
      }
      
      const title = link.contents().filter((_, node) => {
        return (node as any).type === 'text' && $(node).text().trim() !== '';
      }).first().text().trim();

      const subtitleText = $(element).find(".text-ellipsis").first().text().trim();
      const subtitle = subtitleText.replace(/\s+/g, ' ')
                 .replace(/^\d+\s*→\s*/, '')
                 .replace(/\s+\d+\s*days?\s*ago$/, '');
      const chapterId = $(element).find(".text-ellipsis a").first().attr("href")?.replace("https://hentai2read.com/", "").replace(/\/$/, "") || "";

      if (title && mangaId && !collectedIds.includes(mangaId)) {
        collectedIds.push(mangaId);
          items.push({
            type: "chapterUpdatesCarouselItem",
            mangaId: mangaId,
            chapterId: chapterId,
            imageUrl: image,
            title: title,
            contentRating: ContentRating.ADULT,
            subtitle: subtitle,
            metadata: undefined,
          });
        }
    });

    const hasNextPage = false;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  checkCloudflareStatus(status: number): void {
    if (status == 503 || status == 403) {
      throw new CloudflareError({ url: baseUrl, method: "GET" });
    }
  }

  async fetchCheerio(request: Request): Promise<CheerioAPI> {
    const [response, data] = await Application.scheduleRequest(request);
    this.checkCloudflareStatus(response.status);
    const htmlStr = Application.arrayBufferToUTF8String(data);
    const dom = htmlparser2.parseDocument(htmlStr);
    return cheerio.load(dom);
  }
}

function createDiscoverSectionItem(options: {
  id: string;
  image: string;
  title: string;
  subtitle?: string;
  contentRating?: ContentRating;
  type: "simpleCarouselItem";
}): DiscoverSectionItem {
  return {
    type: options.type,
    mangaId: options.id,
    imageUrl: options.image,
    title: options.title,
    contentRating: options.contentRating ?? ContentRating.EVERYONE,
    subtitle: options.subtitle,
    metadata: undefined,
  };
}

export const Hentai2read = new Hentai2readExtension();