/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */
import {
  ButtonRow,
  EditSection,
  Form,
  FormSectionElement,
  InputRow,
  LabelRow,
  NavigationRow,
  Section,
  SelectRow,
  StepperRow,
  ToggleRow,
} from "@paperback/types";
import {
  ALL_DISCOVER_SECTIONS,
  DATE_SEPARATOR_OPTIONS,
  DateFormatId,
  DateSeparatorId,
  DaysOldRange,
  DEFAULT_SECTION_ORDER,
  DiscoverSectionDef,
  DisplayOptionId,
  getApiKeyAuthorizedSetting,
  getDateFormatOptionsWithSeparator,
  getDisplayOptionsSetting,

  getDaysOldFilterSetting,
  getDiscoverCarouselTilesSetting,
  getDiscoverPageTilesSetting,
  getDiscoverSectionOrder,
  getEnableRelatedSetting,
  getExcludeTagsSetting,
  getFavoritesThresholdMaxSetting,
  getFavoritesThresholdSetting,
  getHiddenSections,
  getHideReadInRelatedSetting,
  getHideReadSetting,
  getIncludeTagsSetting,
  getIncognitoModeSetting,
  getLanguageSetting,
  getMarkReadOnViewSetting,
  getNHentaiApiKey,
  getPagesExpressionSetting,
  getRateLimitLiteFallbackSetting,
  getRelatedLanguageSetting,
  getRemoveSeparatorSpacesSetting,
  getScreenTimeEnabledSetting,
  getSearchPageTilesSetting,
  getStrictFavoritesFilterSetting,
  getThumbnailQualitySetting,
  isSubtitleHydrationRateLimitedMode,
  LANGUAGE_OPTIONS,
  resetNHentaiSettings,
  sanitizePagesExpressionInput,
  setApiKeyAuthorizedSetting,
  setDateSeparatorSetting,
  setDisplayOptionsSetting,
  setDaysOldFilterSetting,
  setDiscoverCarouselTilesSetting,
  setDiscoverPageTilesSetting,
  setDiscoverSectionOrder,
  setEnableRelatedSetting,
  setExcludeTagsSetting,
  setFavoritesThresholdMaxSetting,
  setFavoritesThresholdSetting,
  setHiddenSections,
  setHideReadInRelatedSetting,
  setHideReadSetting,
  setIncludeTagsSetting,
  setIncognitoModeSetting,
  setLanguageSetting,
  setMarkReadOnViewSetting,
  setNHentaiApiKey,
  setPagesExpressionSetting,
  setRateLimitLiteFallbackSetting,
  setRelatedLanguageSetting,
  setRemoveSeparatorSpacesSetting,
  setSearchPageTilesSetting,
  setStrictFavoritesFilterSetting,
  setThumbnailQualitySetting,
  THUMBNAIL_QUALITY_OPTIONS,
  ThumbnailQuality,
} from "./settings";
import * as NHentaiSettings from "./settings";
import { StatisticsForm } from "./statistics";

function getDateExampleFor(dateFormatId: string, separator: string): string {
  const now = new Date();
  const d = now.getDate();
  const m = now.getMonth() + 1;
  const yy = now.getFullYear().toString().slice(-2);
  const yyyy = now.getFullYear().toString();
  const dd = d.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");

  const patterns: Record<string, string> = {
    mm_dd_yy: `${mm}${separator}${dd}${separator}${yy}`,
    dd_mm_yyyy: `${dd}${separator}${mm}${separator}${yyyy}`,
    yyyy_mm_dd: `${yyyy}${separator}${mm}${separator}${dd}`,
    m_d_yy: `${m}${separator}${d}${separator}${yy}`,
    mm_yy: `${mm}${separator}${yy}`,
    yy_mm: `${yy}${separator}${mm}`,
    m_yy: `${m}${separator}${yy}`,
    yy_m: `${yy}${separator}${m}`,
  };
  return patterns[dateFormatId] || "";
}

function formatRelativeDays(days: number | undefined): string {
  if (days === undefined) return "";
  // Show years format for values >= 1 year (365 days)
  if (days >= 365) {
    const years = days / 365;
    return `${years.toFixed(1)}y`;
  }
  return `${days}d`;
}

function getDateSeparatorOptionsWithFormat(
  format: DateFormatId,
): { id: DateSeparatorId; label: string }[] {
  const names: Record<DateSeparatorId, string> = {
    period: "Period",
    dash: "Dash",
    slash: "Slash",
    comma: "Comma",
    space: "Space",
  };
  return DATE_SEPARATOR_OPTIONS.map((opt) => {
    return {
      id: opt.id,
      label: `${getDateExampleFor(format, opt.char)} - ${names[opt.id]}`,
    };
  });
}

function getDisplayOptionLabel(
  id: DisplayOptionId,
  dateFormat: string,
  dateSeparator: string,
  removeSpaces: boolean,
): string {
  const sep =
    DATE_SEPARATOR_OPTIONS.find((s) => s.id === dateSeparator)?.char ?? ".";
  const dateExample = getDateExampleFor(dateFormat, sep);
  // Calculate relative date example - for display, use current values
  const relativeExample = "9d"; // Example: 9 days ago

  // Format separators based on removeSpaces setting - trailing pipe only
  const langEx = removeSpaces ? '("EN|")' : '("EN | ")';
  const pageEx = removeSpaces ? '("67p|")' : '("67p | ")';
  const favEx = removeSpaces ? '("15114|")' : '("15114 | ")';
  const favAbbrEx = removeSpaces ? '("15.1k|")' : '("15.1k | ")';
  const dateEx = removeSpaces ? `("${dateExample}|")` : `("${dateExample} | ")`;
  const relEx = removeSpaces
    ? `("${relativeExample}|")`
    : `("${relativeExample} | ")`;

  const labels: Record<DisplayOptionId, string> = {
    hide_read_letter: "Show Read Indicator 'r'",
    show_lang_tip: `Show Language in Subtitle ${langEx}`,
    show_lang_desc: `Show Language in Description ${langEx}`,
    show_page_count: `Show Page Count ${pageEx}`,
    abbreviate_favorites: `Show Favorites Abbreviation ${favAbbrEx}`,
    show_favorite_count: `Show Favorites in Subtitle ${favEx}`,
    subtitle_date: `Show Date in Subtitle ${dateEx}`,
    subtitle_relative: `Show Relative Date in Subtitle ${relEx}`,
    desc_show_date: `Show Date in Description ${dateEx}`,
    desc_relative_date: `Show Relative Date in Description ${relEx}`,
    parodies_bottom: "Show Characters in Description",
    show_id: "Show 6-digit ID in Description",
    show_tags_in_desc: "Show Tags in Description",
    show_tag_counts: "Show Tag Counts in Search Filters",
    show_tags_alpha: "Show Tags Alphabetically in Search",
    hide_read: "Hide Read Manga",
    show_related_order: "Show Related Count and Order",
    show_reread_count: "Show Reread Count",
  };
  return labels[id] || id;
}

