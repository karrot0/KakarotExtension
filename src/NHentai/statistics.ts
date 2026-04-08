import {
  ButtonRow,
  Form,
  FormSectionElement,
  LabelRow,
  NavigationRow,
  Section,
  SelectRow,
} from "@paperback/types";
import {
  ensureInstallDate,
  getAveragePageCount,
  getDataReceived,
  getDisplayedMangaCount,
  getDistinctDisplayedMangaCount,
  getPageCounts,
  getReadingSessions,
  getRereadDisplayLimit,
  getRereadDisplaySteps,
  getScreenTimeLastNDays,
  getScreenTimeLastNWeeks,
  getScreenTimeEnabledSetting,
  getScreenTimeMode,
  getStatsInstallDate,
  getStreakGraceDays,
  getTagCounts,
  getTagDisplayLimit,
  getTagDisplaySteps,
  getTotalMangaRead,
  getRereadStats,
  getMarkReadOnDescCount,
  ReadingSession,
  resetAllStatistics,
  resetSpecificStats,
  removeSpecificTags,
  removeSpecificRereads,
  setRereadDisplayLimit,
  setScreenTimeEnabledSetting,
  setScreenTimeMode,
  setStreakGraceDays,
  setTagDisplayLimit,
  STAT_CATEGORIES,
  getAllRereadManga,
  getDateFormatSetting,
  getDateSeparatorSetting,
  formatDateByPattern,
  DATE_SEPARATOR_OPTIONS,
} from "./settings";

// -- Helper Functions --

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return formatDateByPattern(d, getDateFormatSetting(), getDateSeparatorSetting());
}

/** Format a date for screen time display, ensuring the day is always visible.
 *  For formats without DD/D (e.g. mm_yy), inserts the day appropriately. */
function formatScreenTimeDate(date: Date): string {
  const fmt = getDateFormatSetting();
  const sepId = getDateSeparatorSetting();
  const sep = DATE_SEPARATOR_OPTIONS.find(s => s.id === sepId)?.char ?? ".";
  // Formats that already include a day component
  const hasDayFormats = ["mm_dd_yy", "m_d_yy", "yyyy_mm_dd", "dd_mm_yyyy"];
  if (hasDayFormats.includes(fmt)) {
    return formatDateByPattern(date, fmt, sepId);
  }
  // Insert day into formats that lack it
  const dd = date.getDate().toString();
  const base = formatDateByPattern(date, fmt, sepId);
  // mm_yy / m_yy → DD first: "DD sep base"
  // yy_mm / yy_m → DD last: "base sep DD"
  if (fmt === "mm_yy" || fmt === "m_yy") return `${dd}${sep}${base}`;
  if (fmt === "yy_mm" || fmt === "yy_m") return `${base}${sep}${dd}`;
  return base;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatPercentChange(current: number, previous: number): string {
  if (previous <= 0) return "N/A";
  const delta = ((current - previous) / previous) * 100;
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "";
  return `${arrow} ${Math.abs(delta).toFixed(0)}%`;
}

function formatMinutesHuman(minutes: number): string {
  if (minutes < 1) return "0min";
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0 && mins > 0) return `${hrs}hr ${mins}min`;
  if (hrs > 0) return `${hrs}hr`;
  return `${mins}min`;
}

function safeMinutes(val: unknown): number {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
}

/** Build a YYYY-MM-DD key from a Date using LOCAL time (not UTC). */
function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse a YYYY-MM-DD key back to a Date at local midnight (not UTC). */
function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getStreak(sessions: ReadingSession[], graceDays: number = 0): {
  current: number;
  longest: number;
  longestStart: string;
  longestEnd: string;
  currentStart: string;
  currentEnd: string;
} {
  if (sessions.length === 0)
    return { current: 0, longest: 0, longestStart: "", longestEnd: "", currentStart: "", currentEnd: "" };

  const dateSet = new Set(sessions.map((s) => s.date));

  // Current streak: walk backwards from today, allowing up to graceDays consecutive misses
  let current = 0;
  const today = new Date();
  let checkDate = new Date(today);
  let missedConsecutive = 0;
  let currentEnd = "";
  let currentStart = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const key = toLocalDateKey(checkDate);
    if (dateSet.has(key)) {
      current++;
      if (!currentEnd) currentEnd = key;
      currentStart = key;
      missedConsecutive = 0;
    } else {
      missedConsecutive++;
      if (missedConsecutive > graceDays) break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  if (current === 0) {
    checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - 1);
    missedConsecutive = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const key = toLocalDateKey(checkDate);
      if (dateSet.has(key)) {
        current++;
        if (!currentEnd) currentEnd = key;
        currentStart = key;
        missedConsecutive = 0;
      } else {
        missedConsecutive++;
        if (missedConsecutive > graceDays) break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  // Longest streak: same gap tolerance
  const sortedDates = Array.from(dateSet).sort();
  let streak = 1;
  let longest = sortedDates.length > 0 ? 1 : 0;
  let streakStart = sortedDates[0] ?? "";
  let longestStart = streakStart;
  let longestEnd = streakStart;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = parseLocalDateKey(sortedDates[i - 1]);
    const curr = parseLocalDateKey(sortedDates[i]);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays <= 1 + graceDays) {
      streak++;
      if (streak > longest) {
        longest = streak;
        longestStart = streakStart;
        longestEnd = sortedDates[i];
      }
    } else {
      streak = 1;
      streakStart = sortedDates[i];
    }
  }

  return { current, longest, longestStart, longestEnd, currentStart, currentEnd };
}

