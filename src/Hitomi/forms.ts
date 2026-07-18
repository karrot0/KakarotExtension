/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */
import {
  ButtonRow,
  EditSection,
  Form,
  FormConfirmationError,
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
  DEFAULT_SECTION_ORDER,
  DiscoverSectionDef,
  DisplayOptionId,
  getDateFormatOptionsWithSeparator,
  getDateFormatSetting,
  getDateSeparatorSetting,
  getDiscoverCarouselTilesSetting,
  getDiscoverPageTilesSetting,
  getDiscoverSectionOrder,
  getDisplayOptionsSetting,
  getEnableRelatedSetting,
  getExcludeTagsSetting,
  getFuzzySearchTagsSetting,
  getHiddenSections,
  getHideReadInRelatedSetting,
  getHideReadSetting,
  getIncludeTagsSetting,
  getIncognitoModeSetting,
  getLanguageSetting,
  getMarkReadOnViewSetting,
  getOnlyFuzzyUnknownTagsSetting,
  getPagesExpressionSetting,
  getPreferredImageFormatSetting,
  getRemoveSeparatorSpacesSetting,
  getScreenTimeEnabledSetting,
  getSearchPageTilesSetting,
  getThumbnailQualitySetting,
  LANGUAGE_OPTIONS,
  PREFERRED_IMAGE_FORMAT_OPTIONS,
  resetHitomiSettings,
  sanitizePagesExpressionInput,
  setDateFormatSetting,
  setDateSeparatorSetting,
  setDiscoverCarouselTilesSetting,
  setDiscoverPageTilesSetting,
  setDiscoverSectionOrder,
  setDisplayOptionsSetting,
  setEnableRelatedSetting,
  setExcludeTagsSetting,
  setFuzzySearchTagsSetting,
  setHiddenSections,
  setHideReadInRelatedSetting,
  setHideReadSetting,
  setIncludeTagsSetting,
  setIncognitoModeSetting,
  setLanguageSetting,
  setMarkReadOnViewSetting,
  setOnlyFuzzyUnknownTagsSetting,
  setPagesExpressionSetting,
  setPreferredImageFormatSetting,
  setRemoveSeparatorSpacesSetting,
  setSearchPageTilesSetting,
  setThumbnailQualitySetting,
} from "./settings";
import { StatisticsForm } from "./statistics";