function getHydrationLimitedEnabledOptions(): string[] {
  const displayOptions = getDisplayOptionsSetting();
  const enabledOptions: string[] = [];
  if (displayOptions.includes("subtitle_date")) {
    enabledOptions.push("Date in Subtitle");
  }
  if (displayOptions.includes("subtitle_relative")) {
    enabledOptions.push("Relative Date in Subtitle");
  }
  return enabledOptions;
}

function formatNaturalOptionsList(enabledOptions: string[]): string {
  if (enabledOptions.length === 0) return "subtitle information options";

  const baseLabels = enabledOptions.map((option) => {
    switch (option) {
      case "Date in Subtitle":
        return "- Dates in Subtitles";
      case "Relative Date in Subtitle":
        return "- Relative Dates in Subtitles";
      default:
        return option;
    }
  });

  return baseLabels.join("\n");
}

const DISPLAY_OPTION_IDS: DisplayOptionId[] = [
  "hide_read_letter",
  "show_lang_tip",
  "show_lang_desc",
  "show_page_count",
  "show_favorite_count",
  "abbreviate_favorites",
  "subtitle_date",
  "subtitle_relative",
  "desc_show_date",
  "desc_relative_date",
  "parodies_bottom",
  "show_id",
  "show_tags_in_desc",
  "show_related_order",
  "show_tag_counts",
  "show_reread_count",
  "show_tags_alpha",
];

class NHentaiApiKeyForm extends Form {
  private apiKey = getNHentaiApiKey() ?? "";


  async updateApiKey(value: string): Promise<void> {
    this.apiKey = value.trim();
    setNHentaiApiKey(this.apiKey.length > 0 ? this.apiKey : undefined);

    if (this.apiKey.length > 0) {

      this.reloadForm();

      try {
        // The API root is public, so use a normal API endpoint to confirm the
        // key is accepted in the same shape the app sends during browsing.
        const [response] = await Application.scheduleRequest({
          url: `https://nhentai.net/api/v2/search?query=english&page=1&sort=date`,
          method: "GET",
          headers: {
            Authorization: `Key ${this.apiKey}`,
          },
        });

        // Log status for easier debugging when users report auth issues.
        console.log(
          `[NHentai] API key validation response: ${response.status} for provided key (length ${this.apiKey.length})`,
        );

        setApiKeyAuthorizedSetting(response.status === 200);
      } catch (e) {
        setApiKeyAuthorizedSetting(false);
      } finally {

      }
    } else {
      setApiKeyAuthorizedSetting(false);
    }

    this.reloadForm();
  }

  override getSections(): FormSectionElement<unknown>[] {
    return [
      Section(
        {
          id: "instructions",
          footer:
            "1. Create an account on nhentai.net.\n2. Go to settings followed by API Keys.\n3. Name it anything. Press Create Key.\n4. Copy and paste the API Key below.\nNote: Accounts must be 2 weeks old to create a key.\n\nRate Limits (Authenticated / Unauthenticated):\n• Searches/min: 20 / 10\n• Gallery Details/min: 45 / 20\n• Thumbnails/min: 240 / 180",
        },
        [],
      ),
      Section("apiKeyInput", [
        InputRow("apiKey", {
          title: "NHentai API Key",
          value: this.apiKey,
          onValueChange: Application.Selector(this as any, "updateApiKey"),
        }),
      ]),
    ];
  }
}

export class SettingsForm extends Form {
  private languageSetting = getLanguageSetting();
  private dateFormat = NHentaiSettings.getDateFormatSetting();
  private dateSeparator = NHentaiSettings.getDateSeparatorSetting();
  private useMilitaryTime = NHentaiSettings.getMilitaryTimeSetting();
  private displayOptions = NHentaiSettings.getDisplayOptionsSetting();
  private enableRelated = getEnableRelatedSetting();
  private relatedLanguage = getRelatedLanguageSetting();
  private thumbnailQuality = getThumbnailQualitySetting();
  private hideRead = getHideReadSetting();
  private removeSpaces = getRemoveSeparatorSpacesSetting();

  async updateLanguage(value: string[]): Promise<void> {
    if (!value || value.length === 0) {
      this.languageSetting = ["all"];
    } else if (value.includes("all") && !this.languageSetting.includes("all")) {
      // "all" was just selected → deselect others
      this.languageSetting = ["all"];
    } else if (value.length > 1 && value.includes("all")) {
      // Specific language selected while "all" was active → remove "all"
      this.languageSetting = value.filter((v) => v !== "all");
    } else {
      this.languageSetting = value;
    }
    setLanguageSetting(this.languageSetting);
    this.reloadForm();
  }

  async updateDateFormat(value: string[]): Promise<void> {
    const selectedIds = Array.isArray(value) ? value.filter(Boolean) : [];
    const militarySelected = selectedIds.includes("military_time");
    const dateFormatIds = selectedIds.filter((id) => id !== "military_time");

    const availableDateFormats = getDateFormatOptionsWithSeparator(
      this.dateSeparator,
    ).map((opt) => opt.id);

    let selectedDateFormat = this.dateFormat;
    const validDateFormatIds = dateFormatIds.filter(
      (id): id is DateFormatId => availableDateFormats.includes(id),
    );
    if (validDateFormatIds.length > 0) {
      selectedDateFormat = validDateFormatIds[0];
    }

    this.dateFormat = selectedDateFormat;
    this.useMilitaryTime = militarySelected;
    NHentaiSettings.setDateFormatSetting(selectedDateFormat);
    NHentaiSettings.setMilitaryTimeSetting(this.useMilitaryTime);
    this.reloadForm();
  }

