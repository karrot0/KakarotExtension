import {
  ButtonRow,
  EditSection,
  Form,
  FormConfirmationError,
  FormSectionElement,
  LabelRow,
  NavigationRow,
  Section,
  SelectRow,
  ToggleRow,
} from "@paperback/types";
import {
  DATE_SEPARATOR_OPTIONS,
  ensureInstallDate,
  formatDateByPattern,
  getAllRereadManga,
  getAveragePageCount,
  getDataReceived,
  getDataReceivedToday,
  getDateFormatSetting,
  getDateSeparatorSetting,
  getDescMarkedReadIds,
  getDisplayedMangaCount,
  getDistinctDisplayedMangaCount,
  getExcludeTagsSetting,
  getPageCounts,
  getReadingSessions,
  getRereadDisplayLimit,
  getRereadStats,
  getScreenTimeEnabledSetting,
  getScreenTimeLastNDays,
  getScreenTimeLastNWeeks,
  getScreenTimeMode,
  getScreenTimeWeekOffset,
  getStatsInstallDate,
  getStatsTrackingEnabledSetting,
  getStreakGraceDays,
  getTagCounts,
  getTagDisplayLimit,
  getTotalMangaRead,
  getTotalScreenTimeMinutes,
  ReadingSession,
  removeSpecificRereads,
  removeSpecificTags,
  resetAllStatistics,
  resetSpecificStats,
  setRereadDisplayLimit,
  setScreenTimeEnabledSetting,
  setScreenTimeMode,
  setScreenTimeWeekOffset,
  setStatsTrackingEnabledSetting,
  setStreakGraceDays,
  setTagDisplayLimit,
  STAT_CATEGORIES,
} from "./settings";

// -- Helper Functions --

function formatStatValue(n: number, useKiloMega = true): string {
  if (useKiloMega) {
    if (n >= 1000000) return `${parseFloat((n / 1000000).toFixed(2))}M`;
    if (n >= 1000) return `${parseFloat((n / 1000).toFixed(2))}K`;
  }
  return parseFloat(n.toFixed(2)).toString();
}

function formatStatValueTwoDecimals(n: number, useKiloMega = true): string {
  if (useKiloMega) {
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
  }
  return n.toFixed(2);
}

function formatNumber(n: number): string {
  return formatStatValue(n);
}

function formatNumberTwoDecimals(n: number): string {
  return formatStatValueTwoDecimals(n);
}

function formatTwoDecimals(n: number): string {
  return formatStatValue(n, false);
}

function formatReadCountTwoDecimals(n: number): string {
  return formatStatValueTwoDecimals(n);
}

function buildDisplaySteps(totalItems: number): number[] {
  const baseSteps = [1, 3, 5, 10, 15, 25, 50, 75];
  if (totalItems <= 75) {
    return baseSteps.filter((step) => step <= totalItems);
  }

  const steps = [...baseSteps];
  let current = 75;
  while (current < totalItems) {
    current = Math.min(totalItems, current + (current >= 200 ? 50 : 25));
    steps.push(current);
  }
  return steps;
}

function normalizeDisplayLimit(totalItems: number, limit: number): number {
  const steps = buildDisplaySteps(totalItems);
  if (steps.length === 0) return 0;
  const effective = Math.min(limit, totalItems);
  if (steps.includes(effective)) return effective;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i] <= effective) return steps[i];
  }
  return steps[0];
}

function moveDisplayLimit(
  totalItems: number,
  limit: number,
  direction: "more" | "less",
): number | undefined {
  const steps = buildDisplaySteps(totalItems);
  const current = normalizeDisplayLimit(totalItems, limit);
  const idx = steps.indexOf(current);
  if (idx < 0) return undefined;
  if (direction === "more") {
    return idx < steps.length - 1 ? steps[idx + 1] : undefined;
  }
  return idx > 0 ? steps[idx - 1] : undefined;
}

/** Parse stored date strings, handling YYYY-MM-DD as local time. */
function parseStoredDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseLocalDateKey(value)
    : new Date(value);
}

function formatDate(isoDate: string): string {
  const d = parseStoredDate(isoDate);
  return formatDateByPattern(
    d,
    getDateFormatSetting(),
    getDateSeparatorSetting(),
  );
}

/** Format a date for screen time display, ensuring the day is always visible.
 *  For formats without DD/D (e.g. mm_yy), inserts the day appropriately. */
