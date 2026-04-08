import {
  ButtonRow,
  Form,
  FormSectionElement,
  InputRow,
  LabelRow,
  NavigationRow,
  Section,
  SelectRow,
  ToggleRow,
} from "@paperback/types";
import {
  ALL_DISCOVER_SECTIONS,
  DATE_SEPARATOR_OPTIONS,
  DaysOldRange,
  DEFAULT_SECTION_ORDER,
  DiscoverSectionDef,
  DisplayOptionId,
  getDateFormatOptionsWithSeparator,
  getDateFormatSetting,
  getDateSeparatorSetting,
  getDaysOldFilterSetting,
  getDiscoverSectionOrder,
  getDisplayOptionsSetting,
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
  getPagesExpressionSetting,
  getRelatedLanguageSetting,
  getRemoveSeparatorSpacesSetting,
  getScreenTimeEnabledSetting,
  getStrictFavoritesFilterSetting,
  getThumbnailQualitySetting,
  LANGUAGE_OPTIONS,
  resetNHentaiSettings,
  sanitizePagesExpressionInput,
  setDateFormatSetting,
  setDateSeparatorSetting,
  setDaysOldFilterSetting,
  setDiscoverSectionOrder,
  setDisplayOptionsSetting,
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
  setPagesExpressionSetting,
  setRelatedLanguageSetting,
  setRemoveSeparatorSpacesSetting,
  setStrictFavoritesFilterSetting,
  setThumbnailQualitySetting,
  THUMBNAIL_QUALITY_OPTIONS,
  ThumbnailQuality,
} from "./settings";
import { StatisticsForm } from "./statistics";

// Helper function to format date examples based on current date format
function getDateExampleFor(dateFormatId: string, separator: string): string {
  const now = new Date();
  const d = now.getDate();
  const m = now.getMonth() + 1;
  const yy = now.getFullYear().toString().slice(-2);
  const yyyy = now.getFullYear().toString();
  const dd = d.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");

  const examples: Record<string, string> = {
    mm_dd_yy: `${mm}${separator}${dd}${separator}${yy}`,
    dd_mm_yyyy: `${dd}${separator}${mm}${separator}${yyyy}`,
    yyyy_mm_dd: `${yyyy}${separator}${mm}${separator}${dd}`,
    m_d_yy: `${m}${separator}${d}${separator}${yy}`,
    mm_yy: `${mm}${separator}${yy}`,
    yy_mm: `${yy}${separator}${mm}`,
    m_yy: `${m}${separator}${yy}`,
    yy_m: `${yy}${separator}${m}`,
  };
  return examples[dateFormatId] || "";
}

// Helper to format relative date display (1.0y format for >= 1 year)
function formatRelativeDays(days: number | undefined): string {
  if (days === undefined) return "";
  // Show years format for values >= 1 year (365 days)
  if (days >= 365) {
    const years = days / 365;
    return `${years.toFixed(1)}y`;
  }
  return `${days}d`;
}

// Get dynamic separator options using current date format
function getDateSeparatorOptionsWithFormat(
  dateFormatId: string,
): { id: string; label: string; char: string }[] {
  return DATE_SEPARATOR_OPTIONS.map((opt) => ({
    id: opt.id,
    label: `${getDateExampleFor(dateFormatId, opt.char)} - ${opt.id.charAt(0).toUpperCase() + opt.id.slice(1)}`,
    char: opt.char,
  }));
}

// Display option labels with examples
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
    hide_read: "Hide Read Manga",
    show_related_order: "Show Related Count and Order",
    show_tag_counts: "Show Tag Counts in Search Filters",
    show_reread_count: "Show Reread Count",
  };
  return labels[id] || id;
}