  async updateDateSeparator(value: string[]): Promise<void> {
    const selected =
      (value?.[0] as typeof this.dateSeparator) ?? this.dateSeparator;
    this.dateSeparator = selected;
    setDateSeparatorSetting(selected);
    this.reloadForm();
  }

  async updateDisplayOptions(value: string[]): Promise<void> {
    this.displayOptions = value as typeof this.displayOptions;
    setDisplayOptionsSetting(this.displayOptions);
    // Re-read persisted state so footer text updates immediately.
    this.displayOptions = getDisplayOptionsSetting();
    this.reloadForm();
  }

  async updateEnableRelated(value: boolean): Promise<void> {
    this.enableRelated = !!value;
    setEnableRelatedSetting(this.enableRelated);
    if (!this.enableRelated && this.relatedLanguage !== "all") {
      this.relatedLanguage = "all";
      setRelatedLanguageSetting("all");
    }
    this.reloadForm();
  }

  async updateRelatedLanguage(value: boolean): Promise<void> {
    // When toggle is on, use the main preferred language (first one); when off, use "all"
    const langs = getLanguageSetting();
    this.relatedLanguage =
      value && langs.length === 1 && langs[0] !== "all" ? langs[0] : "all";
    setRelatedLanguageSetting(this.relatedLanguage);
    this.reloadForm();
  }

  async updateThumbnailQuality(value: string[]): Promise<void> {
    const selected = (value?.[0] as ThumbnailQuality) ?? this.thumbnailQuality;
    this.thumbnailQuality = selected;
    setThumbnailQualitySetting(selected);
    this.reloadForm();
  }

  async updateHideRead(value: boolean): Promise<void> {
    this.hideRead = !!value;
    setHideReadSetting(this.hideRead);
  }

  async updateRemoveSpaces(value: boolean): Promise<void> {
    this.removeSpaces = !!value;
    setRemoveSeparatorSpacesSetting(this.removeSpaces);
    this.reloadForm();
  }

  async handleReset(): Promise<void> {
    resetNHentaiSettings();
    this.languageSetting = NHentaiSettings.getLanguageSetting();
    this.dateFormat = NHentaiSettings.getDateFormatSetting();
    this.dateSeparator = NHentaiSettings.getDateSeparatorSetting();
    this.useMilitaryTime = NHentaiSettings.getMilitaryTimeSetting();
    this.displayOptions = NHentaiSettings.getDisplayOptionsSetting();
    this.enableRelated = getEnableRelatedSetting();
    this.relatedLanguage = getRelatedLanguageSetting();
    this.thumbnailQuality = getThumbnailQualitySetting();
    this.hideRead = getHideReadSetting();
    this.removeSpaces = getRemoveSeparatorSpacesSetting();
    this.reloadForm();
  }

  /**
   * Generate rate limit warning footer based on current display settings.
   * When favorites/date options are enabled, the gallery detail endpoint (45/min)
   * is used instead of the search endpoint (20/min).
   * For anonymous users (no API key), search is limited to 10/min.
   */
  private getRateLimitFooter(): string {
    const hasApiKey = !!getNHentaiApiKey();
    const enabledOptions = getHydrationLimitedEnabledOptions();

    if (!hasApiKey) {
      // Anonymous rate limits are lower; reflect this accurately.
      if (enabledOptions.length === 0) {
        return `API Rate Limit: 10 search requests/minute (No API key)`;
      }
      const optionsList = formatNaturalOptionsList(enabledOptions);
      return `API Rate Limit: 20 total manga requests/minute (No API key)\n\nFor a 10 search requests/minute limit disable: ${optionsList}`;
    }

    if (enabledOptions.length === 0) {
      return `API Rate Limit: 20 search requests/minute (Authenticated)`;
    }

    return `API Rate Limit: 45 manga requests/minute (Authenticated)\nFor a 20 search requests/minute limit disable:\n${formatNaturalOptionsList(enabledOptions)}`;
  }