function formatScreenTimeDate(date: Date): string {
  const fmt = getDateFormatSetting();
  const sepId = getDateSeparatorSetting();
  const sep = DATE_SEPARATOR_OPTIONS.find((s) => s.id === sepId)?.char ?? ".";
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

function getTodayScreenTimeMinutes(): number {
  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todayEntry = getScreenTimeLastNDays(7, 0).find(
    (entry) => entry.date === key,
  );
  return safeMinutes(todayEntry?.minutes);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824)
    return `${parseFloat((bytes / 1073741824).toFixed(2))} GB`;
  if (bytes >= 1048576) return `${parseFloat((bytes / 1048576).toFixed(2))} MB`;
  if (bytes >= 1024) return `${parseFloat((bytes / 1024).toFixed(2))} KB`;
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

function countDaySpan(startKey: string, endKey: string): number {
  if (!startKey || !endKey) return 0;
  const start = parseLocalDateKey(startKey);
  const end = parseLocalDateKey(endKey);
  const diffDays = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diffDays >= 0 ? diffDays + 1 : 0;
}

function getStreak(
  sessions: ReadingSession[],
  graceDays: number = 0,
): {
  current: number;
  longest: number;
  longestStart: string;
  longestEnd: string;
  currentStart: string;
  currentEnd: string;
} {
  if (sessions.length === 0)
    return {
      current: 0,
      longest: 0,
      longestStart: "",
      longestEnd: "",
      currentStart: "",
      currentEnd: "",
    };

  const dateSet = new Set(
    sessions.map((s) => toLocalDateKey(parseStoredDate(String(s.date)))),
  );

  // Current streak: walk backwards from today, allowing up to graceDays consecutive misses
  let current = 0;
  const today = new Date();
  let checkDate = new Date(today);
  let missedConsecutive = 0;
  let currentEnd = "";
  let currentStart = "";

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

  if (!(current > 0 && currentStart && currentEnd)) {
    current = 0;
    currentStart = "";
    currentEnd = "";
  } else {
    const todayKey = toLocalDateKey(today);
    if (graceDays > 0 && !dateSet.has(todayKey) && currentEnd !== todayKey) {
      const lastRead = parseLocalDateKey(currentEnd);
      const now = parseLocalDateKey(todayKey);
      const gapDays = Math.round(
        (now.getTime() - lastRead.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (gapDays <= graceDays) {
        currentEnd = todayKey;
      }
    }
    current = Math.max(1, countDaySpan(currentStart, currentEnd));
  }

  // Longest streak: same gap tolerance, measured as exclusive day span.
  const sortedDates = Array.from(dateSet).sort();
  let streakStart = sortedDates[0] ?? "";
  let streakEnd = streakStart;
  let longestStart = streakStart;
  let longestEnd = streakStart;
  let longest = streakStart ? 1 : 0;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = parseLocalDateKey(sortedDates[i - 1]);
    const curr = parseLocalDateKey(sortedDates[i]);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays <= 1 + graceDays) {
      streakEnd = sortedDates[i];
    } else {
      streakStart = sortedDates[i];
      streakEnd = sortedDates[i];
    }

    const streakSpan = Math.max(1, countDaySpan(streakStart, streakEnd));
    if (streakSpan > longest) {
      longest = streakSpan;
      longestStart = streakStart;
      longestEnd = streakEnd;
    }
  }

  if (current > longest) {
    longest = current;
    longestStart = currentStart;
    longestEnd = currentEnd;
  }

  return {
    current,
    longest,
    longestStart,
    longestEnd,
    currentStart,
    currentEnd,
  };
}

// -- Statistics (main form) --

export class StatisticsForm extends Form {
  private resetStep = 0;
  private statsTrackingEnabled = getStatsTrackingEnabledSetting();
  private streakSaveDismissed = false;

  override getSections(): FormSectionElement<unknown>[] {
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
    const dataReceived = getDataReceived();
    const dataReceivedToday = getDataReceivedToday();
    const totalScreenTimeMinutes = getTotalScreenTimeMinutes();
    const screenTimeToday = getTodayScreenTimeMinutes();

    const daysActive = effectiveInstallDate
      ? Math.max(
        1,
        Math.floor(
          (Date.now() - parseStoredDate(effectiveInstallDate).getTime()) /
          (1000 * 60 * 60 * 24),
        ),
      )
      : 1;
    const markOnDescCount = getDescMarkedReadIds().size;
    const chapterReadCount = totalRead;
    const totalIncludingMarkOnDesc = chapterReadCount + markOnDescCount;
    const avgPerDay = chapterReadCount / daysActive;
    const totalIncludingMarkOnDescPerDay =
      totalIncludingMarkOnDesc / daysActive;

    const sinceStr = effectiveInstallDate
      ? formatDate(effectiveInstallDate)
      : "Unknown";

    const currentStreakTitle = `Current Streak: ${streakInfo.current} day${streakInfo.current !== 1 ? "s" : ""}`;
    const currentStreakSubtitle =
      streakInfo.current > 0 && streakInfo.currentStart
        ? `${formatDate(streakInfo.currentStart)} - ${formatDate(streakInfo.currentEnd)}`
        : undefined;

    const longestStreakTitle = `Longest Streak: ${streakInfo.longest} day${streakInfo.longest !== 1 ? "s" : ""}`;
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
          title: `Manga Displayed: ${formatReadCountTwoDecimals(displayed)}`,
        }),
        LabelRow("distinctDisplayed", {
          title: `Distinct Manga Displayed: ${formatReadCountTwoDecimals(distinctDisplayed)}`,
        }),
        LabelRow("totalRead", {
          title: `Total Manga Read: ${formatReadCountTwoDecimals(chapterReadCount)}`,
          subtitle: `Including Marked as Read on Description: ${formatReadCountTwoDecimals(totalIncludingMarkOnDesc)}`,
        }),
        LabelRow("totalReread", {
          title: `Total Manga Reread: ${formatNumber(rereadStats.totalMangaReread)}`,
        }),
        LabelRow("totalRereadTimes", {
          title: `Total Times You Reread: ${formatNumber(rereadStats.totalRereads)}`,
        }),
        LabelRow("avgPerDay", {
          title: `Avg Manga Read Per Day: ${formatTwoDecimals(avgPerDay)}`,
          subtitle: `Including Marked as Read on Description: ${formatTwoDecimals(totalIncludingMarkOnDescPerDay)}`,
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
          subtitle: `Data Received Today: ${formatBytes(dataReceivedToday)}`,
        }),
        LabelRow("totalScreenTime", {
          title: `Total Screen Time: ${formatMinutesHuman(totalScreenTimeMinutes)}`,
          subtitle: `Screen Time Today: ${formatMinutesHuman(screenTimeToday)}`,
        }),
      ]),
      ...(rawStreak.current === 0 && graceDays < 5 && !this.streakSaveDismissed
        ? [
          Section({ id: "streak" }, [
            ButtonRow("saveStreak", {
              title: `Save Streak (${graceDays + 1} day${graceDays + 1 !== 1 ? "s" : ""})`,
              onSelect: Application.Selector(this as any, "handleSaveStreak"),
            }),
          ]),
        ]
        : []),
      Section(
        {
          id: "details",
          footer:
            "Visit Inkdex Discord -> #other-repos -> KakarotExtension for Bugs and Suggestions.",
        },
        [
          NavigationRow("contentStats", {
            title: "Content Stats",
            form: new ContentStatsForm(),
          }),
          NavigationRow("screenTime", {
            title: "Screen Time",
            form: new ScreenTimeForm(),
          }),
        ],
      ),
      Section("reset", [
        NavigationRow("removeSpecificStats", {
          title: "Remove Specific Stats",
          form: new RemoveSpecificStatsForm(),
        }),
        ToggleRow("statsTrackingEnabled", {
          title: "Disable All Stat Tracking",
          subtitle: "Stop Tracking Statistics & Screen Time",
          value: !this.statsTrackingEnabled,
          onValueChange: Application.Selector(
            this as any,
            "handleStatsTrackingToggle",
          ),
        }),
        ...(this.resetStep === 0
          ? [
            ButtonRow("resetStats", {
              title: "Reset All Statistics",
              onSelect: Application.Selector(this as any, "handleReset"),
            }),
          ]
          : this.resetStep === 1
            ? [
              ButtonRow("areYouSure", {
                title: "Are You Sure?",
                onSelect: Application.Selector(
                  this as any,
                  "handleConfirmStep",
                ),
              }),
              ButtonRow("cancelReset", {
                title: "Cancel",
                onSelect: Application.Selector(
                  this as any,
                  "handleCancelReset",
                ),
              }),
            ]
            : [
              ButtonRow("finalResetStats", {
                title: "FINAL CLICK TO RESET ALL STATS",
                onSelect: Application.Selector(
                  this as any,
                  "handleConfirmReset",
                ),
              }),
              ButtonRow("cancelResetFinal", {
                title: "Cancel",
                onSelect: Application.Selector(
                  this as any,
                  "handleCancelReset",
                ),
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

  async handleConfirmReset(): Promise<void> {
    throw new FormConfirmationError(
      Application.Selector(this as any, "performReset"),
      "Reset all NHentai statistics?",
    );
  }

  async performReset(): Promise<void> {
    resetAllStatistics();
    this.resetStep = 0;
    this.reloadForm();
  }

  async handleSaveStreak() {
    const current = getStreakGraceDays();
    if (current >= 5) return;
    this.streakSaveDismissed = true;
    setStreakGraceDays(current + 1);
    this.reloadForm();
  }

  async handleStatsTrackingToggle(value: boolean) {
    this.statsTrackingEnabled = !value;
    setStatsTrackingEnabledSetting(this.statsTrackingEnabled);
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

  private getCategoryDisplayTitle(category: {
    id: string;
    title: string;
  }): string {
    this.ensureCache();
    const sessions = this._sessions!;
    const streak = this._streak!;

    switch (category.id) {
      case "tracking_since": {
        const date = getStatsInstallDate();
        return date ? `${category.title}: ${formatDate(date)}` : category.title;
      }
      case "manga_displayed":
        return `${category.title}: ${formatNumberTwoDecimals(getDisplayedMangaCount())}`;
      case "distinct_displayed":
        return `${category.title}: ${formatNumberTwoDecimals(getDistinctDisplayedMangaCount())}`;
      case "total_read":
        return `${category.title}: ${formatNumberTwoDecimals(getTotalMangaRead())}`;
      case "total_reread":
        return `${category.title}: ${formatNumber(getRereadStats().totalMangaReread)}`;
      case "total_times_reread":
        return `${category.title}: ${formatNumber(getRereadStats().totalRereads)}`;
      case "avg_per_day": {
        const installDate = getStatsInstallDate();
        const totalViews = sessions.reduce((sum, s) => sum + s.count, 0);
        const daysActive = installDate
          ? Math.max(
            1,
            Math.floor(
              (Date.now() - new Date(installDate).getTime()) /
              (1000 * 60 * 60 * 24),
            ),
          )
          : 1;
        return `${category.title}: ${formatStatValue(totalViews / daysActive, false)}`;
      }
      case "current_streak":
        return `${category.title}: ${streak.current} day${streak.current !== 1 ? "s" : ""}`;
      case "longest_streak":
        return `${category.title}: ${streak.longest} day${streak.longest !== 1 ? "s" : ""}`;
      case "data_received":
        return `${category.title}: ${formatBytes(getDataReceived())}`;
      case "screen_time":
        return `${category.title}: ${formatMinutesHuman(getTotalScreenTimeMinutes())}`;
      case "screen_time_graphs":
        return category.title;
      case "page_distribution":
        return category.title;
      case "tag_counts":
        return `${category.title}: ${formatNumber(Object.keys(getTagCounts()).length)} Tags`;
      case "top_rereads":
        return `${category.title}: ${formatNumber(getAllRereadManga().length)} Manga`;
      default:
        return category.title;
    }
  }

  override getSections(): FormSectionElement<unknown>[] {
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
    const sortedTags = Object.entries(mergedTagCounts).sort(
      (a, b) => b[1] - a[1],
    );
    const tagTotal = sortedTags.reduce((sum, [, c]) => sum + c, 0);

    const rereadStats = getRereadStats();

    return [
      // Show double-confirm warning at top when first confirm was clicked
      ...(this.confirmingReset
        ? [
          Section("doubleConfirm", [
            ButtonRow("areYouSure", {
              title: "ARE YOU VERY SURE?",
              onSelect: Application.Selector(
                this as any,
                "handleFinalConfirm",
              ),
            }),
          ]),
        ]
        : []),
      Section({ id: "select" }, [
        SelectRow("categories", {
          title: "Categories",
          layout: "list",
          value: this.selectedCategories,
          items: STAT_CATEGORIES.map((c) => ({
            id: c.id,
            title: this.getCategoryDisplayTitle(c),
          })),
          onValueChange: Application.Selector(
            this as any,
            "handleCategoryChange",
          ),
          minItemCount: 0,
          maxItemCount: STAT_CATEGORIES.length,
        }),
      ]),
      Section(
        {
          id: "specificTags",
          footer: "Remove Specific Tags From Your Tag Stats.",
        },
        [
          SelectRow("removeTags", {
            title: "Top Tags",
            layout: "list",
            value: this.selectedTags,
            items: sortedTags.map(([tag, count], i) => {
              const pct = tagTotal > 0 ? (count / tagTotal) * 100 : 0;
              return {
                id: encodeURIComponent(tag),
                title: `${i + 1}.) ${tag}: ${count} entries (${pct.toFixed(2)}%)`,
              };
            }),
            onValueChange: Application.Selector(this as any, "handleTagChange"),
            minItemCount: 0,
            maxItemCount: Math.max(1, sortedTags.length),
          }),
        ],
      ),
      Section(
        {
          id: "specificRereads",
          footer: "Remove Specific Manga From Your Reread Stats.",
        },
        [
          SelectRow("removeRereads", {
            title: "Top Reread",
            layout: "list",
            value: this.selectedRereads,
            items: rereadStats.top.map((entry, idx) => {
              const rawTags =
                entry.tags && entry.tags.length > 0
                  ? entry.tags.slice(0, 10)
                  : [];
              const seen = new Set<string>();
              const cleanedTags: string[] = [];
              for (const t of rawTags) {
                const clean = t.replace(/^(?:female|male|tag):/i, "");
                if (!seen.has(clean)) {
                  seen.add(clean);
                  cleanedTags.push(clean);
                }
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
              this as any,
              "handleRereadChange",
            ),
            minItemCount: 0,
            maxItemCount: Math.max(1, rereadStats.top.length),
          }),
        ],
      ),
      Section("confirm", [
        ButtonRow("confirmReset", {
          title: "Confirm?",
          onSelect: Application.Selector(this as any, "handleConfirmReset"),
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
    if (
      this.selectedCategories.length === 0 &&
      this.selectedTags.length === 0 &&
      this.selectedRereads.length === 0
    )
      return;
    this.confirmingReset = true;
    this.reloadForm();
  }

  async handleFinalConfirm(): Promise<void> {
    throw new FormConfirmationError(
      Application.Selector(this as any, "performFinalConfirm"),
      "Remove the selected NHentai statistics?",
    );
  }

  async performFinalConfirm(): Promise<void> {
    if (this.selectedCategories.length > 0) {
      resetSpecificStats(this.selectedCategories);
    }
    if (this.selectedTags.length > 0) {
      removeSpecificTags(this.selectedTags.map((id) => decodeURIComponent(id)));
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
  private tagDeletionOffset = 0;
  private rereadDeletionOffset = 0;

  override getSections(): FormSectionElement<unknown>[] {
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
    const displayRereadLimit = normalizeDisplayLimit(
      rereadStats.top.length,
      rereadLimit,
    );
    const displayedRereads = rereadStats.top.slice(0, displayRereadLimit);
    const rereadRows = displayedRereads.map((entry, idx) => {
      const rawTags =
        entry.tags && entry.tags.length > 0 ? entry.tags.slice(0, 10) : [];
      // Strip male:/female:/tag: prefixes and deduplicate
      const seen = new Set<string>();
      const cleanedTags: string[] = [];
      for (const t of rawTags) {
        const clean = t.replace(/^(?:female|male|tag):/i, "");
        if (!seen.has(clean)) {
          seen.add(clean);
          cleanedTags.push(clean);
        }
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

    const totalRereads = rereadStats.top.length;
    const effectiveRereadSteps = buildDisplaySteps(totalRereads);
    const rereadCurrentIdx = effectiveRereadSteps.indexOf(displayRereadLimit);
    const rereadButtons: ReturnType<typeof ButtonRow>[] = [];
    // Show More only if there are actually more items beyond the current limit
    if (
      rereadCurrentIdx < effectiveRereadSteps.length - 1 &&
      totalRereads > displayRereadLimit
    ) {
      rereadButtons.push(
        ButtonRow("showMoreRereads", {
          title: "Show More",
          onSelect: Application.Selector(this as any, "handleShowMoreRereads"),
        }),
      );
    }
    // Show Less only when currently displaying 2+ items
    if (rereadCurrentIdx > 0 && displayRereadLimit > 1) {
      rereadButtons.push(
        ButtonRow("showLessRereads", {
          title: "Show Less",
          onSelect: Application.Selector(this as any, "handleShowLessRereads"),
        }),
      );
    }

    // -- Tag Stats --
    const rawTagCounts = getTagCounts();
    const limit = getTagDisplayLimit();

    // Strip male:/female:/tag: prefixes and merge duplicate counts
    const excludeRaw = getExcludeTagsSetting();
    const excludePatterns = excludeRaw
      .split(/[,\n]/)
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length > 0);

    const mergedTagCounts: Record<string, number> = {};
    for (const [tag, count] of Object.entries(rawTagCounts)) {
      const clean = tag.replace(/^(?:female|male|tag):/i, "");
      const lowerClean = clean.toLowerCase();

      if (excludePatterns.some((p) => lowerClean.startsWith(p))) {
        continue;
      }
      mergedTagCounts[clean] = (mergedTagCounts[clean] ?? 0) + count;
    }

    const sorted = Object.entries(mergedTagCounts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });

    const displayLimit = normalizeDisplayLimit(sorted.length, limit);
    const steps = buildDisplaySteps(sorted.length);
    const displayed = sorted.slice(0, displayLimit);
    const displayedTotal = displayed.reduce((sum, [, c]) => sum + c, 0);

    const tagRows = displayed.map(([tag, count], index) => {
      const pct = displayedTotal > 0 ? (count / displayedTotal) * 100 : 0;
      const tagId = `tag_${tag
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "")}`;
      return LabelRow(tagId, {
        title: `${index + 1}.) ${tag}: ${count} entries (${pct.toFixed(2)}%)`,
      });
    });

    const totalTags = sorted.length;
    const currentIdx = steps.indexOf(displayLimit);
    const tagButtons: ReturnType<typeof ButtonRow>[] = [];
    // Show More only if there are actually more tags beyond the current limit
    if (currentIdx < steps.length - 1) {
      tagButtons.push(
        ButtonRow("showMore", {
          title: "Show More",
          onSelect: Application.Selector(this as any, "handleShowMore"),
        }),
      );
    }
    // Show Less only when currently displaying 2+ items
    if (currentIdx > 0) {
      tagButtons.push(
        ButtonRow("showLess", {
          title: "Show Less",
          onSelect: Application.Selector(this as any, "handleShowLess"),
        }),
      );
    }

    const sections: FormSectionElement<unknown>[] = [];

    // Main section for reading patterns
    const pageSectionItems: any[] = [
      LabelRow("avgPageCount", {
        title: "Page Count Distribution",
        subtitle: `Average Page Count: ${formatStatValue(avgPageCount, false)}`,
      }),
      ...pageRows,
    ];
    sections.push(Section("pageDistribution", pageSectionItems));

    // Add Tags to separate section if they exist
    if (totalTags > 0) {
      this.tagDeletionOffset = tagButtons.length;
      sections.push(
        EditSection(`topTags_${displayLimit}_${totalTags}`, {
          id: `topTags_${displayLimit}_${totalTags}`,
          header: displayLimit === 1 ? "Top Tag" : `Top ${displayLimit} Tags`,
          items: [...tagButtons, ...tagRows],
          allowDeletion: true,
          onDeletion: Application.Selector(this as any, "handleDeleteTopTag"),
        }),
      );
    }

    // Add Rereads to separate section if they exist
    if (totalRereads > 0) {
      this.rereadDeletionOffset = rereadButtons.length;
      sections.push(
        EditSection(`topRereads_${displayRereadLimit}_${totalRereads}`, {
          id: `topRereads_${displayRereadLimit}_${totalRereads}`,
          header:
            displayRereadLimit === 1
              ? "Top Reread Manga"
              : `Top ${displayRereadLimit} Reread Manga`,
          footer: "Swipe To Remove.",
          items: [...rereadButtons, ...rereadRows],
          allowDeletion: true,
          onDeletion: Application.Selector(
            this as any,
            "handleDeleteTopReread",
          ),
        }),
      );
    }

    // Fallback if no data
    if (totalRereads === 0 && totalTags === 0 && totalPages === 0) {
      return [
        Section("emptyStats", [
          LabelRow("noData", { title: "No statistics data available yet." }),
        ]),
      ];
    }

    return sections;
  }

  async handleDeleteTopTag(index: number) {
    const limit = getTagDisplayLimit();
    const rawTagCounts = getTagCounts();
    const mergedTagCounts: Record<string, number> = {};

    for (const [tag, count] of Object.entries(rawTagCounts)) {
      const clean = tag.replace(/^(?:female|male|tag):/i, "");
      mergedTagCounts[clean] = (mergedTagCounts[clean] ?? 0) + count;
    }

    const displayed = Object.entries(mergedTagCounts)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .slice(0, limit);

    const target = displayed[index - this.tagDeletionOffset];
    if (!target) return;

    removeSpecificTags([target[0]]);
    this.reloadForm();
  }

  async handleDeleteTopReread(index: number) {
    const limit = getRereadDisplayLimit();
    const displayedRereads = getRereadStats().top.slice(0, limit);
    const target = displayedRereads[index - this.rereadDeletionOffset];
    if (!target) return;

    removeSpecificRereads([target.mangaId]);
    this.reloadForm();
  }

  async handleShowMore() {
    const limit = getTagDisplayLimit();
    const rawTagCounts = getTagCounts();
    const excludeRaw = getExcludeTagsSetting();
    const excludePatterns = excludeRaw
      .split(/[\n,]/)
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length > 0);

    const mergedTagCounts: Record<string, number> = {};
    for (const [tag, count] of Object.entries(rawTagCounts)) {
      const clean = tag.replace(/^(?:female|male|tag):/i, "");
      const lowerClean = clean.toLowerCase();
      if (excludePatterns.some((p) => lowerClean.startsWith(p))) continue;
      mergedTagCounts[clean] = (mergedTagCounts[clean] ?? 0) + count;
    }

    const totalTags = Object.keys(mergedTagCounts).length;
    const nextLimit = moveDisplayLimit(totalTags, limit, "more");
    if (nextLimit !== undefined) {
      setTagDisplayLimit(nextLimit);
      this.reloadForm();
    }
  }

  async handleShowLess() {
    const limit = getTagDisplayLimit();
    const rawTagCounts = getTagCounts();
    const excludeRaw = getExcludeTagsSetting();
    const excludePatterns = excludeRaw
      .split(/[\n,]/)
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length > 0);

    const mergedTagCounts: Record<string, number> = {};
    for (const [tag, count] of Object.entries(rawTagCounts)) {
      const clean = tag.replace(/^(?:female|male|tag):/i, "");
      const lowerClean = clean.toLowerCase();
      if (excludePatterns.some((p) => lowerClean.startsWith(p))) continue;
      mergedTagCounts[clean] = (mergedTagCounts[clean] ?? 0) + count;
    }

    const totalTags = Object.keys(mergedTagCounts).length;
    const nextLimit = moveDisplayLimit(totalTags, limit, "less");
    if (nextLimit !== undefined) {
      setTagDisplayLimit(nextLimit);
      this.reloadForm();
    }
  }

  async handleShowMoreRereads() {
    const limit = getRereadDisplayLimit();
    const totalRereads = getRereadStats().top.length;
    const nextLimit = moveDisplayLimit(totalRereads, limit, "more");
    if (nextLimit !== undefined) {
      setRereadDisplayLimit(nextLimit);
      this.reloadForm();
    }
  }

  async handleShowLessRereads() {
    const limit = getRereadDisplayLimit();
    const totalRereads = getRereadStats().top.length;
    const nextLimit = moveDisplayLimit(totalRereads, limit, "less");
    if (nextLimit !== undefined) {
      setRereadDisplayLimit(nextLimit);
      this.reloadForm();
    }
  }
}

// -- Screen Time Sub-Form --

class ScreenTimeForm extends Form {
  private mode: "week" | "day";
  private weekOffset: number = 0;

  constructor() {
    super();
    this.mode = getScreenTimeMode();
    this.weekOffset = getScreenTimeWeekOffset();
  }

  async handleSetWeek() {
    this.mode = "week";
    setScreenTimeMode("week");
    this.reloadForm();
  }

  async handleSetDay() {
    this.mode = "day";
    setScreenTimeMode("day");
    this.reloadForm();
  }

  async handlePreviousWeek() {
    const weeks = getScreenTimeLastNWeeks();
    const maxOffset = Math.max(0, weeks.length - 1);
    if (this.weekOffset < maxOffset) {
      this.weekOffset++;
      setScreenTimeWeekOffset(this.weekOffset);
      this.reloadForm();
    }
  }

  async handleNextWeek() {
    if (this.weekOffset > 0) {
      this.weekOffset--;
      setScreenTimeWeekOffset(this.weekOffset);
      this.reloadForm();
    }
  }

  async handleDisableScreenTime() {
    throw new FormConfirmationError(
      Application.Selector(this as any, "performDisableScreenTime"),
      "Are you sure you want to disable screen time tracking?",
    );
  }

  async performDisableScreenTime() {
    setScreenTimeEnabledSetting(false);
    this.reloadForm();
  }

  async handleEnableScreenTime() {
    setScreenTimeEnabledSetting(true);
    this.reloadForm();
  }

  private renderDaily(): FormSectionElement<unknown>[] {
    const daily = getScreenTimeLastNDays(7, this.weekOffset);
    const weekTotal = daily.reduce((sum, d) => sum + safeMinutes(d.minutes), 0);
    const weekAvg = weekTotal / Math.max(1, daily.length);

    // Compare current week's avg/day to previous week's avg/day
    const prevDaily = getScreenTimeLastNDays(7, this.weekOffset + 1);
    const prevWeekTotal = prevDaily.reduce(
      (sum, d) => sum + safeMinutes(d.minutes),
      0,
    );
    const prevWeekAvg = prevWeekTotal / Math.max(1, prevDaily.length);

    // Sort days Monday first, Sunday last.
    const sorted = [...daily].sort((a, b) => {
      const [yA, mA, dA] = a.date.split("-").map(Number);
      const [yB, mB, dB] = b.date.split("-").map(Number);
      const rawDayA = new Date(yA, mA - 1, dA).getDay();
      const rawDayB = new Date(yB, mB - 1, dB).getDay();
      const dayA = rawDayA === 0 ? 6 : rawDayA - 1;
      const dayB = rawDayB === 0 ? 6 : rawDayB - 1;
      return dayA - dayB;
    });

    const maxMinutes = Math.max(
      ...sorted.map((d) => safeMinutes(d.minutes)),
      1,
    );

    const rows = sorted.map((d) => {
      const mins = safeMinutes(d.minutes);
      // Parse as local date to avoid UTC offset jumbling weekdays
      const [yyyy, mm, dd] = d.date.split("-").map(Number);
      const date = new Date(yyyy, mm - 1, dd);
      const shortDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
        date.getDay()
      ];
      const dateLabel = formatScreenTimeDate(date);
      const dayLabel = `${shortDay} of ${dateLabel}`;
      const pct = Math.round((mins / maxMinutes) * 20);
      const bar = "\u2588".repeat(Math.max(1, pct));
      return LabelRow(`day_${d.date}`, {
        title: `${dayLabel}: ${mins.toFixed(0)} min`,
        subtitle: bar,
      });
    });

    // Determine navigation limits using full history
    const weeks = getScreenTimeLastNWeeks();
    const maxOffset = Math.max(0, weeks.length - 1);
    const atFarthest = this.weekOffset >= maxOffset;

    // Always render Next Week first so Previous Week stays anchored in position 2
    const weekNav: Array<
      ReturnType<typeof ButtonRow> | ReturnType<typeof LabelRow>
    > = [];
    if (this.weekOffset > 0) {
      weekNav.push(
        ButtonRow("nextWeek", {
          title: "Next Week \u2192",
          onSelect: Application.Selector(this as any, "handleNextWeek"),
        }),
      );
    } else {
      // Spacer so Previous Week always occupies the same screen position
      weekNav.push(LabelRow("nextWeekSpacer", { title: "" }));
    }
    if (!atFarthest) {
      weekNav.push(
        ButtonRow("prevWeek", {
          title: "\u2190 Previous Week",
          onSelect: Application.Selector(this as any, "handlePreviousWeek"),
        }),
      );
    } else {
      weekNav.push(LabelRow("prevWeekSpacer", { title: "" }));
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

  private renderWeekly(): FormSectionElement<unknown>[] {
    const weeks = getScreenTimeLastNWeeks();
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
    const prev =
      nonZeroWeeks.length > 1
        ? safeMinutes(nonZeroWeeks[nonZeroWeeks.length - 2].minutes)
        : 0;
    const maxMinutes = Math.max(
      ...nonZeroWeeks.map((w) => safeMinutes(w.minutes)),
      1,
    );
    const rows = nonZeroWeeks.map((w, idx) => {
      const mins = safeMinutes(w.minutes);
      const start = parseStoredDate(w.weekStart);
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

  override getSections(): FormSectionElement<unknown>[] {
    if (!getScreenTimeEnabledSetting()) {
      return [
        Section("enableScreenTime", [
          ButtonRow("enableScreenTimeBtn", {
            title: "Enable Screen Time",
            onSelect: Application.Selector(
              this as any,
              "handleEnableScreenTime",
            ),
          }),
        ]),
      ];
    }

    const toggle = Section("toggle", [
      ButtonRow("modeToggle", {
        title: this.mode === "week" ? "Switch to Days" : "Switch to Weeks",
        onSelect: Application.Selector(
          this as any,
          this.mode === "week" ? "handleSetDay" : "handleSetWeek",
        ),
      }),
    ]);

    const body =
      this.mode === "week" ? this.renderWeekly() : this.renderDaily();
    const statsTrackingEnabled = getStatsTrackingEnabledSetting();
    const disableSection = Section("disableScreenTime", [
      ButtonRow("disableScreenTimeBtn", {
        title: "Disable Screen Time",
        onSelect: Application.Selector(this as any, "handleDisableScreenTime"),
      }),
    ]);
    return statsTrackingEnabled
      ? [toggle, ...body, disableSection]
      : [toggle, ...body];
  }
}