// -- Statistics (main form) --

export class StatisticsForm extends Form {
  private resetStep = 0;

  override getSections(): FormSectionElement[] {
    ensureInstallDate();
    const installDate = getStatsInstallDate();
    const displayed = getDisplayedMangaCount();
    const distinctDisplayed = getDistinctDisplayedMangaCount();
    const totalRead = getTotalMangaRead();
    const rereadStats = getRereadStats();
    const sessions = getReadingSessions();
    const earliestSessionDate =
      sessions.length > 0
        ? sessions
            .map((s) => s.date)
            .filter((d): d is string => typeof d === "string" && d.length > 0)
            .sort()[0]
        : undefined;
    const effectiveInstallDate = earliestSessionDate
      ? !installDate || earliestSessionDate < installDate
        ? earliestSessionDate
        : installDate
      : installDate;
    const graceDays = getStreakGraceDays();
    const streakInfo = getStreak(sessions, graceDays);
    const rawStreak = getStreak(sessions, 0);
    const totalViews = sessions.reduce((sum, s) => sum + s.count, 0);
    const dataReceived = getDataReceived();

    const daysActive = effectiveInstallDate
      ? Math.max(
          1,
          Math.floor(
            (Date.now() - new Date(effectiveInstallDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 1;
    const avgPerDay = (totalViews / daysActive).toFixed(1);
    const markOnDescCount = getMarkReadOnDescCount();
    const totalWithoutMarkOnDesc = Math.max(0, totalRead - markOnDescCount);
    const avgWithoutMarkOnDesc = (Math.max(0, totalViews - markOnDescCount) / daysActive).toFixed(1);

    const sinceStr = effectiveInstallDate ? formatDate(effectiveInstallDate) : "Unknown";

    const currentStreakTitle = `Current Streak: ${streakInfo.current} day${streakInfo.current !== 1 ? "s" : ""}`;
    const currentStreakSubtitle =
      streakInfo.current > 0 && streakInfo.currentStart
        ? `${formatDate(streakInfo.currentStart)} - ${formatDate(streakInfo.currentEnd)}`
        : undefined;

    const longestStreakTitle =
      `Longest Streak: ${streakInfo.longest} day${streakInfo.longest !== 1 ? "s" : ""}`;
    const longestStreakSubtitle =
      streakInfo.longest > 0 && streakInfo.longestStart
        ? `${formatDate(streakInfo.longestStart)} - ${formatDate(streakInfo.longestEnd)}`
        : undefined;

    return [
      Section("overview", [
        LabelRow("headerLabel", {
          title: `Tracking Since: ${sinceStr}`,
        }),
        LabelRow("totalDisplayed", {
          title: `Manga Displayed: ${formatNumber(displayed)}`,
        }),
        LabelRow("distinctDisplayed", {
          title: `Distinct Manga Displayed: ${formatNumber(distinctDisplayed)}`,
        }),
        LabelRow("totalRead", {
          title: `Total Manga Read: ${formatNumber(totalRead)}`,
          subtitle: Math.abs(totalRead - totalWithoutMarkOnDesc) > 2
            ? `w/o Mark as Read on Description: ${formatNumber(totalWithoutMarkOnDesc)}`
            : undefined,
        }),
        LabelRow("totalReread", {
          title: `Total Manga Reread: ${formatNumber(rereadStats.totalMangaReread)}`,
        }),
        LabelRow("totalRereadTimes", {
          title: `Total Times You Reread: ${formatNumber(rereadStats.totalRereads)}`,
        }),
        LabelRow("avgPerDay", {
          title: `Average Manga Read Per Day: ${avgPerDay}`,
          subtitle: Math.abs(parseFloat(avgPerDay) - parseFloat(avgWithoutMarkOnDesc)) >= 0.2
            ? `w/o Mark as Read on Description: ${avgWithoutMarkOnDesc}`
            : undefined,
        }),
        LabelRow("currentStreak", {
          title: currentStreakTitle,
          subtitle: currentStreakSubtitle,
        }),
        LabelRow("longestStreak", {
          title: longestStreakTitle,
          subtitle: longestStreakSubtitle,
        }),
        LabelRow("dataReceived", {
          title: `Data Received: ${formatBytes(dataReceived)}`,
        }),
      ]),
      // Only show Save Streak when streak is broken and grace not maxed
      ...(rawStreak.current === 0 && graceDays < 2 ? [
        Section({ id: "streak", footer: "Save Your Streak By Adding A Grace Period. Each Tap Adds 1 Day (Max 2)." }, [
          ButtonRow("saveStreak", {
            title: `Save Streak (+1 Day Grace)`,
            onSelect: Application.Selector(this as StatisticsForm, "handleSaveStreak"),
          }),
        ]),
      ] : []),
      Section({ id: "details", footer: "Bug Reports? Feedback? Suggestions? Feel Free to Reach Out! @pisshammy on Discord." }, [
        NavigationRow("contentStats", {
          title: "Content Stats",
          form: new ContentStatsForm(),
        }),
        ...(getScreenTimeEnabledSetting() ? [
          NavigationRow("screenTime", {
            title: "Screen Time",
            form: new ScreenTimeForm(),
          }),
        ] : []),
      ]),
      Section("reset", [
        NavigationRow("removeSpecificStats", {
          title: "Remove Specific Stats",
          form: new RemoveSpecificStatsForm(),
        }),
        ...(this.resetStep === 0
          ? [
              ButtonRow("resetStats", {
                title: "Reset All Statistics",
                onSelect: Application.Selector(this as StatisticsForm, "handleReset"),
              }),
            ]
          : this.resetStep === 1
            ? [
                ButtonRow("areYouSure", {
                  title: "Are You Sure?",
                  onSelect: Application.Selector(this as StatisticsForm, "handleConfirmStep"),
                }),
                ButtonRow("cancelReset", {
                  title: "Cancel",
                  onSelect: Application.Selector(this as StatisticsForm, "handleCancelReset"),
                }),
              ]
            : [
                ButtonRow("finalResetStats", {
                  title: "FINAL CLICK TO RESET ALL STATS",
                  onSelect: Application.Selector(this as StatisticsForm, "handleConfirmReset"),
                }),
                ButtonRow("cancelResetFinal", {
                  title: "Cancel",
                  onSelect: Application.Selector(this as StatisticsForm, "handleCancelReset"),
                }),
              ]),
      ]),
    ];
  }

  async handleReset() {
    this.resetStep = 1;
    this.reloadForm();
  }

  async handleConfirmStep() {
    this.resetStep = 2;
    this.reloadForm();
  }

  async handleCancelReset() {
    this.resetStep = 0;
    this.reloadForm();
  }

  async handleConfirmReset() {
    resetAllStatistics();
    this.resetStep = 0;
    this.reloadForm();
  }

  async handleSaveStreak() {
    const current = getStreakGraceDays();
    if (current >= 2) return;
    setStreakGraceDays(current + 1);
    this.reloadForm();
  }
}

// -- Remove Specific Stats --

class RemoveSpecificStatsForm extends Form {
  private selectedCategories: string[] = [];
  private selectedTags: string[] = [];
  private selectedRereads: string[] = [];
  private confirmingReset = false;

  // Memoized per-render to avoid recomputing streak/sessions per category row
  private _sessions: ReturnType<typeof getReadingSessions> | null = null;
  private _streak: ReturnType<typeof getStreak> | null = null;

  private ensureCache(): void {
    if (!this._sessions) {
      this._sessions = getReadingSessions();
      this._streak = getStreak(this._sessions, getStreakGraceDays());
    }
  }

  private getCategoryDisplayTitle(category: { id: string; title: string }): string {
    this.ensureCache();
    const sessions = this._sessions!;
    const streak = this._streak!;

    switch (category.id) {
      case "tracking_since": {
        const date = getStatsInstallDate();
        return date ? `${category.title}: ${formatDate(date)}` : category.title;
      }
      case "manga_displayed":
        return `${category.title}: ${formatNumber(getDisplayedMangaCount())}`;
      case "distinct_displayed":
        return `${category.title}: ${formatNumber(getDistinctDisplayedMangaCount())}`;
      case "total_read":
        return `${category.title}: ${formatNumber(getTotalMangaRead())}`;
      case "total_reread":
        return `${category.title}: ${formatNumber(getRereadStats().totalMangaReread)}`;
      case "avg_per_day": {
        const installDate = getStatsInstallDate();
        const totalViews = sessions.reduce((sum, s) => sum + s.count, 0);
        const daysActive = installDate
          ? Math.max(1, Math.floor((Date.now() - new Date(installDate).getTime()) / (1000 * 60 * 60 * 24)))
          : 1;
        return `${category.title}: ${(totalViews / daysActive).toFixed(1)}`;
      }
      case "current_streak":
        return `${category.title}: ${streak.current} day${streak.current !== 1 ? "s" : ""}`;
      case "longest_streak":
        return `${category.title}: ${streak.longest} day${streak.longest !== 1 ? "s" : ""}`;
      case "data_received":
        return `${category.title}: ${formatBytes(getDataReceived())}`;
      case "page_distribution":
        return category.title;
      case "tag_counts":
        return `${category.title}: ${formatNumber(Object.keys(getTagCounts()).length)} Tags`;
      case "top_rereads":
        return `${category.title}: ${formatNumber(getAllRereadManga().length)} Manga`;
      case "screen_time":
        return category.title;
      default:
        return category.title;
    }
  }

  override getSections(): FormSectionElement[] {
    // Invalidate memoized cache so it recomputes once this render cycle
    this._sessions = null;
    this._streak = null;

    const rawTagCounts = getTagCounts();
    // Strip prefixes and merge for display, same as ContentStatsForm
    const mergedTagCounts: Record<string, number> = {};
    for (const [tag, count] of Object.entries(rawTagCounts)) {
      const clean = tag.replace(/^(?:female|male|tag):/i, "");
      mergedTagCounts[clean] = (mergedTagCounts[clean] ?? 0) + count;
    }
    const sortedTags = Object.entries(mergedTagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 75);
    const tagTotal = sortedTags.reduce((sum, [, c]) => sum + c, 0);

    const rereadManga = getAllRereadManga();
    const rereadStats = getRereadStats();

    return [
      // Show double-confirm warning at top when first confirm was clicked
      ...(this.confirmingReset ? [
        Section("doubleConfirm", [
          ButtonRow("areYouSure", {
            title: "ARE YOU VERY SURE?",
            onSelect: Application.Selector(
              this as RemoveSpecificStatsForm,
              "handleFinalConfirm",
            ),
          }),
        ]),
      ] : []),
      Section({ id: "select"}, [
        SelectRow("categories", {
          title: "Categories",
          value: this.selectedCategories,
          options: STAT_CATEGORIES.map((c) => ({ id: c.id, title: this.getCategoryDisplayTitle(c) })),
          onValueChange: Application.Selector(
            this as RemoveSpecificStatsForm,
            "handleCategoryChange",
          ),
          minItemCount: 0,
          maxItemCount: STAT_CATEGORIES.length,
        }),
      ]),
      Section({ id: "specificTags", footer: "Remove Specific Tags From Your Tag Stats." }, [
        SelectRow("removeTags", {
          title: "Top Tags",
          value: this.selectedTags,
          options: sortedTags.map(([tag, count], i) => {
            const pct = tagTotal > 0 ? Math.round((count / tagTotal) * 100) : 0;
            return { id: tag.replace(/ /g, "_"), title: `${i + 1}.) ${tag}: ${count} entries (${pct}%)` };
          }),
          onValueChange: Application.Selector(
            this as RemoveSpecificStatsForm,
            "handleTagChange",
          ),
          minItemCount: 0,
          maxItemCount: Math.max(1, sortedTags.length),
        }),
      ]),
      Section({ id: "specificRereads", footer: "Remove Specific Manga From Your Reread Stats." }, [
        SelectRow("removeRereads", {
          title: "Top Reread",
          value: this.selectedRereads,
          options: rereadStats.top.slice(0, 75).map((entry, idx) => {
            const rawTags = entry.tags && entry.tags.length > 0 ? entry.tags.slice(0, 10) : [];
            const seen = new Set<string>();
            const cleanedTags: string[] = [];
            for (const t of rawTags) {
              const clean = t.replace(/^(?:female|male|tag):/i, "");
              if (!seen.has(clean)) { seen.add(clean); cleanedTags.push(clean); }
            }
            const tagStr = cleanedTags.join(", ");
            const subtitle = tagStr
              ? `${entry.count} reads | ID: ${entry.mangaId} | ${tagStr}`
              : `${entry.count} reads | ID: ${entry.mangaId}`;
            return {
              id: entry.mangaId,
              title: `${idx + 1}.) ${entry.title ?? entry.mangaId} — ${subtitle}`,
            };
          }),
          onValueChange: Application.Selector(
            this as RemoveSpecificStatsForm,
            "handleRereadChange",
          ),
          minItemCount: 0,
          maxItemCount: Math.max(1, rereadManga.length),
        }),
      ]),
      Section("confirm", [
        ButtonRow("confirmReset", {
          title: "Confirm?",
          onSelect: Application.Selector(
            this as RemoveSpecificStatsForm,
            "handleConfirmReset",
          ),
        }),
      ]),
    ];
  }

  async handleCategoryChange(value: string[]) {
    this.selectedCategories = value;
  }

  async handleTagChange(value: string[]) {
    this.selectedTags = value;
  }

  async handleRereadChange(value: string[]) {
    this.selectedRereads = value;
  }

  async handleConfirmReset() {
    if (this.selectedCategories.length === 0 && this.selectedTags.length === 0 && this.selectedRereads.length === 0) return;
    this.confirmingReset = true;
    this.reloadForm();
  }

  async handleFinalConfirm() {
    if (this.selectedCategories.length > 0) {
      resetSpecificStats(this.selectedCategories);
    }
    if (this.selectedTags.length > 0) {
      removeSpecificTags(this.selectedTags.map(id => id.replace(/_/g, " ")));
    }
    if (this.selectedRereads.length > 0) {
      removeSpecificRereads(this.selectedRereads);
    }
    this.selectedCategories = [];
    this.selectedTags = [];
    this.selectedRereads = [];
    this.confirmingReset = false;
    this.reloadForm();
  }
}

// -- Content Stats (Reading Patterns + Rereads + Tags with Show More/Less) --

class ContentStatsForm extends Form {
  override getSections(): FormSectionElement[] {
    // -- Reading Patterns --
    const pageCounts = getPageCounts();
    const avgPageCount = getAveragePageCount();
    const buckets = ["1-20", "21-50", "51-100", "101-200", "200+"];
    const totalPages = Object.values(pageCounts).reduce(
      (a, b) => a + Number(b ?? 0),
      0,
    );

    const pageRows = buckets.map((bucket) => {
      const count = Number(pageCounts[bucket] ?? 0);
      const pct = totalPages > 0 ? Math.round((count / totalPages) * 100) : 0;
      const barLen = Math.round(pct / 5);
      const bar = barLen > 0 ? " " + "\u2588".repeat(barLen) : "";
      return LabelRow(`pages_${bucket}`, {
        title: `${bucket} Pages`,
        subtitle: `${count} (${pct}%)${bar}`,
      });
    });

    // -- Reread Stats --
    const rereadStats = getRereadStats();
    const rereadLimit = getRereadDisplayLimit();
    const rereadSteps = getRereadDisplaySteps();
    const displayedRereads = rereadStats.top.slice(0, rereadLimit);
    const rereadRows: any[] = displayedRereads.map((entry, idx) => {
      const rawTags = entry.tags && entry.tags.length > 0 ? entry.tags.slice(0, 10) : [];
      // Strip male:/female:/tag: prefixes and deduplicate
      const seen = new Set<string>();
      const cleanedTags: string[] = [];
      for (const t of rawTags) {
        const clean = t.replace(/^(?:female|male|tag):/i, "");
        if (!seen.has(clean)) { seen.add(clean); cleanedTags.push(clean); }
      }
      const tagStr = cleanedTags.join(", ");
      const subtitle = tagStr
        ? `${entry.count} reads | ID: ${entry.mangaId} | ${tagStr}`
        : `${entry.count} reads | ID: ${entry.mangaId}`;
      return LabelRow(`reread_${entry.mangaId}`, {
        title: `${idx + 1}.) ${entry.title ?? "Manga"}`,
        subtitle,
      });
    });

    if (rereadRows.length === 0) {
      rereadRows.push(
        LabelRow("noRereads", {
          title: "No reread data yet",
          subtitle: "Revisit manga to populate this list",
        }),
      );
    }

    const rereadCurrentIdx = rereadSteps.indexOf(rereadLimit);
    const totalRereads = rereadStats.top.length;
    const rereadButtons: any[] = [];
    // Show More only if there are actually more items beyond the current limit
    if (rereadCurrentIdx > 0 && totalRereads > rereadLimit) {
      rereadButtons.push(
        ButtonRow("showMoreRereads", {
          title: "Show More",
          onSelect: Application.Selector(this as ContentStatsForm, "handleShowMoreRereads"),
        }),
      );
    }
    // Show Less only when currently displaying 2+ items
    if (rereadCurrentIdx < rereadSteps.length - 1 && rereadLimit > 1) {
      rereadButtons.push(
        ButtonRow("showLessRereads", {
          title: "Show Less",
          onSelect: Application.Selector(this as ContentStatsForm, "handleShowLessRereads"),
        }),
      );
    }

    // -- Tag Stats --
    const rawTagCounts = getTagCounts();
    const limit = getTagDisplayLimit();
    const steps = getTagDisplaySteps();

    // Strip male:/female:/tag: prefixes and merge duplicate counts
    const mergedTagCounts: Record<string, number> = {};
    for (const [tag, count] of Object.entries(rawTagCounts)) {
      const clean = tag.replace(/^(?:female|male|tag):/i, "");
      mergedTagCounts[clean] = (mergedTagCounts[clean] ?? 0) + count;
    }

    const sorted = Object.entries(mergedTagCounts)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .slice(0, 75);

    const displayed = sorted.slice(0, limit);
    const displayedTotal = displayed.reduce((sum, [, c]) => sum + c, 0);

    const tagRows: any[] = displayed.map(([tag, count], i) => {
      const pct = displayedTotal > 0 ? Math.round((count / displayedTotal) * 100) : 0;
      return LabelRow(`tag_${i}`, {
        title: `${i + 1}.) ${tag}: ${count} entries (${pct}%)`,
      });
    });

    if (tagRows.length === 0) {
      tagRows.push(
        LabelRow("noTags", {
          title: "No tag data yet",
          subtitle: "Browse some manga to start collecting stats",
        }),
      );
    }

    const currentIdx = steps.indexOf(limit);
    const totalTags = sorted.length;
    const tagButtons: any[] = [];
    // Show More only if there are actually more tags beyond the current limit
    if (currentIdx > 0 && totalTags > limit) {
      tagButtons.push(
        ButtonRow("showMore", {
          title: "Show More",
          onSelect: Application.Selector(this as ContentStatsForm, "handleShowMore"),
        }),
      );
    }
    // Show Less only when currently displaying 2+ items
    if (currentIdx < steps.length - 1 && limit > 1) {
      tagButtons.push(
        ButtonRow("showLess", {
          title: "Show Less",
          onSelect: Application.Selector(this as ContentStatsForm, "handleShowLess"),
        }),
      );
    }

    return [
      Section("pageDistribution", [
        LabelRow("pageHeader", { title: "Page Count Distribution", subtitle: `Average: ~${avgPageCount} pages` }),
        ...pageRows,
      ]),
      Section("topTags", [
        LabelRow("tagHeader", { title: `Top ${Math.min(limit, totalTags)} Tags` }),
        ...tagRows,
        ...tagButtons,
      ]),
      Section("topRereads", [
        LabelRow("rereadHeader", { title: `Top ${Math.min(rereadLimit, totalRereads)} Reread Manga` }),
        ...rereadRows,
        ...rereadButtons,
      ]),
      ...(!getScreenTimeEnabledSetting() ? [
        Section("enableScreenTime", [
          ButtonRow("enableScreenTimeBtn", {
            title: "Enable Screen Time",
            onSelect: Application.Selector(this as ContentStatsForm, "handleEnableScreenTime"),
          }),
        ]),
      ] : []),
    ];
  }

  async handleShowMore() {
    const limit = getTagDisplayLimit();
    const steps = getTagDisplaySteps();
    const currentIdx = steps.indexOf(limit);
    // Must be a valid index > 0 to move to a higher count (lower index)
    if (currentIdx > 0) {
      setTagDisplayLimit(steps[currentIdx - 1]);
      this.reloadForm();
    }
  }

  async handleShowLess() {
    const limit = getTagDisplayLimit();
    const steps = getTagDisplaySteps();
    const currentIdx = steps.indexOf(limit);
    // Must be a valid index (>= 0) and not at the end to move to a lower count (higher index)
    if (currentIdx >= 0 && currentIdx < steps.length - 1) {
      setTagDisplayLimit(steps[currentIdx + 1]);
      this.reloadForm();
    }
  }

  async handleShowMoreRereads() {
    const limit = getRereadDisplayLimit();
    const steps = getRereadDisplaySteps();
    const currentIdx = steps.indexOf(limit);
    // Must be a valid index > 0 to move to a higher count (lower index)
    if (currentIdx > 0) {
      setRereadDisplayLimit(steps[currentIdx - 1]);
      this.reloadForm();
    }
  }

  async handleShowLessRereads() {
    const limit = getRereadDisplayLimit();
    const steps = getRereadDisplaySteps();
    const currentIdx = steps.indexOf(limit);
    // Must be a valid index (>= 0) and not at the end to move to a lower count (higher index)
    if (currentIdx >= 0 && currentIdx < steps.length - 1) {
      setRereadDisplayLimit(steps[currentIdx + 1]);
      this.reloadForm();
    }
  }

  async handleEnableScreenTime() {
    setScreenTimeEnabledSetting(true);
    this.reloadForm();
  }
}

// -- Screen Time Sub-Form --

class ScreenTimeForm extends Form {
  private mode: "week" | "day";
  private weekOffset: number = 0;
  private confirmingDisable = false;

  constructor() {
    super();
    this.mode = getScreenTimeMode();
  }

  async handleSetWeek() {
    this.mode = "week";
    this.weekOffset = 0;
    setScreenTimeMode("week");
    this.reloadForm();
  }

  async handleSetDay() {
    this.mode = "day";
    this.weekOffset = 0;
    setScreenTimeMode("day");
    this.reloadForm();
  }

  async handlePreviousWeek() {
    // Cap at the number of non-zero weeks (max 7)
    const weeks = getScreenTimeLastNWeeks(7);
    const nonZeroCount = weeks.filter((w) => safeMinutes(w.minutes) > 0).length;
    const maxOffset = Math.max(0, nonZeroCount - 1);
    if (this.weekOffset < maxOffset) {
      this.weekOffset++;
      this.reloadForm();
    }
  }

  async handleNextWeek() {
    if (this.weekOffset > 0) {
      this.weekOffset--;
      this.reloadForm();
    }
  }

  async handleDisableScreenTime() {
    this.confirmingDisable = true;
    this.reloadForm();
  }

  async handleConfirmDisable() {
    this.confirmingDisable = false;
    setScreenTimeEnabledSetting(false);
    this.reloadForm();
  }

  async handleCancelDisable() {
    this.confirmingDisable = false;
    this.reloadForm();
  }

  private renderDaily(): FormSectionElement[] {
    const daily = getScreenTimeLastNDays(7, this.weekOffset);
    const weekTotal = daily.reduce((sum, d) => sum + safeMinutes(d.minutes), 0);
    const weekAvg = weekTotal / 7;

    // Compare current week's avg/day to previous week's avg/day
    const prevDaily = getScreenTimeLastNDays(7, this.weekOffset + 1);
    const prevWeekTotal = prevDaily.reduce((sum, d) => sum + safeMinutes(d.minutes), 0);
    const prevWeekAvg = prevWeekTotal / 7;

    // Sort days Sunday first (0) to Saturday (6)
    const sorted = [...daily].sort((a, b) => {
      const [yA, mA, dA] = a.date.split("-").map(Number);
      const [yB, mB, dB] = b.date.split("-").map(Number);
      const dayA = new Date(yA, mA - 1, dA).getDay();
      const dayB = new Date(yB, mB - 1, dB).getDay();
      return dayA - dayB;
    });

    const maxMinutes = Math.max(...sorted.map((d) => safeMinutes(d.minutes)), 1);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const rows = sorted.map((d) => {
      const mins = safeMinutes(d.minutes);
      // Parse as local date to avoid UTC offset jumbling weekdays
      const [yyyy, mm, dd] = d.date.split("-").map(Number);
      const date = new Date(yyyy, mm - 1, dd);
      const shortDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
      const dateLabel = formatScreenTimeDate(date);
      // Compare using local YYYY-MM-DD strings to avoid UTC offset issues
      const dLocalStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const isToday = dLocalStr === todayStr;
      const dayLabel = isToday ? `Today of ${dateLabel}` : `${shortDay} of ${dateLabel}`;
      const pct = Math.round((mins / maxMinutes) * 20);
      const bar = "\u2588".repeat(Math.max(1, pct));
      return LabelRow(`day_${d.date}`, {
        title: `${dayLabel}: ${mins.toFixed(0)} min`,
        subtitle: bar,
      });
    });

    // Determine if Previous button should be hidden (at farthest offset)
    const weeks = getScreenTimeLastNWeeks(7);
    const nonZeroCount = weeks.filter((w) => safeMinutes(w.minutes) > 0).length;
    const maxOffset = Math.max(0, nonZeroCount - 1);
    const atFarthest = this.weekOffset >= maxOffset;

    const weekNav: any[] = [];
    if (this.weekOffset > 0) {
      weekNav.push(
        ButtonRow("nextWeek", {
          title: "Next Week \u2192",
          onSelect: Application.Selector(this as ScreenTimeForm, "handleNextWeek"),
        }),
      );
    }
    if (!atFarthest) {
      weekNav.push(
        ButtonRow("prevWeek", {
          title: "\u2190 Previous Week",
          onSelect: Application.Selector(this as ScreenTimeForm, "handlePreviousWeek"),
        }),
      );
    }

    return [
      Section("dailySummary", [
        LabelRow("dailyAvg", {
          title: `Avg/Day: ${formatMinutesHuman(weekAvg)} (${formatPercentChange(weekAvg, prevWeekAvg)} from last week)`,
        }),
        ...rows,
      ]),
      Section("weekNav", weekNav),
    ];
  }

  private renderWeekly(): FormSectionElement[] {
    const weeks = getScreenTimeLastNWeeks(7);
    // Filter out weeks with zero minutes (pre-installation)
    const nonZeroWeeks = weeks.filter((w) => safeMinutes(w.minutes) > 0);
    if (nonZeroWeeks.length === 0) {
      return [
        Section("weeklySummary", [
          LabelRow("noWeeklyData", {
            title: "No Screen Time Data Yet",
          }),
        ]),
      ];
    }
    const current = safeMinutes(nonZeroWeeks[nonZeroWeeks.length - 1]?.minutes);
    const prev = nonZeroWeeks.length > 1 ? safeMinutes(nonZeroWeeks[nonZeroWeeks.length - 2].minutes) : 0;
    const maxMinutes = Math.max(...nonZeroWeeks.map((w) => safeMinutes(w.minutes)), 1);
    const rows = nonZeroWeeks.map((w, idx) => {
      const mins = safeMinutes(w.minutes);
      const start = new Date(w.weekStart);
      const label = formatScreenTimeDate(start);
      const pct = Math.round((mins / maxMinutes) * 20);
      const bar = "\u2588".repeat(Math.max(1, pct));
      return LabelRow(`week_${idx}`, {
        title: `Week of ${label}: ${mins.toFixed(0)} min`,
        subtitle: bar,
      });
    });

    return [
      Section("weeklySummary", [
        LabelRow("weeklyAvg", {
          title: `Avg/Week: ${formatMinutesHuman(current)} (${formatPercentChange(current, prev)} from last week)`,
        }),
        ...rows,
      ]),
    ];
  }

  override getSections(): FormSectionElement[] {
    const toggle = Section("toggle", [
      ButtonRow("modeToggle", {
        title: this.mode === "week" ? "Switch to Days" : "Switch to Weeks",
        onSelect: Application.Selector(this as ScreenTimeForm, this.mode === "week" ? "handleSetDay" : "handleSetWeek"),
      }),
    ]);

    const body = this.mode === "week" ? this.renderWeekly() : this.renderDaily();
    const disableSection = this.confirmingDisable
      ? Section("disableScreenTime", [
          ButtonRow("confirmDisableBtn", {
            title: "Confirm Disable Screen Time",
            onSelect: Application.Selector(this as ScreenTimeForm, "handleConfirmDisable"),
          }),
          ButtonRow("cancelDisableBtn", {
            title: "Cancel",
            onSelect: Application.Selector(this as ScreenTimeForm, "handleCancelDisable"),
          }),
        ])
      : Section("disableScreenTime", [
          ButtonRow("disableScreenTimeBtn", {
            title: "Disable Screen Time",
            onSelect: Application.Selector(this as ScreenTimeForm, "handleDisableScreenTime"),
          }),
        ]);
    return [toggle, ...body, disableSection];
  }
}