  override getSections(): FormSectionElement<unknown>[] {
    // Build subtitle example based on current display options
    const sep = this.removeSpaces ? "|" : " | ";
    const parts: string[] = [];
    if (this.displayOptions.includes("show_lang_tip")) parts.push("EN");
    if (this.displayOptions.includes("show_page_count")) parts.push("67p");
    if (this.displayOptions.includes("show_favorite_count")) {
      parts.push(
        this.displayOptions.includes("abbreviate_favorites")
          ? "15.1k"
          : "15114",
      );
    }
    if (this.displayOptions.includes("subtitle_relative")) parts.push("5h");
    if (this.displayOptions.includes("subtitle_date")) {
      const dateSep =
        DATE_SEPARATOR_OPTIONS.find((s) => s.id === (this.dateSeparator as any))
          ?.char ?? ".";
      parts.push(getDateExampleFor(this.dateFormat, dateSep));
    }
    const subtitleExample =
      parts.length > 0
        ? parts.join(sep)
        : this.removeSpaces
          ? "EN|67p"
          : "EN | 67p";

    return [
      // Main settings section - NHentai Settings header + Language + Manga Filters nav
      Section("nhentaiMain", [
        LabelRow("topLabel", {
          title: "NHentai Settings",
          subtitle: `Subtitle Preview: ${subtitleExample}`,
        }),
        SelectRow("languageNav", {
          title:
            this.languageSetting.includes("all") ||
              this.languageSetting.length !== 1
              ? "Preferred Languages"
              : "Preferred Language",
          layout: "list",
          value: this.languageSetting,
          items: LANGUAGE_OPTIONS.map((option) => ({
            id: option.id,
            title: option.label,
          })),
          onValueChange: Application.Selector(this as any, "updateLanguage"),
          minItemCount: 1,
          maxItemCount: LANGUAGE_OPTIONS.length,
        }),
        NavigationRow("apiKeyNav", {
          title: "NHentai API Key",
          value: getApiKeyAuthorizedSetting()
            ? "Status: Authorized"
            : "Status: Unauthorized",
          form: new NHentaiApiKeyForm(),
        }),
      ]),
      // Thumbnail and Display Options section
      Section("displaySettingsNav", [
        // Display Options first
        SelectRow("displayOptionsNav", {
          title: "Display Options",
          layout: "list",
          value: this.displayOptions,
          options: DISPLAY_OPTION_IDS.map((id) => ({
            id,
            title: getDisplayOptionLabel(
              id,
              this.dateFormat,
              this.dateSeparator,
              this.removeSpaces,
            ),
          })),
          onValueChange: Application.Selector(
            this as any,
            "updateDisplayOptions",
          ),
          minItemCount: 0,
          maxItemCount: DISPLAY_OPTION_IDS.length,
        }),
        SelectRow("thumbnailQualityNav", {
          title: "Thumbnail Quality",
          layout: "list",
          value: [this.thumbnailQuality],
          options: THUMBNAIL_QUALITY_OPTIONS.map((opt) => ({
            id: opt.id,
            title: opt.label,
          })),
          onValueChange: Application.Selector(
            this as any,
            "updateThumbnailQuality",
          ),
          minItemCount: 1,
          maxItemCount: 1,
        }),
        // Remove Spaces setting
        ToggleRow("removeSpaces", {
          title: "Remove Spaces From Separators",
          value: this.removeSpaces,
          onValueChange: Application.Selector(
            this as any,
            "updateRemoveSpaces",
          ),
        }),
      ]),
      // Statistics section
      Section("statistics", [
        NavigationRow("mangaFiltersNav", {
          title: "Manga Filters",
          subtitle: "Applies To Search And Discover",
          form: new MangaFiltersForm(),
        }),
        NavigationRow("discoverOrderNav", {
          title: "Home & Search Sections",
          subtitle: "Toggle & Reorder Sections",
          form: new DiscoverOrderForm(),
        }),
        NavigationRow("statisticsNav", {
          title: getScreenTimeEnabledSetting()
            ? "Statistics & Screen Time"
            : "Statistics",
          form: new StatisticsForm(),
        }),
      ]),
      // Date Settings section with rate limit warning footer
      Section({ id: "dateSettings", footer: this.getRateLimitFooter() }, [
        SelectRow("dateFormatNav", {
          title: "Date & Time Format",
          layout: "list",
          value: [
            this.dateFormat,
            ...(this.useMilitaryTime ? ["military_time"] : []),
          ],
          options: [
            ...getDateFormatOptionsWithSeparator(this.dateSeparator),
            { id: "military_time", label: "16:07 - Military Time" } as const,
          ].map((opt) => ({
            id: opt.id,
            title: "label" in opt ? opt.label : (opt as any).title,
          })),
          onValueChange: Application.Selector(this as any, "updateDateFormat"),
          minItemCount: 1,
          maxItemCount: 2,
        }),
        SelectRow("dateSeparatorNav", {
          title: "Date Separator",
          layout: "list",
          value: [this.dateSeparator],
          options: getDateSeparatorOptionsWithFormat(this.dateFormat).map(
            (opt) => ({
              id: opt.id,
              title: opt.label,
            }),
          ),
          onValueChange: Application.Selector(
            this as any,
            "updateDateSeparator",
          ),
          minItemCount: 1,
          maxItemCount: 1,
        }),
      ]),
      Section("reset", [
        ButtonRow("reset", {
          title: "Reset to Defaults",
          onSelect: Application.Selector(this as any, "handleReset"),
        }),
      ]),
    ];
  }
}

function stripTagPrefix(value: string): string {
  return value
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      // Detect OR groups (|| or OR keyword) for union-then-intersect processing
      if (/\s*\|\|\s*|\s+OR\s+/i.test(t)) {
        const orParts = t
          .split(/\s*\|\|\s*|\s+OR\s+/i)
          .map((part) => {
            let clean = part.trim();
            const isNegative = clean.startsWith("-");
            if (isNegative) clean = clean.slice(1);
            const prefixMatch = clean.match(
              /^(?:tag|female|male|artist|group|series|character|language):(.+)$/i,
            );
            if (prefixMatch) {
              clean = prefixMatch[1];
            }
            if (clean.startsWith('"') && clean.endsWith('"')) {
              clean = clean.slice(1, -1);
            }
            return (isNegative ? "-" : "") + clean;
          })
          .filter(Boolean);
        return orParts.join(" OR ");
      } else {
        const isNegative = t.startsWith("-");
        let clean = isNegative ? t.slice(1) : t;
        const prefixMatch = clean.match(
          /^(?:tag|female|male|artist|group|series|character|language):(.+)$/i,
        );
        if (prefixMatch) {
          clean = prefixMatch[1];
        }
        if (clean.startsWith('"') && clean.endsWith('"')) {
          clean = clean.slice(1, -1);
        }
        return (isNegative ? "-" : "") + clean;
      }
    })
    .join(", ");
}

class MangaFiltersForm extends Form {
  private includeTags = getIncludeTagsSetting();
  private excludeTags = getExcludeTagsSetting();
  private pagesExpr = getPagesExpressionSetting();
  private discoverCarouselTiles = getDiscoverCarouselTilesSetting();
  private discoverPageTiles = getDiscoverPageTilesSetting();
  private searchPageTiles = getSearchPageTilesSetting();
  private daysOldFilter = getDaysOldFilterSetting();
  private favoritesThreshold = getFavoritesThresholdSetting();
  private favoritesThresholdMax = getFavoritesThresholdMaxSetting();
  private strictFavorites = getStrictFavoritesFilterSetting();
  private rateLimitLiteFallback = getRateLimitLiteFallbackSetting();
  private incognito = getIncognitoModeSetting();
  private hideRead = getHideReadSetting();
  private enableRelated = getEnableRelatedSetting();
  private relatedLanguage = getRelatedLanguageSetting();
  private hideReadInRelated = getHideReadInRelatedSetting();
  private markReadOnView = getMarkReadOnViewSetting();