function getDateExampleFor(dateFormatId: string, separator: string): string {
  const now = new Date();
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const m = (now.getMonth() + 1).toString();
  const dd = now.getDate().toString().padStart(2, "0");
  const d = now.getDate().toString();
  const yyyy = now.getFullYear().toString();
  const yy = yyyy.slice(-2);

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

// Get dynamic separator options using current date format
export function getDateSeparatorOptionsWithFormat(
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

const DISPLAY_OPTION_IDS: DisplayOptionId[] = [
  "hide_read_letter",
  "show_lang_tip",
  "show_page_count",
  "subtitle_date",
  "subtitle_relative",
  "desc_show_date",
  "desc_relative_date",
  "parodies_bottom",
  "show_tags_in_desc",
  "show_tag_counts",
  "show_tags_alpha",
  "abbreviate_tag_counts",
  "show_manga_id_in_description",
  "show_related_order",
  "show_reread_count",
];
function getSelectedOptionTitle(
  options: { id: string; label?: string; title?: string }[],
  selectedId: string,
): string {
  const option = options.find((entry) => entry.id === selectedId);
  return option?.label ?? option?.title ?? selectedId;
}

function _getLanguageSummary(values: string[]): string {
  if (values.includes("all")) return "All Languages";
  return values
    .map((id) => getSelectedOptionTitle(LANGUAGE_OPTIONS, id))
    .join(", ");
}

function _getDateFormatDisplayValue(
  dateFormat: string,
  dateSeparator: string,
): string {
  const sep =
    DATE_SEPARATOR_OPTIONS.find((s) => s.id === dateSeparator)?.char ?? ".";
  return getDateExampleFor(dateFormat, sep);
}

function _getDateSeparatorDisplayValue(dateSeparator: string): string {
  const option = DATE_SEPARATOR_OPTIONS.find(
    (entry) => entry.id === dateSeparator,
  );
  return option ? `${option.id} (${option.char})` : dateSeparator;
}

class _HitomiLanguageSettingsForm extends Form {
  private languageSetting = getLanguageSetting();

  async updateLanguage(value: string[]): Promise<void> {
    const selected =
      Array.isArray(value) && value.length > 0 ? value : this.languageSetting;
    this.languageSetting = selected as typeof this.languageSetting;
    setLanguageSetting(this.languageSetting);
    this.reloadForm();
  }

  override getSections(): FormSectionElement<unknown>[] {
    return [
      Section("language", [
        SelectRow("language", {
          title: "Preferred Language",
          layout: "list",
          value: this.languageSetting,
          options: LANGUAGE_OPTIONS.map((option) => ({
            id: option.id,
            title: option.label,
          })),
          minItemCount: 1,
          maxItemCount: LANGUAGE_OPTIONS.length,
          onValueChange: Application.Selector(this as any, "updateLanguage"), // eslint-disable-line @typescript-eslint/no-explicit-any
        }),
      ]),
    ];
  }
}

class _HitomiImageFormatSettingsForm extends Form {
  private preferredImageFormat = getPreferredImageFormatSetting();

  async updatePreferredImageFormat(value: string[]): Promise<void> {
    const selected =
      (value?.[0] as "webp" | "avif") ?? this.preferredImageFormat;
    this.preferredImageFormat = selected;
    setPreferredImageFormatSetting(selected);
    this.reloadForm();
  }

  override getSections(): FormSectionElement<unknown>[] {
    return [
      Section("imageFormat", [
        SelectRow("preferredImageFormat", {
          title: "Image Format",
          layout: "list",
          value: [this.preferredImageFormat],
          options: PREFERRED_IMAGE_FORMAT_OPTIONS.map((option) => ({
            id: option.id,
            title: option.label,
          })),
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as any,
            "updatePreferredImageFormat",
          ),
        }),
      ]),
    ];
  }
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
  const relativeExample = "9d"; // Example: 9 days ago

  // Format separators based on removeSpaces setting - trailing pipe only
  const langEx = removeSpaces ? '("EN|")' : '("EN | ")';
  const pageEx = removeSpaces ? '("67p|")' : '("67p | ")';
  const dateEx = removeSpaces ? `("${dateExample}|")` : `("${dateExample} | ")`;
  const relEx = removeSpaces
    ? `("${relativeExample}|")`
    : `("${relativeExample} | ")`;

  const labels: Record<DisplayOptionId, string> = {
    hide_read: "Hide Read Manga",
    hide_read_letter: "Show Read Indicator 'r'",
    show_lang_tip: `Show Language in Subtitle ${langEx}`,
    show_page_count: `Show Page Count ${pageEx}`,
    subtitle_date: `Show Date in Subtitle ${dateEx}`,
    subtitle_relative: `Show Relative Date in Subtitle ${relEx}`,
    desc_show_date: `Show Date in Description ${dateEx}`,
    desc_relative_date: `Show Relative Date in Description ${relEx}`,
    parodies_bottom: "Show Characters in Description",
    show_tags_in_desc: "Show Tags in Description",
    show_related_order: "Show Related Count and Order",
    show_manga_id_in_description: "Show Manga ID in Description",
    show_tag_counts: "Show Tag Counts in Search Filters",
    abbreviate_tag_counts: 'Show Tag Count Abbreviations ("11k")',
    show_reread_count: "Show Reread Count",
    show_tags_alpha: "Show Tags Alphabetically in Search",
  };
  return labels[id] || id;
}

export class HitomiSettingsForm extends Form {
  private languageSetting = getLanguageSetting();
  private dateFormat = getDateFormatSetting();
  private dateSeparator = getDateSeparatorSetting();
  private displayOptions = getDisplayOptionsSetting();
  private thumbnailQuality = getThumbnailQualitySetting();
  private preferredImageFormat = getPreferredImageFormatSetting();
  private removeSpaces = getRemoveSeparatorSpacesSetting();
  private _mangaFiltersForm?: MangaFiltersForm;
  private _statisticsForm?: StatisticsForm;

  private getMangaFiltersForm(): MangaFiltersForm {
    if (!this._mangaFiltersForm)
      this._mangaFiltersForm = new MangaFiltersForm();
    return this._mangaFiltersForm;
  }

  private getStatisticsForm(): StatisticsForm {
    if (!this._statisticsForm) this._statisticsForm = new StatisticsForm();
    return this._statisticsForm;
  }

  override getSections(): FormSectionElement<unknown>[] {
    // Build display options with dynamic date examples

    // Build subtitle example based on current display options
    const sep = this.removeSpaces ? "|" : " | ";
    const parts: string[] = [];
    if (this.displayOptions.includes("show_lang_tip")) parts.push("EN");
    if (this.displayOptions.includes("show_page_count")) parts.push("67p");
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
      // Main settings section
      Section("hitomiMain", [
        LabelRow("topLabel", {
          title: "Hitomi Settings",
          subtitle: `Subtitle Preview: ${subtitleExample}`,
        }),
        SelectRow("languageNav", {
          title:
            this.languageSetting.length === 1 &&
              this.languageSetting[0] !== "all"
              ? "Preferred Language"
              : "Preferred Languages",
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
        SelectRow("preferredImageFormatNav", {
          title: "Image Format",
          layout: "list",
          value: [this.preferredImageFormat],
          options: PREFERRED_IMAGE_FORMAT_OPTIONS.map((opt) => ({
            id: opt.id,
            title: opt.label,
          })),
          onValueChange: Application.Selector(
            this as any,
            "updatePreferredImageFormat",
          ),
          minItemCount: 1,
          maxItemCount: 1,
        }),
        ToggleRow("highQualityThumbnails", {
          title: "High Quality Thumbnails",
          value: this.thumbnailQuality === "high",
          onValueChange: Application.Selector(
            this as any,
            "updateHighQualityThumbnails",
          ),
        }),
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
          form: this.getMangaFiltersForm(),
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
          form: this.getStatisticsForm(),
        }),
      ]),
      // Date and Format Settings section
      Section(
        {
          id: "dateSettings",
          footer:
            'Known App Limitation:\n\nCrashes occur due to memory issues. Enabling "Downsample Pages" in the reader may help.',
        },
        [
          SelectRow("dateFormatNav", {
            title: "Date Format",
            layout: "list",
            value: [this.dateFormat],
            options: getDateFormatOptionsWithSeparator(this.dateSeparator).map(
              (opt) => ({
                id: opt.id,
                title: opt.label,
              }),
            ),
            onValueChange: Application.Selector(
              this as any,
              "updateDateFormat",
            ),
            minItemCount: 1,
            maxItemCount: 1,
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
        ],
      ),
      // Reset section
      Section("reset", [
        ButtonRow("resetSettings", {
          title: "Reset Settings",
          onSelect: Application.Selector(this as any, "confirmReset"),
        }),
      ]),
    ];
  }

  async updateLanguage(value: string[]) {
    const selected =
      Array.isArray(value) && value.length > 0 ? value : this.languageSetting;
    this.languageSetting = selected as typeof this.languageSetting;
    setLanguageSetting(this.languageSetting);
  }

  async updateHighQualityThumbnails(value: boolean) {
    this.thumbnailQuality = value ? "high" : "low";
    setThumbnailQualitySetting(this.thumbnailQuality);
  }

  async updatePreferredImageFormat(value: string[]) {
    const selected =
      (value?.[0] as "webp" | "avif") ?? this.preferredImageFormat;
    this.preferredImageFormat = selected;
    setPreferredImageFormatSetting(selected);
    this.reloadForm();
  }

  async updateRemoveSpaces(value: boolean) {
    this.removeSpaces = !!value;
    setRemoveSeparatorSpacesSetting(this.removeSpaces);
    this.reloadForm();
  }

  async updateDateFormat(value: string[]) {
    const rawSelected = value?.[0];
    const selected = rawSelected !== undefined ? rawSelected : this.dateFormat;
    this.dateFormat = selected;
    setDateFormatSetting(selected);
    this.reloadForm();
  }

  async updateDateSeparator(value: string[]) {
    const selected =
      (value?.[0] as typeof this.dateSeparator) ?? this.dateSeparator;
    this.dateSeparator = selected;
    setDateSeparatorSetting(selected);
    this.reloadForm();
  }

  async updateDisplayOptions(value: string[]) {
    this.displayOptions = value as typeof this.displayOptions;
    setDisplayOptionsSetting(this.displayOptions);
    this.reloadForm();
  }

  async confirmReset(): Promise<void> {
    throw new FormConfirmationError(
      Application.Selector(this as any, "handleReset"),
      "Reset Hitomi settings to their defaults?",
    );
  }

  async handleReset(): Promise<void> {
    resetHitomiSettings();
    this.languageSetting = getLanguageSetting();
    this.dateFormat = getDateFormatSetting();
    this.dateSeparator = getDateSeparatorSetting();
    this.displayOptions = getDisplayOptionsSetting();
    this.thumbnailQuality = getThumbnailQualitySetting();
    this.preferredImageFormat = getPreferredImageFormatSetting();
    this.removeSpaces = getRemoveSeparatorSpacesSetting();
    this.reloadForm();
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

    return [
      EditSection("visibleOrdering", {
        id: "visibleOrdering",
        header: "VISIBLE ORDERING",
        footer: "Drag to reorder. Swipe to hide.",
        items: visibleRows,
        allowReorder: true,
        allowDeletion: true,
        onReorder: Application.Selector(this as any, "rowDidReorderVisible"),
        onDeletion: Application.Selector(this as any, "rowDidDeleteVisible"),
      }),
      EditSection("hiddenSections", {
        id: "hiddenSections",
        header: "HIDDEN SECTIONS",
        items: hiddenRows,
        allowReorder: true,
        allowDeletion: true,
        onReorder: Application.Selector(this as any, "rowDidReorderHidden"),
        onDeletion: Application.Selector(this as any, "rowDidDeleteHidden"),
      }),
      Section("resetOrder", [
        ButtonRow("resetOrderBtn", {
          title: "Reset to Default Order",
          onSelect: Application.Selector(this as any, "confirmReset"),
        }),
      ]),
    ];
  }

  async confirmReset(): Promise<void> {
    throw new FormConfirmationError(
      Application.Selector(this as any, "handleReset"),
      "Reset the Hitomi section order and visibility settings?",
    );
  }

  async handleReset(): Promise<void> {
    this.order = [...DEFAULT_SECTION_ORDER];
    this.hidden = new Set();
    setDiscoverSectionOrder(this.order);
    setHiddenSections(this.hidden);
    this.reloadForm();
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
            if (clean.startsWith("-")) clean = clean.slice(1);
            const prefixMatch = clean.match(
              /^(?:tag|female|male|artist|group|series|character|language):(.+)$/i,
            );
            if (prefixMatch) {
              clean = prefixMatch[1];
            }
            if (clean.startsWith('"') && clean.endsWith('"')) {
              clean = clean.slice(1, -1);
            }
            return clean;
          })
          .filter(Boolean);
        return orParts.join(" OR ");
      } else {
        let clean = t.startsWith("-") ? t.slice(1) : t;
        const prefixMatch = clean.match(
          /^(?:tag|female|male|artist|group|series|character|language):(.+)$/i,
        );
        if (prefixMatch) {
          clean = prefixMatch[1];
        }
        if (clean.startsWith('"') && clean.endsWith('"')) {
          clean = clean.slice(1, -1);
        }
        return clean;
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
  private incognito = getIncognitoModeSetting();
  private hideRead = getHideReadSetting();
  private enableRelated = getEnableRelatedSetting();
  private hideReadInRelated = getHideReadInRelatedSetting();
  private markReadOnView = getMarkReadOnViewSetting();
  private fuzzySearchTags = getFuzzySearchTagsSetting();
  private onlyFuzzyUnknown = getOnlyFuzzyUnknownTagsSetting();

  private normalizeStepperValue(
    value: unknown,
    min: number,
    max: number,
    fallback: number,
  ): number {
    const normalized =
      Array.isArray(value) && value.length > 0 ? (value[0] as unknown) : value;
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
    return [
      Section("tileLayoutSection", [
        StepperRow("discoverCarouselTiles", {
          title: "Tiles on Carousel",
          value: this.discoverCarouselTiles,
          minValue: 1,
          maxValue: 16,
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
          maxValue: 48,
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
          maxValue: 48,
          stepValue: 1,
          loopOver: false,
          onValueChange: Application.Selector(
            this as any,
            "updateSearchPageTiles",
          ),
        }),
      ]),
      // Section 1: Tags, filters, and fuzzy toggle
      Section("filtersSection", [
        ToggleRow("fuzzySearchTags", {
          title: "Always Force Fuzzy Search",
          subtitle: this.fuzzySearchTags
            ? "Use 'uf!' for exact tag searches (e.g., 'uf!sole female, ana')."
            : "Use 'f!' for fuzzy searches (e.g., 'f!ana' matches 'anal birth', 'mana', 'anal').",
          value: this.fuzzySearchTags,
          onValueChange: Application.Selector(
            this as any,
            "updateFuzzySearchTags",
          ),
        }),
        ...(!this.fuzzySearchTags
          ? [
            ToggleRow("onlyFuzzyUnknown", {
              title: "Fuzzy Search Unknown Tags",
              subtitle: "Always Fuzzy Nonexistent Tags",
              value: this.onlyFuzzyUnknown,
              onValueChange: Application.Selector(
                this as any,
                "updateOnlyFuzzyUnknown",
              ),
            }),
          ]
          : []),
        InputRow("includeTags", {
          title: this.fuzzySearchTags
            ? "Included Tags (e.g. elf OR uf!oil)"
            : "Included Tags (e.g. elf, nun OR orc)",
          value: stripTagPrefix(this.includeTags),
          onValueChange: Application.Selector(this as any, "updateIncludeTags"),
        }),
        InputRow("excludeTags", {
          title: this.fuzzySearchTags
            ? "Excluded Tags (e.g. scat, uf!anal)"
            : "Excluded Tags (e.g. scat, f!oil)",
          value: stripTagPrefix(this.excludeTags),
          onValueChange: Application.Selector(this as any, "updateExcludeTags"),
        }),
        InputRow("pagesFilter", {
          title: "Page Count (e.g. 20-50, >21, <67, 69<)",
          value: this.pagesExpr,
          onValueChange: Application.Selector(this as any, "updatePagesExpr"),
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

  async updateIncludeTags(value: string) {
    // Store the raw value - backend will handle tag validation
    setIncludeTagsSetting(value ?? "");
    this.includeTags = getIncludeTagsSetting();
    this.reloadForm();
    try {
      (
        globalThis as { __hitomiClearSearchCaches?: () => void }
      ).__hitomiClearSearchCaches?.();
    } catch {
      /* ignore */
    }
  }

  async updateExcludeTags(value: string) {
    // Store the raw value - backend will handle tag validation
    setExcludeTagsSetting(value ?? "");
    this.excludeTags = getExcludeTagsSetting();
    this.reloadForm();
    try {
      (
        globalThis as { __hitomiClearSearchCaches?: () => void }
      ).__hitomiClearSearchCaches?.();
    } catch {
      /* ignore */
    }
  }

  async updatePagesExpr(value: string) {
    this.pagesExpr = sanitizePagesExpressionInput(value ?? "");
    setPagesExpressionSetting(this.pagesExpr);
    this.pagesExpr = getPagesExpressionSetting();
    this.reloadForm();
  }

  async updateDiscoverCarouselTiles(value: unknown): Promise<void> {
    this.discoverCarouselTiles = this.normalizeStepperValue(
      value,
      1,
      16,
      this.discoverCarouselTiles,
    );
    setDiscoverCarouselTilesSetting(this.discoverCarouselTiles);
    this.reloadForm();
  }

  async updateDiscoverPageTiles(value: unknown): Promise<void> {
    this.discoverPageTiles = this.normalizeStepperValue(
      value,
      1,
      48,
      this.discoverPageTiles,
    );
    setDiscoverPageTilesSetting(this.discoverPageTiles);
    this.reloadForm();
  }

  async updateSearchPageTiles(value: unknown): Promise<void> {
    this.searchPageTiles = this.normalizeStepperValue(
      value,
      1,
      48,
      this.searchPageTiles,
    );
    setSearchPageTilesSetting(this.searchPageTiles);
    this.reloadForm();
  }

  async updateIncognito(value: boolean) {
    this.incognito = !!value;
    setIncognitoModeSetting(this.incognito);
    if (this.incognito && this.markReadOnView) {
      this.markReadOnView = false;
      setMarkReadOnViewSetting(false);
    }
    this.reloadForm();
  }

  async updateHideRead(value: boolean) {
    this.hideRead = !!value;
    setHideReadSetting(this.hideRead);
    this.reloadForm();
  }

  async updateEnableRelated(value: boolean) {
    this.enableRelated = !!value;
    setEnableRelatedSetting(this.enableRelated);
    if (!this.enableRelated && this.hideReadInRelated) {
      this.hideReadInRelated = false;
      setHideReadInRelatedSetting(false);
    }
    this.reloadForm();
  }

  async updateHideReadInRelated(value: boolean) {
    this.hideReadInRelated = !!value;
    setHideReadInRelatedSetting(this.hideReadInRelated);
  }

  async updateMarkReadOnView(value: boolean) {
    this.markReadOnView = !!value;
    setMarkReadOnViewSetting(this.markReadOnView);
  }

  async updateFuzzySearchTags(value: boolean) {
    this.fuzzySearchTags = !!value;
    setFuzzySearchTagsSetting(this.fuzzySearchTags);
    this.reloadForm();
  }

  async updateOnlyFuzzyUnknown(value: boolean) {
    this.onlyFuzzyUnknown = !!value;
    setOnlyFuzzyUnknownTagsSetting(this.onlyFuzzyUnknown);
    this.reloadForm();
  }
}