export class SettingsForm extends Form {
  private languageSetting = getLanguageSetting();
  private dateFormat = getDateFormatSetting();
  private dateSeparator = getDateSeparatorSetting();
  private displayOptions = getDisplayOptionsSetting();
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
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateDateFormat(value: string[]): Promise<void> {
    const selected = (value?.[0] as typeof this.dateFormat) ?? this.dateFormat;
    this.dateFormat = selected;
    setDateFormatSetting(selected);
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
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
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
    this.languageSetting = getLanguageSetting();
    this.dateFormat = getDateFormatSetting();
    this.dateSeparator = getDateSeparatorSetting();
    this.displayOptions = getDisplayOptionsSetting();
    this.enableRelated = getEnableRelatedSetting();
    this.relatedLanguage = getRelatedLanguageSetting();
    this.thumbnailQuality = getThumbnailQualitySetting();
    this.hideRead = getHideReadSetting();
    this.removeSpaces = getRemoveSeparatorSpacesSetting();
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  /**
   * Generate rate limit warning footer based on current display settings.
   * When favorites/date options are enabled, the gallery detail endpoint (45/min)
   * is used instead of the faster search endpoint (60/min effective).
   */
  private getRateLimitFooter(): string {
    const hasFavorites = this.displayOptions.includes("show_favorite_count");
    const hasSubtitleDate = this.displayOptions.includes("subtitle_date");
    const hasRelativeDate = this.displayOptions.includes("subtitle_relative");

    // List which options are causing the lower rate limit
    const enabledOptions: string[] = [];
    if (hasFavorites) enabledOptions.push("Favorites in Subtitle");
    if (hasSubtitleDate) enabledOptions.push("Date in Subtitle");
    if (hasRelativeDate) enabledOptions.push("Relative Date in Subtitle");

    if (enabledOptions.length === 0) {
      return "API Rate Limit: 60 requests/minute (optimal speed)\n\nEnabling any Display Options below (Favorites in Subtitle, Date in Subtitle, or Relative Date in Subtitle) will reduce the limit to 45/minute.";
    }

    // Format the list with proper grammar (x, y, and z)
    let optionsList: string;
    if (enabledOptions.length === 1) {
      optionsList = enabledOptions[0];
    } else if (enabledOptions.length === 2) {
      optionsList = enabledOptions.join(" and ");
    } else {
      optionsList =
        enabledOptions.slice(0, -1).join(", ") +
        ", and " +
        enabledOptions[enabledOptions.length - 1];
    }

    return `API Rate Limit: 45 requests/minute (limited by Display Options)\n\nYou have enabled: ${optionsList}\n\nDisable ${enabledOptions.length === 1 ? "this option" : "these options"} in Display Options to increase rate limit to 60/minute for faster loading.`;
  }

  override getSections(): FormSectionElement[] {
    // Build display options with dynamic date examples
    const displayOptionValues = [
      "hide_read_letter",
      "show_lang_tip",
      "show_lang_desc",
      "show_page_count",
      "abbreviate_favorites",
      "show_favorite_count",
      "subtitle_date",
      "subtitle_relative",
      "desc_show_date",
      "desc_relative_date",
      "parodies_bottom",
      "show_id",
      "show_tags_in_desc",
      "show_related_order",
      "show_tag_counts",
    ] as DisplayOptionId[];

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
        DATE_SEPARATOR_OPTIONS.find((s) => s.id === this.dateSeparator)?.char ??
        ".";
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
        SelectRow("language", {
          title:
            this.languageSetting.includes("all") ||
            this.languageSetting.length !== 1
              ? "Preferred Languages"
              : "Preferred Language",
          subtitle: "Applied To Home And Search Results",
          value: this.languageSetting,
          options: LANGUAGE_OPTIONS.map((option) => ({
            id: option.id,
            title: option.label,
          })),
          minItemCount: 1,
          maxItemCount: LANGUAGE_OPTIONS.length,
          onValueChange: Application.Selector(
            this as SettingsForm,
            "updateLanguage",
          ),
        }),
      ]),
      // Thumbnail and Display Options section
      Section("displaySettingsNav", [
        // Display Options first
        SelectRow("displayOptions", {
          title: "Display Options",
          subtitle: "Customize Subtitles and Descriptions",
          value: this.displayOptions,
          options: displayOptionValues.map((id) => ({
            id,
            title: getDisplayOptionLabel(
              id,
              this.dateFormat,
              this.dateSeparator,
              this.removeSpaces,
            ),
          })),
          minItemCount: 0,
          maxItemCount: displayOptionValues.length,
          onValueChange: Application.Selector(
            this as SettingsForm,
            "updateDisplayOptions",
          ),
        }),
        // Thumbnail Quality moved here under display options
        SelectRow("thumbnailQuality", {
          title: "Thumbnail Quality",
          value: [this.thumbnailQuality],
          options: THUMBNAIL_QUALITY_OPTIONS.map((opt) => ({
            id: opt.id,
            title: opt.label,
          })),
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as SettingsForm,
            "updateThumbnailQuality",
          ),
        }),
        // Remove Spaces setting
        ToggleRow("removeSpaces", {
          title: "Remove Spaces From Separators",
          value: this.removeSpaces,
          onValueChange: Application.Selector(
            this as SettingsForm,
            "updateRemoveSpaces",
          ),
        }),
      ]),
      // Statistics section
      Section("statistics", [
        NavigationRow("mangaFiltersNav", {
          title: "Manga Filters",
          subtitle: "Applied To Home And Search Results",
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
        SelectRow("dateFormat", {
          title: "Date Format",
          value: [this.dateFormat],
          options: getDateFormatOptionsWithSeparator(this.dateSeparator).map(
            (opt) => ({
              id: opt.id,
              title: opt.label,
            }),
          ),
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as SettingsForm,
            "updateDateFormat",
          ),
        }),
        SelectRow("dateSeparator", {
          title: "Date Separator",
          value: [this.dateSeparator],
          options: getDateSeparatorOptionsWithFormat(this.dateFormat).map(
            (opt) => ({
              id: opt.id,
              title: opt.label,
            }),
          ),
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as SettingsForm,
            "updateDateSeparator",
          ),
        }),
      ]),
      // Reset section
      Section("reset", [
        ButtonRow("reset", {
          title: "Reset to Defaults",
          onSelect: Application.Selector(this as SettingsForm, "handleReset"),
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
      // Check if this is an OR group (contains || or OR)
      if (/\s*\|\|\s*|\s+OR\s+/i.test(t)) {
        // Split by OR but preserve the OR syntax
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
  private daysOldFilter = getDaysOldFilterSetting();
  private favoritesThreshold = getFavoritesThresholdSetting();
  private favoritesThresholdMax = getFavoritesThresholdMaxSetting();
  private strictFavorites = getStrictFavoritesFilterSetting();
  private incognito = getIncognitoModeSetting();
  private hideRead = getHideReadSetting();
  private enableRelated = getEnableRelatedSetting();
  private relatedLanguage = getRelatedLanguageSetting();
  private hideReadInRelated = getHideReadInRelatedSetting();
  private markReadOnView = getMarkReadOnViewSetting();

  override getSections(): FormSectionElement[] {
    const markReadOnViewEnabled = this.hideRead && !this.incognito;

    return [
      // Section 1: Tags and filters
      Section("filtersSection", [
        InputRow("includeTags", {
          title: "Included Tags (e.g. yuri, anal OR maid)",
          value: stripTagPrefix(this.includeTags),
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateIncludeTags",
          ),
        }),
        InputRow("excludeTags", {
          title: "Excluded Tags (e.g. netorare, bbw)",
          value: stripTagPrefix(this.excludeTags),
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateExcludeTags",
          ),
        }),
        InputRow("pagesFilter", {
          title: "Page Count (e.g. 20-50, >30, 100+, 69<)",
          value: this.pagesExpr,
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updatePagesExpr",
          ),
        }),
        InputRow("favoritesFilter", {
          title: "Favorites (e.g. >500, 1000+, 69<)",
          value: this.formatFavoritesThreshold(),
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateFavoritesThreshold",
          ),
        }),
        ...(this.favoritesThreshold !== undefined
          ? [
              ToggleRow("strictFavorites", {
                title: "Strict Client-side Favorites Filtering",
                subtitle: "Lowers Rate Limits. Not Recommended.",
                value: this.strictFavorites,
                onValueChange: Application.Selector(
                  this as MangaFiltersForm,
                  "updateStrictFavorites",
                ),
              }),
            ]
          : []),
        InputRow("daysOldFilter", {
          title: "Date Added (e.g. 7+, <7d, 1w-3y, 14-)",
          value: this.formatDaysOldFilter(),
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateDaysOldFilter",
          ),
        }),
      ]),
      // Section 2: Behavior toggles — single section, reordered
      Section("behaviorSection", [
        ToggleRow("filterRelatedByLanguage", {
          title: "Related Preferred Language",
          subtitle: "Only Show Related Entries Matching the Preferred Language (Slower)",
          value: this.relatedLanguage !== "all",
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateRelatedLanguage",
          ),
        }),
        ToggleRow("pauseHideRead", {
          title: "Pause Manga Tracking",
          subtitle: "App Continues Tracking",
          value: this.incognito,
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateIncognito",
          ),
        }),
        ToggleRow("hideReadInRelated", {
          title: "Hide Read Manga in Related",
          value: this.hideReadInRelated,
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateHideReadInRelated",
          ),
        }),
        ToggleRow("hideRead", {
          title: "Hide Read Manga",
          subtitle: "Applies To Search And Discover",
          value: this.hideRead,
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateHideRead",
          ),
        }),
        ...(markReadOnViewEnabled
          ? [
              ToggleRow("markReadOnView", {
                title: "Mark As Read On Description",
                value: this.markReadOnView,
                onValueChange: Application.Selector(
                  this as MangaFiltersForm,
                  "updateMarkReadOnView",
                ),
              }),
            ]
          : []),
      ]),
    ];
  }

  async updateIncludeTags(value: string): Promise<void> {
    // Store the raw value - backend will handle tag: prefix formatting
    this.includeTags = value ?? "";
    setIncludeTagsSetting(value ?? "");
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateExcludeTags(value: string): Promise<void> {
    // Store the raw value - backend will handle -tag: prefix formatting
    this.excludeTags = value ?? "";
    setExcludeTagsSetting(value ?? "");
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updatePagesExpr(value: string): Promise<void> {
    this.pagesExpr = sanitizePagesExpressionInput(value ?? "");
    setPagesExpressionSetting(this.pagesExpr);
    this.pagesExpr = getPagesExpressionSetting();
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateHideRead(value: boolean): Promise<void> {
    this.hideRead = !!value;
    setHideReadSetting(this.hideRead);
    if (!this.hideRead && this.markReadOnView) {
      this.markReadOnView = false;
      setMarkReadOnViewSetting(false);
    }
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateEnableRelated(value: boolean): Promise<void> {
    this.enableRelated = !!value;
    setEnableRelatedSetting(this.enableRelated);
    if (!this.enableRelated && this.hideReadInRelated) {
      this.hideReadInRelated = false;
      setHideReadInRelatedSetting(false);
    }
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
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
      try {
        Application.invalidateSearchFilters();
      } catch {
        /* ignore */
      }
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
      try {
        Application.invalidateSearchFilters();
      } catch {
        /* ignore */
      }
      return;
    }

    // Support: >500, >=500, 500+, 500> (postfix), 69< (postfix greater-than)
    // All treated as "favorites >= threshold"
    const gtMatch = trimmed.match(/^>=?(\d+)$|^(\d+)\+$|^(\d+)[><]$/);
    if (gtMatch) {
      const n = Number(gtMatch[1] || gtMatch[2] || gtMatch[3]);
      this.favoritesThreshold = Number.isNaN(n) ? undefined : n;
      this.favoritesThresholdMax = undefined;
      setFavoritesThresholdSetting(this.favoritesThreshold);
      setFavoritesThresholdMaxSetting(undefined);
      try {
        Application.invalidateSearchFilters();
      } catch {
        /* ignore */
      }
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
      try {
        Application.invalidateSearchFilters();
      } catch {
        /* ignore */
      }
    }
  }

  async updateStrictFavorites(value: boolean): Promise<void> {
    this.strictFavorites = !!value;
    setStrictFavoritesFilterSetting(this.strictFavorites);
  }

  async updateDaysOldFilter(value: string): Promise<void> {
    const parsed = this.parseDaysOldFilter(value);
    this.daysOldFilter = parsed;
    setDaysOldFilterSetting(parsed);
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateIncognito(value: boolean): Promise<void> {
    this.incognito = !!value;
    setIncognitoModeSetting(this.incognito);
    if (this.incognito && this.markReadOnView) {
      this.markReadOnView = false;
      setMarkReadOnViewSetting(false);
    }
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateMarkReadOnView(value: boolean): Promise<void> {
    this.markReadOnView = !!value;
    setMarkReadOnViewSetting(this.markReadOnView);
  }

  private formatFavoritesThreshold(): string {
    if (this.favoritesThreshold === undefined) return "";
    if (this.favoritesThresholdMax !== undefined) {
      return `${this.favoritesThreshold}-${this.favoritesThresholdMax}`;
    }
    return `>${this.favoritesThreshold}`;
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
      new RegExp(`^(${numPat})\\s*\\+$|^>(${numPat})$`),
    );
    if (olderMatch)
      return { oldest: this.parseDaysValue(olderMatch[1] || olderMatch[2]) };

    // Postfix >: 5000> means older than 5000 days
    const postfixOlderMatch = trimmed.match(new RegExp(`^(${numPat})\\s*>$`));
    if (postfixOlderMatch)
      return { oldest: this.parseDaysValue(postfixOlderMatch[1]) };

    // Prefix: <7d means less than 7 days old (newer)
    const newerMatch = trimmed.match(
      new RegExp(`^(${numPat})\\s*-$|^<(${numPat})$`),
    );
    if (newerMatch)
      return { newest: this.parseDaysValue(newerMatch[1] || newerMatch[2]) };

    // Postfix <: 5000< means newer than 5000 days
    const postfixNewerMatch = trimmed.match(new RegExp(`^(${numPat})\\s*<$`));
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
    for (const def of ALL_DISCOVER_SECTIONS) {
      (this as any)[`moveUp_${def.id}`] = async () => {
        this.moveSection(def.id, -1);
      };
      (this as any)[`moveDown_${def.id}`] = async () => {
        this.moveSection(def.id, 1);
      };
      (this as any)[`toggle_${def.id}`] = async (value: boolean) => {
        if (value) {
          this.hidden.delete(def.id);
        } else {
          this.hidden.add(def.id);
        }
        setHiddenSections(this.hidden);
        this.reloadForm();
      };
    }
  }

  private moveSection(sectionId: string, direction: number) {
    const idx = this.order.indexOf(sectionId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= this.order.length) return;
    [this.order[idx], this.order[newIdx]] = [
      this.order[newIdx],
      this.order[idx],
    ];
    setDiscoverSectionOrder(this.order);
    this.reloadForm();
  }

  override getSections(): FormSectionElement[] {
    const sectionMap = new Map<string, DiscoverSectionDef>(
      ALL_DISCOVER_SECTIONS.map((s) => [s.id, s]),
    );

    // Visibility toggles - prefix with "Show", only show subtitles for specific sections
    const toggleRows = this.order
      .map((id) => {
        const def = sectionMap.get(id);
        if (!def) return null;
        return ToggleRow(`vis_${id}`, {
          title: `Show ${def.title}`,
          subtitle: def.subtitle,
          value: !this.hidden.has(id),
          onValueChange: Application.Selector(
            this as DiscoverOrderForm,
            `toggle_${id}` as any,
          ),
        });
      })
      .filter((r): r is NonNullable<typeof r> => r != null);

    // Order rows with move buttons
    const orderRows: any[] = [];
    for (let i = 0; i < this.order.length; i++) {
      const id = this.order[i];
      const def = sectionMap.get(id);
      if (!def) continue;
      const hiddenMark = this.hidden.has(id) ? " (hidden)" : "";
      orderRows.push(
        LabelRow(`order_${id}`, {
          title: `${i + 1}. ${def.title}${hiddenMark}`,
        }),
      );
      if (i > 0) {
        orderRows.push(
          ButtonRow(`up_${id}`, {
            title: "↑ Move Up",
            onSelect: Application.Selector(
              this as DiscoverOrderForm,
              `moveUp_${id}` as any,
            ),
          }),
        );
      }
      if (i < this.order.length - 1) {
        orderRows.push(
          ButtonRow(`down_${id}`, {
            title: "↓ Move Down",
            onSelect: Application.Selector(
              this as DiscoverOrderForm,
              `moveDown_${id}` as any,
            ),
          }),
        );
      }
    }

    // Build current visible order as arrow-separated footer
    const visibleOrderFooter =
      this.order
        .filter((id) => !this.hidden.has(id))
        .map((id) => sectionMap.get(id)?.title)
        .filter(Boolean)
        .join(" -> ") || "No visible sections";

    return [
      Section("header", [
        LabelRow("topLabel", {
          title: "Home & Search Sections",
          subtitle: "Disable unused sections for faster loading.",
        }),
      ]),
      Section({ id: "visibility", footer: visibleOrderFooter }, [
        ...toggleRows,
      ]),
      Section("ordering", [...orderRows]),
      Section("resetOrder", [
        ButtonRow("resetOrderBtn", {
          title: "Reset to Default Order",
          onSelect: Application.Selector(
            this as DiscoverOrderForm,
            "handleReset",
          ),
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