  private normalizeStepperValue(
    value: unknown,
    min: number,
    max: number,
    fallback: number,
  ): number {
    const normalized: unknown =
      Array.isArray(value) && value.length > 0
        ? (value as unknown[])[0]
        : value;
    let parsed = NaN;
    if (typeof normalized === "number") {
      parsed = normalized;
    } else if (typeof normalized === "string") {
      parsed = Number.parseInt(normalized, 10);
    } else if (typeof normalized === "boolean") {
      parsed = normalized ? 1 : 0;
    }
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
  }

  override getSections(): FormSectionElement<unknown>[] {
    const showHydrationToggle = isSubtitleHydrationRateLimitedMode();

    return [
      Section("tileLayoutSection", [
        ...(showHydrationToggle
          ? [
            ToggleRow("rateLimitLiteFallback", {
              title: "Dynamic Rate Limit Fallback",
              subtitle: `After the ${getNHentaiApiKey() ? "45" : "20"} manga/min limit is reached, remove dates in subtitles to display more manga.`,
              value: this.rateLimitLiteFallback,
              onValueChange: Application.Selector(
                this as any,
                "updateRateLimitLiteFallback",
              ),
            }),
          ]
          : []),
        StepperRow("discoverCarouselTiles", {
          title: "Tiles on Carousel",
          value: this.discoverCarouselTiles,
          minValue: 1,
          maxValue: 6,
          stepValue: 1,
          loopOver: false,
          onValueChange: Application.Selector(
            this as any,
            "updateDiscoverCarouselTiles",
          ),
        }),
        StepperRow("discoverPageTiles", {
          title: "Tiles on Discover",
          value: this.discoverPageTiles,
          minValue: 1,
          maxValue: 12,
          stepValue: 1,
          loopOver: false,
          onValueChange: Application.Selector(
            this as any,
            "updateDiscoverPageTiles",
          ),
        }),
        StepperRow("searchPageTiles", {
          title: "Tiles on Search",
          value: this.searchPageTiles,
          minValue: 1,
          maxValue: 16,
          stepValue: 1,
          loopOver: false,
          onValueChange: Application.Selector(
            this as any,
            "updateSearchPageTiles",
          ),
        }),
      ]),
      // Section 1: Tags and filters
      Section("filtersSection", [
        InputRow("includeTags", {
          title: "Included Tags (e.g. yuri, anal OR maid)",
          value: stripTagPrefix(this.includeTags),
          onValueChange: Application.Selector(this as any, "updateIncludeTags"),
        }),
        InputRow("excludeTags", {
          title: "Excluded Tags (e.g. netorare, bbw)",
          value: stripTagPrefix(this.excludeTags),
          onValueChange: Application.Selector(this as any, "updateExcludeTags"),
        }),
        InputRow("pagesFilter", {
          title: "Page Count (e.g. 20-50, >30, 100+, 69<)",
          value: this.pagesExpr,
          onValueChange: Application.Selector(this as any, "updatePagesExpr"),
        }),
        InputRow("favoritesFilter", {
          title: "Favorites (e.g. >500, 1000+, 69<)",
          value: this.formatFavoritesThreshold(),
          onValueChange: Application.Selector(
            this as any,
            "updateFavoritesThreshold",
          ),
        }),
        ...(this.favoritesThreshold !== undefined ||
          this.favoritesThresholdMax !== undefined
          ? [
            ToggleRow("strictFavorites", {
              title: "Strict Client-side Favorites Filtering",
              subtitle: "Lowers Rate Limits. Not Recommended.",
              value: this.strictFavorites,
              onValueChange: Application.Selector(
                this as any,
                "updateStrictFavorites",
              ),
            }),
          ]
          : []),
        InputRow("daysOldFilter", {
          title: "Date Added (e.g. 7+, <7d, 1w-3y, 14-)",
          value: this.formatDaysOldFilter(),
          onValueChange: Application.Selector(
            this as any,
            "updateDaysOldFilter",
          ),
        }),
      ]),
      // Section 2: Behavior toggles — single section, reordered
      Section("behaviorSection", [
        ToggleRow("pauseHideRead", {
          title: "Pause Read Manga Tracking",
          subtitle: "Paperback Continues Tracking History",
          value: this.incognito,
          onValueChange: Application.Selector(this as any, "updateIncognito"),
        }),
        ToggleRow("filterRelatedByLanguage", {
          title: "Apply Preferred Language to Related Section",
          subtitle: "Related Manga Will Follow Preferred Langugage Setting",
          value: this.relatedLanguage !== "all",
          onValueChange: Application.Selector(
            this as any,
            "updateRelatedLanguage",
          ),
        }),
        ToggleRow("hideReadInRelated", {
          title: "Hide Read Manga in Related",
          subtitle: "Applies To Related Manga Section",
          value: this.hideReadInRelated,
          onValueChange: Application.Selector(
            this as any,
            "updateHideReadInRelated",
          ),
        }),
        ToggleRow("hideRead", {
          title: "Hide Read Manga",
          subtitle: "Applies to Search and Discover",
          value: this.hideRead,
          onValueChange: Application.Selector(this as any, "updateHideRead"),
        }),
        ToggleRow("markReadOnView", {
          title: "Mark As Read On Description",
          subtitle: "Mark Manga as Read When Viewing Their Description",
          value: this.markReadOnView,
          onValueChange: Application.Selector(
            this as any,
            "updateMarkReadOnView",
          ),
        }),
      ]),
    ];
  }

  async updateIncludeTags(value: string): Promise<void> {
    this.includeTags = value ?? "";
    setIncludeTagsSetting(value ?? "");
    this.reloadForm();
  }

  async updateExcludeTags(value: string): Promise<void> {
    this.excludeTags = value ?? "";
    setExcludeTagsSetting(value ?? "");
    this.reloadForm();
  }

  async updatePagesExpr(value: string): Promise<void> {
    this.pagesExpr = sanitizePagesExpressionInput(value ?? "");
    setPagesExpressionSetting(this.pagesExpr);
    this.pagesExpr = getPagesExpressionSetting();
    this.reloadForm();
  }

