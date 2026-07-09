import {
  AdvancedSearchForm,
  BasicRateLimiter,
  Metadata,
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
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SortingOption,
  SourceManga,
  TagSection,
} from "@paperback/types";
import { Hentai2readSearchForm, type Hentai2readSearchMetadata } from "./forms/SearchForm";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import * as htmlparser2 from "htmlparser2";
import { URLBuilder } from "../utils/url-builder/base";
import { Hentai2readInterceptor } from "./interceptors";

const baseUrl = "https://hentai2read.com";

const SORT_OPTIONS: SortingOption[] = [
  { id: "name-az", label: "Name (A-Z)" },
  { id: "name-za", label: "Name (Z-A)" },
  { id: "last-updated", label: "Last Updated" },
  { id: "oldest-updated", label: "Oldest Updated" },
  { id: "most-popular", label: "Most Popular" },
  { id: "most-popular-daily", label: "Most Popular (Daily)" },
  { id: "most-popular-weekly", label: "Most Popular (Weekly)" },
  { id: "most-popular-monthly", label: "Most Popular (Monthly)" },
  { id: "user-recommendation", label: "User Recommendation" },
  { id: "trending", label: "Trending" },
  { id: "staff-pick", label: "Staff Pick" },
  { id: "least-popular", label: "Least Popular" },
  { id: "last-added", label: "Newest" },
  { id: "early-added", label: "Oldest" },
  { id: "top-rating", label: "Top Rating" },
  { id: "lowest-rating", label: "Lowest Rating" },
];

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

  private searchDetails:
    | {
        category: { id: string; label: string }[];
        tags: { id: string; label: string }[];
      }
    | undefined;

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
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    switch (section.id) {
      case "staff_pick_section":
        return this.getStaffPickSectionItems(section);
      case "reading_now_section":
        return this.getReadingNowSectionItems(section);
      case "reader_recommendation_section":
        return this.getReaderRecommendationSectionItems(section);
      case "recently_uploaded_section":
        return this.getRecentlyUploadedSectionItems(section);
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
        const id =
          $(element).find("input[name='chk_wpm_pag_mng_sch_mng_tag_inc[]']").attr("value") ?? "";
        const label = $(element).find(".block-content.bh-xs.text-ellipsis").text().trim();
        if (label) {
          category.push({ id, label });
        }
      });

      $(".col-xs-4.col-sm-3.tag-blocks").each((_, element) => {
        const id =
          $(element).find("input[name='chk_wpm_pag_mng_sch_mng_tag_inc[]']").attr("value") ?? "";
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

  async getAdvancedSearchForm(query: SearchQuery<Metadata>): Promise<AdvancedSearchForm> {
    const meta = (query.metadata as { searchMeta?: Hentai2readSearchMetadata } | undefined)
      ?.searchMeta;
    const tags = (this.searchDetails?.tags ?? []).map((t) => ({ id: t.id, name: t.label }));
    return new Hentai2readSearchForm(tags, meta);
  }

  async getSortingOptions(_query: SearchQuery<Metadata>): Promise<SortingOption[]> {
    return SORT_OPTIONS;
  }

  async getSearchResults(
    query: SearchQuery<Metadata>,
    metadata: Metadata | undefined,
    sortingOption: SortingOption | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const paginationMeta = metadata as { page?: number; nextPageUrl?: string } | undefined;
    const page = paginationMeta?.page ?? 1;

    const searchMeta = (query.metadata as { searchMeta?: Hentai2readSearchMetadata } | undefined)
      ?.searchMeta;
    const tagIncluded = searchMeta?.tagIncluded ?? [];
    const tagExcluded = searchMeta?.tagExcluded ?? [];

    let $: CheerioAPI;

    if (paginationMeta?.nextPageUrl) {
      $ = await this.fetchCheerio({
        url: paginationMeta.nextPageUrl,
        method: "GET",
        headers: { Referer: baseUrl },
      });
    } else {
      const formData = {
        data: {} as Record<string, string[]>,
        append(key: string, value: string): void {
          if (!this.data[key]) this.data[key] = [];
          this.data[key].push(value);
        },
        toString(): string {
          return Object.entries(this.data)
            .flatMap(([key, values]) =>
              values.map((value) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`),
            )
            .join("&");
        },
      };

      formData.append("cmd_wpm_pag_mng_sch_sbm", "");
      formData.append("cbo_wpm_pag_mng_sch_nme", "0");
      formData.append("cbo_wpm_pag_mng_sch_ats", "1");
      formData.append("txt_wpm_pag_mng_sch_ats", "");
      formData.append("cbo_wpm_pag_mng_sch_chr", "1");
      formData.append("txt_wpm_pag_mng_sch_chr", "");
      formData.append("cbo_wpm_pag_mng_sch_rls_yer", "0");
      formData.append("txt_wpm_pag_mng_sch_rls_yer", "");
      formData.append("rad_wpm_pag_mng_sch_sts", "0");
      formData.append("rad_wpm_pag_mng_sch_tag_mde", "and");
      formData.append("txt_wpm_pag_mng_sch_nme", query.title ?? "");

      for (const tagId of tagIncluded) {
        formData.append("chk_wpm_pag_mng_sch_mng_tag_inc[]", tagId);
      }
      for (const tagId of tagExcluded) {
        formData.append("chk_wpm_pag_mng_sch_mng_tag_exc[]", tagId);
      }

      const postRequest: Request = {
        url: new URLBuilder(baseUrl).addPath("hentai-list/advanced-search/").build(),
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: baseUrl,
        },
        body: formData.toString(),
      };

      const $post = await this.fetchCheerio(postRequest);

      if (sortingOption) {
        const sortHref = $post(".nav-pills .dropdown-menu a[href*='/advanced-search/']").first().attr("href") ?? "";
        const tokenMatch = sortHref.match(/\/advanced-search\/([^/]+)\//);
        if (tokenMatch) {
          const sortedUrl = `${baseUrl}/hentai-list/advanced-search/${tokenMatch[1]}/all/${sortingOption.id}`;
          $ = await this.fetchCheerio({ url: sortedUrl, method: "GET", headers: { Referer: baseUrl } });
        } else {
          $ = $post;
        }
      } else {
        $ = $post;
      }
    }

    const searchResults: SearchResultItem[] = [];

    $(".book-grid-item-container").each((_, element) => {
      if ($(element).find(".book-grid-item a[href*='hive.arf.dev']").length > 0) return;

      const titleLink = $(element).find(".title, .overlay-title a").first();
      const href = titleLink.attr("href") || "";
      const mangaId = href.replace(/^https?:\/\/hentai2read\.com\//, "").replace(/\/$/, "");
      const title = $(element).find(".title-text, .overlay-title a").first().text().trim();
      const subtitle = $(element).find(".overlay-sub div").first().text().trim() || undefined;

      let image = "";
      const imgElement = $(element).find("img").first();
      if (imgElement.length > 0) {
        image = imgElement.attr("data-src") || imgElement.attr("src") || imgElement.attr("srcset") || "";
        if (image.startsWith("//")) image = "https:" + image;
      }

      if (!mangaId || !title) return;

      searchResults.push({
        mangaId,
        imageUrl: image,
        title,
        contentRating: ContentRating.ADULT,
        subtitle,
      });
    });

    const nextPageUrl = $("#js-linkNext, .pagination a#js-linkNext").first().attr("href");

    return {
      items: searchResults,
      metadata: nextPageUrl ? { page: page + 1, nextPageUrl } : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = {
      url: new URLBuilder(baseUrl).addPath(mangaId).build(),
      method: "GET",
    };

    const $ = await this.fetchCheerio(request);

    const title =
      $(".tagButton:contains('Read')").text().trim() ||
      $(".title .pretty").first().text().trim() ||
      $("title").text().split(" | ")[0].trim();

    const altTitles: string[] = [];
    $(".title").each((_, el) => {
      const alt = $(el).text().trim();
      if (alt && alt !== title) altTitles.push(alt);
    });

    let image = "";
    const imgElement = $(
      "#js-linkNext img.img-responsive, .img-container img.img-responsive",
    ).first();
    image = imgElement.attr("data-src") || imgElement.attr("src") || "";
    if (image && image.startsWith("//")) {
      image = "https:" + image;
    }

    const description =
      $(".text-muted:contains('Nothing yet')").length > 0
        ? ""
        : $("li.text-primary:contains('Storyline') p").text().trim();

    let status: "ONGOING" | "COMPLETED" | "UNKNOWN" = "UNKNOWN";
    const statusText = $("li.text-primary:contains('Status') .tagButton")
      .text()
      .trim()
      .toLowerCase();
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
        tags: categoryTags,
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
        tags: contentTags,
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
        tags: authorTags,
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
        tags: artistTags,
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
          langCode: "en",
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

    const scriptContent =
      $("script")
        .filter((_, el) => {
          return ($(el).html() || "").includes("var gData");
        })
        .html() || "";

    if (scriptContent) {
      const imagesMatch = scriptContent.match(/images['"]\s*:\s*\[(.*?)\]/s);

      if (imagesMatch && imagesMatch[1]) {
        const imagePathsStr = imagesMatch[1];
        const pathRegex = /"([^"]+)"/g;
        let match;

        while ((match = pathRegex.exec(imagePathsStr)) !== null) {
          let imagePath = match[1];
          imagePath = imagePath.replace(/\\/g, "/");
          if (!imagePath.startsWith("/")) {
            imagePath = "/" + imagePath;
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
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = 1;
    const collectedIds: string[] = [];

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
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = 1;
    const collectedIds: string[] = [];

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

      const title = link
        .contents()
        .filter((_, node) => (node as any).type === "text" && $(node).text().trim() !== "")
        .text()
        .trim();

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
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = 1;
    const collectedIds: string[] = [];

    if (!this.baseHtml) {
      console.warn("Base HTML not initialized. Returning empty section.");
      return { items: [] };
    }

    const $ = this.baseHtml;
    const items: DiscoverSectionItem[] = [];

    $(".block-header:contains('Reader Recommendation') + .block-content .nav-users li").each(
      (_, element) => {
        const link = $(element).find("a.link-effect");
        const href = link.attr("href") || "";

        const mangaId = href.replace("https://hentai2read.com/", "").replace(/\/$/, "");

        const imgElement = link.find("img.img-avatar");
        let image = imgElement.attr("src") || "";
        if (image.includes("/42/")) {
          image = image.replace("/42/", "/");
        }

        const title = link
          .contents()
          .filter((_, node) => (node as any).type === "text" && $(node).text().trim() !== "")
          .text()
          .trim();
        const heartIcons = $(element).find(".js-rating i.fa-heart.text-city").length;
        const supertitle = `Rating: ${heartIcons}/5`;

        if (title && mangaId && !collectedIds.includes(mangaId)) {
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
      },
    );

    const hasNextPage = false;

    return {
      items: items,
      metadata: hasNextPage ? { page: page + 1, collectedIds } : undefined,
    };
  }

  async getRecentlyUploadedSectionItems(
    _section: DiscoverSection,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = 1;
    const collectedIds: string[] = [];

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

      const title = link
        .contents()
        .filter((_, node) => {
          return (node as any).type === "text" && $(node).text().trim() !== "";
        })
        .first()
        .text()
        .trim();

      const subtitleText = $(element).find(".text-ellipsis").first().text().trim();
      const subtitle = subtitleText
        .replace(/\s+/g, " ")
        .replace(/^\d+\s*→\s*/, "")
        .replace(/\s+\d+\s*days?\s*ago$/, "");
      const chapterId =
        $(element)
          .find(".text-ellipsis a")
          .first()
          .attr("href")
          ?.replace("https://hentai2read.com/", "")
          .replace(/\/$/, "") || "";

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