  async updateHideRead(value: boolean): Promise<void> {
    this.hideRead = !!value;
    setHideReadSetting(this.hideRead);
    this.reloadForm();
  }

  async updateEnableRelated(value: boolean): Promise<void> {
    this.enableRelated = !!value;
    setEnableRelatedSetting(this.enableRelated);
    if (!this.enableRelated && this.hideReadInRelated) {
      this.hideReadInRelated = false;
      setHideReadInRelatedSetting(false);
    }
    this.reloadForm();
  }

  async updateRelatedLanguage(value: boolean): Promise<void> {
    const langs = getLanguageSetting();
    this.relatedLanguage =
      value && langs.length === 1 && langs[0] !== "all" ? langs[0] : "all";
    setRelatedLanguageSetting(this.relatedLanguage);
    this.reloadForm();
  }

  async updateHideReadInRelated(value: boolean): Promise<void> {
    this.hideReadInRelated = !!value;
    setHideReadInRelatedSetting(this.hideReadInRelated);
  }

  async updateFavoritesThreshold(value: string): Promise<void> {
    const trimmed = value.trim();
    if (!trimmed) {
      this.favoritesThreshold = undefined;
      this.favoritesThresholdMax = undefined;
      setFavoritesThresholdSetting(undefined);
      setFavoritesThresholdMaxSetting(undefined);
      return;
    }

    // Support range format: 15000-25000 (min-max)
    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      this.favoritesThreshold = min;
      this.favoritesThresholdMax = max;
      setFavoritesThresholdSetting(min);
      setFavoritesThresholdMaxSetting(max);

      return;
    }

    // Prefix comparator: >500, >=500, <500, <=500
    const prefixCmpMatch = trimmed.match(/^(>=|<=|>|<)\s*(\d+)$/);
    if (prefixCmpMatch) {
      const op = prefixCmpMatch[1];
      const n = Number(prefixCmpMatch[2]);
      if (!Number.isNaN(n)) {
        if (op === ">" || op === ">=") {
          this.favoritesThreshold = n;
          this.favoritesThresholdMax = undefined;
        } else {
          this.favoritesThreshold = undefined;
          this.favoritesThresholdMax = n;
        }
      }
      setFavoritesThresholdSetting(this.favoritesThreshold);
      setFavoritesThresholdMaxSetting(this.favoritesThresholdMax);

      return;
    }

    // Support: 500+
    const plusMatch = trimmed.match(/^(\d+)\+$/);
    if (plusMatch) {
      const n = Number(plusMatch[1]);
      this.favoritesThreshold = Number.isNaN(n) ? undefined : n;
      this.favoritesThresholdMax = undefined;
      setFavoritesThresholdSetting(this.favoritesThreshold);
      setFavoritesThresholdMaxSetting(undefined);

      return;
    }

    // Support: 500-
    const minusMatch = trimmed.match(/^(\d+)-$/);
    if (minusMatch) {
      const n = Number(minusMatch[1]);
      this.favoritesThreshold = undefined;
      this.favoritesThresholdMax = Number.isNaN(n) ? undefined : n;
      setFavoritesThresholdSetting(undefined);
      setFavoritesThresholdMaxSetting(this.favoritesThresholdMax);

      return;
    }

    // Postfix comparator syntax: 500>, 500>=, 500<, 500<=
    const postfixCmpMatch = trimmed.match(/^(\d+)\s*(>=|<=|>|<)$/);
    if (postfixCmpMatch) {
      const n = Number(postfixCmpMatch[1]);
      const op = postfixCmpMatch[2];
      if (!Number.isNaN(n)) {
        if (op === ">" || op === ">=") {
          this.favoritesThreshold = n;
          this.favoritesThresholdMax = undefined;
        } else {
          this.favoritesThreshold = undefined;
          this.favoritesThresholdMax = n;
        }
      }
      setFavoritesThresholdSetting(this.favoritesThreshold);
      setFavoritesThresholdMaxSetting(this.favoritesThresholdMax);

      return;
    }

    // Plain number defaults to greater-than
    const plainMatch = trimmed.match(/^(\d+)$/);
    if (plainMatch) {
      const n = Number(plainMatch[1]);
      this.favoritesThreshold = Number.isNaN(n) ? undefined : n;
      this.favoritesThresholdMax = undefined;
      setFavoritesThresholdSetting(this.favoritesThreshold);
      setFavoritesThresholdMaxSetting(undefined);
    }
  }

  async updateStrictFavorites(value: boolean): Promise<void> {
    this.strictFavorites = !!value;
    setStrictFavoritesFilterSetting(this.strictFavorites);
  }

  async updateRateLimitLiteFallback(value: boolean): Promise<void> {
    this.rateLimitLiteFallback = !!value;
    setRateLimitLiteFallbackSetting(this.rateLimitLiteFallback);
  }

  async updateDiscoverCarouselTiles(value: unknown): Promise<void> {
    this.discoverCarouselTiles = this.normalizeStepperValue(
      value,
      1,
      6,
      this.discoverCarouselTiles,
    );
    setDiscoverCarouselTilesSetting(this.discoverCarouselTiles);
    this.reloadForm();
  }

  async updateDiscoverPageTiles(value: unknown): Promise<void> {
    this.discoverPageTiles = this.normalizeStepperValue(
      value,
      1,
      12,
      this.discoverPageTiles,
    );
    setDiscoverPageTilesSetting(this.discoverPageTiles);
    this.reloadForm();
  }

  async updateSearchPageTiles(value: unknown): Promise<void> {
    this.searchPageTiles = this.normalizeStepperValue(
      value,
      1,
      16,
      this.searchPageTiles,
    );
    setSearchPageTilesSetting(this.searchPageTiles);
    this.reloadForm();
  }

  async updateDaysOldFilter(value: string): Promise<void> {
    const parsed = this.parseDaysOldFilter(value);
    this.daysOldFilter = parsed;
    setDaysOldFilterSetting(parsed);
    this.reloadForm();
  }

  async updateIncognito(value: boolean): Promise<void> {
    this.incognito = !!value;
    setIncognitoModeSetting(this.incognito);
    if (this.incognito && this.markReadOnView) {
      this.markReadOnView = false;
      setMarkReadOnViewSetting(false);
    }
    this.reloadForm();
  }

  async updateMarkReadOnView(value: boolean): Promise<void> {
    this.markReadOnView = !!value;
    setMarkReadOnViewSetting(this.markReadOnView);
  }

  private formatFavoritesThreshold(): string {
    if (
      this.favoritesThreshold !== undefined &&
      this.favoritesThresholdMax !== undefined
    ) {
      return `${this.favoritesThreshold}-${this.favoritesThresholdMax}`;
    }
    if (this.favoritesThreshold !== undefined) {
      return `${this.favoritesThreshold}+`;
    }
    if (this.favoritesThresholdMax !== undefined) {
      return `${this.favoritesThresholdMax}-`;
    }
    return "";
  }

  private formatDaysOldFilter(): string {
    const oldest = this.daysOldFilter?.oldest;
    const newest = this.daysOldFilter?.newest;
    // Use formatRelativeDays for values >= 365 days (1 year)
    if (oldest !== undefined && newest !== undefined) {
      const oldestStr =
        oldest >= 365 ? formatRelativeDays(oldest) : `${oldest}d`;
      const newestStr =
        newest >= 365 ? formatRelativeDays(newest) : `${newest}d`;
      return `${oldestStr}<x<${newestStr}`;
    }
    if (oldest !== undefined) {
      return oldest >= 365 ? `${formatRelativeDays(oldest)}+` : `${oldest}d+`;
    }
    if (newest !== undefined) {
      return newest >= 365 ? `${formatRelativeDays(newest)}-` : `${newest}d-`;
    }
    return "";
  }

  private parseDaysOldFilter(value: string): DaysOldRange {
    const trimmed = value.trim();
    if (!trimmed) return {};

    // Unit pattern: d=day, w=week, m=month, y=year
    const unitPat = "[dwmy]";
    const numPat = `\\d+(?:\\.\\d+)?${unitPat}?`;

    // Handle inequality range format: 15<x<30 or 15d<a<30d (any alpha char as placeholder)
    // Normalize to lower<x<upper regardless of input order.
    const inequalityRangeMatch = trimmed.match(
      new RegExp(`^(${numPat})\\s*<\\s*[a-zA-Z]\\s*<\\s*(${numPat})$`),
    );
    if (inequalityRangeMatch) {
      const a = this.parseDaysValue(inequalityRangeMatch[1]);
      const b = this.parseDaysValue(inequalityRangeMatch[2]);
      return { oldest: Math.min(a, b), newest: Math.max(a, b) };
    }

    // Handle -5 format as "less than 5 days old" (newer than 5 days)
    const negativeMatch = trimmed.match(new RegExp(`^-(${numPat})$`));
    if (negativeMatch) {
      return { newest: this.parseDaysValue(negativeMatch[1]) };
    }

    // Range: 7-30 or 1w-30d means between those values
    const rangeMatch = trimmed.match(
      new RegExp(`^(${numPat})\\s*-\\s*(${numPat})$`),
    );
    if (rangeMatch) {
      const a = this.parseDaysValue(rangeMatch[1]);
      const b = this.parseDaysValue(rangeMatch[2]);
      return { oldest: Math.min(a, b), newest: Math.max(a, b) };
    }

    // Suffix: 30+ or 1y+ means that many days or more old (older)
    const olderMatch = trimmed.match(
      new RegExp(`^(${numPat})\\s*\\+$|^>=?(${numPat})$`),
    );
    if (olderMatch)
      return { oldest: this.parseDaysValue(olderMatch[1] || olderMatch[2]) };

    // Postfix >: 5000> means older than 5000 days
    const postfixOlderMatch = trimmed.match(new RegExp(`^(${numPat})\\s*>=?$`));
    if (postfixOlderMatch)
      return { oldest: this.parseDaysValue(postfixOlderMatch[1]) };

    // Prefix: <7d means less than 7 days old (newer)
    const newerMatch = trimmed.match(
      new RegExp(`^(${numPat})\\s*-$|^<=?(${numPat})$`),
    );
    if (newerMatch)
      return { newest: this.parseDaysValue(newerMatch[1] || newerMatch[2]) };

    // Postfix <: 5000< means newer than 5000 days
    const postfixNewerMatch = trimmed.match(new RegExp(`^(${numPat})\\s*<=?$`));
    if (postfixNewerMatch)
      return { newest: this.parseDaysValue(postfixNewerMatch[1]) };

    // Plain number or number+unit: treat as "newer than X days" (e.g. "7" or "7d" → newer than 7 days)
    const exactMatch = trimmed.match(new RegExp(`^(${numPat})$`));
    if (exactMatch) {
      const days = this.parseDaysValue(exactMatch[1]);
      return { newest: days };
    }

    return {};
  }

  private parseDaysValue(value: string): number {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.endsWith("y")) {
      const years = parseFloat(trimmed.slice(0, -1));
      return Math.round(years * 365);
    }
    if (trimmed.endsWith("m")) {
      const months = parseFloat(trimmed.slice(0, -1));
      return Math.round(months * 30);
    }
    if (trimmed.endsWith("w")) {
      const weeks = parseFloat(trimmed.slice(0, -1));
      return Math.round(weeks * 7);
    }
    if (trimmed.endsWith("d")) {
      return parseInt(trimmed.slice(0, -1), 10);
    }
    return parseInt(trimmed, 10);
  }
}

// -- Discover Order Form --

class DiscoverOrderForm extends Form {
  private order = getDiscoverSectionOrder();
  private hidden = getHiddenSections();

  constructor() {
    super();
  }

  private getVisibleIds(): string[] {
    return this.order.filter((id) => !this.hidden.has(id));
  }

  private getHiddenIds(): string[] {
    return this.order.filter((id) => this.hidden.has(id));
  }

  private persistLists(visibleIds: string[], hiddenIds: string[]): void {
    const knownIds = ALL_DISCOVER_SECTIONS.map((section) => section.id);
    const seen = new Set<string>();
    const nextVisible = visibleIds.filter((id) => {
      if (!knownIds.includes(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const nextHidden = hiddenIds.filter((id) => {
      if (!knownIds.includes(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    for (const id of knownIds) {
      if (!seen.has(id)) {
        nextVisible.push(id);
        seen.add(id);
      }
    }

    this.order = [...nextVisible, ...nextHidden];
    this.hidden = new Set(nextHidden);
    setDiscoverSectionOrder(this.order);
    setHiddenSections(this.hidden);
  }

  private reorderListByIndices(
    list: string[],
    srcIndex: number,
    destIndex: number,
  ): string[] {
    const length = list.length;
    if (length < 2) return list;
    const normalizedSrc = Math.trunc(Number(srcIndex));
    const normalizedDestInput = Math.trunc(Number(destIndex));
    if (
      !Number.isFinite(normalizedSrc) ||
      !Number.isFinite(normalizedDestInput)
    ) {
      return list;
    }
    if (normalizedSrc < 0 || normalizedSrc >= length) return list;

    const normalizedDest = Math.max(0, Math.min(normalizedDestInput, length));
    if (normalizedDest === normalizedSrc) {
      return list;
    }

    const next = [...list];
    const [moved] = next.splice(normalizedSrc, 1);
    if (!moved) return list;
    const boundedDest = Math.max(0, Math.min(normalizedDest, next.length));
    next.splice(boundedDest, 0, moved);
    return next;
  }

  async rowDidReorderVisible(
    srcIndex: number,
    destIndex: number,
  ): Promise<void> {
    const visible = this.getVisibleIds();
    const hidden = this.getHiddenIds();
    const nextVisible = this.reorderListByIndices(visible, srcIndex, destIndex);
    if (
      nextVisible.length === visible.length &&
      nextVisible.every((id, index) => id === visible[index])
    ) {
      return;
    }
    this.persistLists(nextVisible, hidden);
    this.reloadForm();
  }

  async rowDidReorderHidden(
    srcIndex: number,
    destIndex: number,
  ): Promise<void> {
    const visible = this.getVisibleIds();
    const hidden = this.getHiddenIds();
    const nextHidden = this.reorderListByIndices(hidden, srcIndex, destIndex);
    if (
      nextHidden.length === hidden.length &&
      nextHidden.every((id, index) => id === hidden[index])
    ) {
      return;
    }
    this.persistLists(visible, nextHidden);
    this.reloadForm();
  }

  async rowDidDeleteVisible(index: number): Promise<void> {
    const visible = this.getVisibleIds();
    const hidden = this.getHiddenIds();
    const normalizedIndex = Math.trunc(Number(index));
    if (!Number.isFinite(normalizedIndex)) return;
    if (normalizedIndex < 0 || normalizedIndex >= visible.length) return;
    const [id] = visible.splice(normalizedIndex, 1);
    if (!id) return;
    if (!hidden.includes(id)) hidden.push(id);
    this.persistLists(visible, hidden);
    this.reloadForm();
  }

  async rowDidDeleteHidden(index: number): Promise<void> {
    const visible = this.getVisibleIds();
    const hidden = this.getHiddenIds();
    const normalizedIndex = Math.trunc(Number(index));
    if (!Number.isFinite(normalizedIndex)) return;
    if (normalizedIndex < 0 || normalizedIndex >= hidden.length) return;
    const [id] = hidden.splice(normalizedIndex, 1);
    if (!id) return;
    if (!visible.includes(id)) visible.push(id);
    this.persistLists(visible, hidden);
    this.reloadForm();
  }

  override getSections(): FormSectionElement<unknown>[] {
    const sectionMap = new Map<string, DiscoverSectionDef>(
      ALL_DISCOVER_SECTIONS.map((s) => [s.id, s]),
    );

    const visibleIds = this.getVisibleIds();
    const hiddenIds = this.getHiddenIds();

    const visibleRows = visibleIds
      .map((id) => {
        const def = sectionMap.get(id);
        if (!def) return undefined;
        return LabelRow(`visible_${id}`, {
          title: def.title,
          subtitle: def.subtitle,
        });
      })
      .filter((row): row is NonNullable<typeof row> => row !== undefined);

    const hiddenRows = hiddenIds
      .map((id) => {
        const def = sectionMap.get(id);
        if (!def) return undefined;
        return LabelRow(`hidden_${id}`, {
          title: def.title,
          subtitle: def.subtitle,
        });
      })
      .filter((row): row is NonNullable<typeof row> => row !== undefined);

    const visibleReorderSelectorId = Application.Selector(
      this as any,
      "rowDidReorderVisible",
    );
    const visibleDeletionSelectorId = Application.Selector(
      this as any,
      "rowDidDeleteVisible",
    );
    const hiddenReorderSelectorId = Application.Selector(
      this as any,
      "rowDidReorderHidden",
    );
    const hiddenDeletionSelectorId = Application.Selector(
      this as any,
      "rowDidDeleteHidden",
    );

    return [
      EditSection("visibleOrdering", {
        id: "visibleOrdering",
        header: "VISIBLE ORDERING",
        footer: "Drag to reorder. Swipe to hide.",
        items: visibleRows,
        allowReorder: true,
        allowDeletion: true,
        onReorder: visibleReorderSelectorId as never,
        onDeletion: visibleDeletionSelectorId as never,
      }),
      EditSection("hiddenSections", {
        id: "hiddenSections",
        header: "HIDDEN SECTIONS",
        items: hiddenRows,
        allowReorder: true,
        allowDeletion: true,
        onReorder: hiddenReorderSelectorId as never,
        onDeletion: hiddenDeletionSelectorId as never,
      }),
      Section("resetOrder", [
        ButtonRow("resetOrderBtn", {
          title: "Reset to Default Order",
          onSelect: Application.Selector(this as any, "handleReset"),
        }),
      ]),
    ];
  }

  async handleReset() {
    this.order = [...DEFAULT_SECTION_ORDER];
    this.hidden = new Set();
    setDiscoverSectionOrder(this.order);
    setHiddenSections(this.hidden);
    this.reloadForm();
  }
}
