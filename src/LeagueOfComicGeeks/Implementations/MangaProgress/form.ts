import {
  Form,
  LabelRow,
  NavigationRow,
  Section,
  StepperRow,
  ToggleRow,
  type ListSectionElement,
  type SelectorID,
} from "@paperback/types";
import {
  getSeriesPage,
  getSeriesStatus,
  issueNumericId,
  rateIssue,
  seriesListAction,
  seriesNumericId,
  setIssueOnList,
} from "../../Services/Requests";
import { LIST_IDS, type LOFCGIssueEntry, type LOFCGSeriesStatus } from "../Shared/models/main";
import { session } from "../Shared/parser/main";

type IssueState = Pick<LOFCGIssueEntry, "pull" | "collected" | "read" | "wanted" | "rating">;

interface SeriesActions {
  readAll: boolean;
  collectAll: boolean;
  wantMissing: boolean;
}

function copyIssue(issue: LOFCGIssueEntry): LOFCGIssueEntry {
  return { ...issue };
}

function issueSummary(issue: IssueState): string {
  const parts: string[] = [];
  if (issue.read) parts.push("Read");
  if (issue.collected) parts.push("Owned");
  if (issue.pull) parts.push("Pull");
  if (issue.wanted) parts.push("Wish");
  if (issue.rating > 0) parts.push(`${issue.rating}★`);
  return parts.join(" · ");
}

/**
 * Tracking screen for a League of Comic Geeks series or issue, laid out like
 * AniList's: every list is editable at once and nothing is sent until you tap
 * the checkmark. Only what you changed is sent.
 */
export class MangaProgressForm extends Form {
  override requiresExplicitSubmission = true;

  private loading = true;
  private error?: Error;
  private original?: LOFCGSeriesStatus;
  private staged?: LOFCGSeriesStatus;
  /** Set when the tracked title is a single issue rather than a series. */
  private focusIssueId?: string;
  private actions: SeriesActions = { readAll: false, collectAll: false, wantMissing: false };

  constructor(private readonly mangaId: string) {
    super();
  }

  override formWillAppear(): void {
    if (this.original || !this.loading) return;
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      session.assertMustBeAuthenticated();
      let seriesId = seriesNumericId(this.mangaId);

      // A single issue: find its series so its list state can be read.
      if (!seriesId) {
        this.focusIssueId = issueNumericId(this.mangaId);
        const page = await getSeriesPage(this.mangaId);
        seriesId = page.match(/\/comics\/series\/(\d+)/)?.[1];
        if (!seriesId) throw new Error("Could not find the series this issue belongs to.");
      }

      this.original = await getSeriesStatus(seriesId);
      this.staged = {
        ...this.original,
        issues: this.original.issues.map(copyIssue),
      };
    } catch (e) {
      this.error = e instanceof Error ? e : new Error(String(e));
    } finally {
      this.loading = false;
      this.reloadForm();
    }
  }

  override getSections(): ListSectionElement[] {
    if (this.loading) {
      return [Section("loading", [LabelRow("loading", { title: "Loading..." })])];
    }
    if (this.error || !this.staged) {
      return [
        Section("error", [
          LabelRow("error", { title: "Error", subtitle: this.error?.message ?? "Nothing to show." }),
        ]),
      ];
    }

    const staged = this.staged;
    const focus = this.focusIssueId
      ? staged.issues.find((i) => i.issueId === this.focusIssueId)
      : undefined;
    if (focus) {
      return [
        Section("issue", [LabelRow("issue-title", { title: focus.title })]),
        ...issueSections(
          focus,
          {
            read: Application.Selector(this as MangaProgressForm, "onFocusReadChange"),
            collected: Application.Selector(this as MangaProgressForm, "onFocusCollectedChange"),
            pull: Application.Selector(this as MangaProgressForm, "onFocusPullChange"),
            wanted: Application.Selector(this as MangaProgressForm, "onFocusWantedChange"),
            rating: Application.Selector(this as MangaProgressForm, "onFocusRatingChange"),
          },
          "focus",
        ),
        this.seriesSection(),
      ];
    }

    return [this.seriesSection(), this.wholeSeriesSection(), this.issuesSection()];
  }

  private seriesSection(): ListSectionElement {
    const issues = this.staged!.issues;
    const count = (pick: (i: LOFCGIssueEntry) => boolean) => issues.filter(pick).length;
    const total = issues.length;

    return Section({ id: "series", header: this.staged!.title || "Series" }, [
      ToggleRow("pulled", {
        title: "Pull List",
        subtitle: "Subscribe to new issues",
        value: this.staged!.pulled,
        onValueChange: Application.Selector(this as MangaProgressForm, "onPulledChange"),
      }),
      LabelRow("read-count", { title: "Read", value: `${count((i) => i.read)} of ${total}` }),
      LabelRow("owned-count", { title: "Collection", value: `${count((i) => i.collected)} of ${total}` }),
      LabelRow("want-count", { title: "Wish List", value: `${count((i) => i.wanted)}` }),
    ]);
  }

  private wholeSeriesSection(): ListSectionElement {
    return Section(
      { id: "whole-series", header: "All Issues", footer: "Applied when you save." },
      [
        ToggleRow("read-all", {
          title: "Mark every issue read",
          value: this.actions.readAll,
          onValueChange: Application.Selector(this as MangaProgressForm, "onReadAllChange"),
        }),
        ToggleRow("collect-all", {
          title: "Add every issue to collection",
          value: this.actions.collectAll,
          onValueChange: Application.Selector(this as MangaProgressForm, "onCollectAllChange"),
        }),
        ToggleRow("want-missing", {
          title: "Add issues I don't own to wish list",
          value: this.actions.wantMissing,
          onValueChange: Application.Selector(this as MangaProgressForm, "onWantMissingChange"),
        }),
      ],
    );
  }

  private issuesSection(): ListSectionElement {
    const rows = this.staged!.issues.map((issue) =>
      NavigationRow(`issue-${issue.issueId}`, {
        title: issue.title,
        value: issueSummary(issue),
        form: new IssueForm(issue, () => this.reloadForm()),
      }),
    );
    return Section(
      { id: "issues", header: `Issues (${rows.length})` },
      rows.length > 0 ? rows : [LabelRow("no-issues", { title: "No issues listed" })],
    );
  }

  async onPulledChange(value: boolean): Promise<void> {
    this.staged!.pulled = value;
  }

  async onReadAllChange(value: boolean): Promise<void> {
    this.actions.readAll = value;
  }

  async onCollectAllChange(value: boolean): Promise<void> {
    this.actions.collectAll = value;
  }

  async onWantMissingChange(value: boolean): Promise<void> {
    this.actions.wantMissing = value;
  }

  // Issue rows for a single tracked issue route through the parent form.
  async onFocusPullChange(value: boolean): Promise<void> {
    this.setFocus({ pull: value });
  }
  async onFocusCollectedChange(value: boolean): Promise<void> {
    this.setFocus({ collected: value });
  }
  async onFocusReadChange(value: boolean): Promise<void> {
    this.setFocus({ read: value });
  }
  async onFocusWantedChange(value: boolean): Promise<void> {
    this.setFocus({ wanted: value });
  }
  async onFocusRatingChange(value: number): Promise<void> {
    this.setFocus({ rating: Math.round(value) });
  }

  private setFocus(change: Partial<IssueState>): void {
    const issue = this.staged?.issues.find((i) => i.issueId === this.focusIssueId);
    if (issue) Object.assign(issue, change);
    this.reloadForm();
  }

  override async formDidSubmit(): Promise<void> {
    if (!this.original || !this.staged) return;
    const failures: string[] = [];
    const attempt = async (what: string, run: () => Promise<void>) => {
      try {
        await run();
      } catch (e) {
        failures.push(`${what}: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    const seriesId = this.original.seriesId;
    const { readAll, collectAll, wantMissing } = this.actions;

    if (this.staged.pulled !== this.original.pulled) {
      await attempt("Pull list", () =>
        seriesListAction(seriesId, LIST_IDS.PULL_LIST, this.staged!.pulled ? "subscribe" : "unsubscribe"),
      );
    }
    if (readAll) await attempt("Mark all read", () => seriesListAction(seriesId, LIST_IDS.READ_LIST, "addall"));
    if (collectAll) await attempt("Collect all", () => seriesListAction(seriesId, LIST_IDS.COLLECTION, "add"));
    if (wantMissing) {
      await attempt("Wish list missing", () => seriesListAction(seriesId, LIST_IDS.WISH_LIST, "addnotowned"));
    }

    const before = new Map(this.original.issues.map((i) => [i.issueId, i]));
    for (const issue of this.staged.issues) {
      const old = before.get(issue.issueId);
      if (!old) continue;
      const label = issue.title || `Issue ${issue.issueId}`;

      if (issue.pull !== old.pull) {
        await attempt(`${label} pull list`, () => setIssueOnList(issue.issueId, LIST_IDS.PULL_LIST, issue.pull));
      }
      if (issue.collected !== old.collected && !(collectAll && issue.collected)) {
        await attempt(`${label} collection`, () =>
          setIssueOnList(issue.issueId, LIST_IDS.COLLECTION, issue.collected),
        );
      }
      if (issue.read !== old.read && !(readAll && issue.read)) {
        await attempt(`${label} read`, () => setIssueOnList(issue.issueId, LIST_IDS.READ_LIST, issue.read));
      }
      if (issue.wanted !== old.wanted) {
        await attempt(`${label} wish list`, () => setIssueOnList(issue.issueId, LIST_IDS.WISH_LIST, issue.wanted));
      }
      if (issue.rating !== old.rating) {
        await attempt(`${label} rating`, () => rateIssue(issue.issueId, issue.rating));
      }
    }

    if (failures.length > 0) {
      throw new Error(`Some changes were not saved:\n${failures.join("\n")}`);
    }
  }
}

interface IssueHandlers {
  read: SelectorID<(value: boolean) => Promise<void>>;
  collected: SelectorID<(value: boolean) => Promise<void>>;
  pull: SelectorID<(value: boolean) => Promise<void>>;
  wanted: SelectorID<(value: boolean) => Promise<void>>;
  rating: SelectorID<(value: number) => Promise<void>>;
}

/** Rows for one issue's lists and rating. */
function issueSections(issue: LOFCGIssueEntry, on: IssueHandlers, prefix: string): ListSectionElement[] {
  return [
    Section({ id: `${prefix}-lists`, header: "Lists" }, [
      ToggleRow(`${prefix}-read`, { title: "Read", value: issue.read, onValueChange: on.read }),
      ToggleRow(`${prefix}-collected`, { title: "Collection", value: issue.collected, onValueChange: on.collected }),
      ToggleRow(`${prefix}-pull`, { title: "Pull List", value: issue.pull, onValueChange: on.pull }),
      ToggleRow(`${prefix}-wanted`, { title: "Wish List", value: issue.wanted, onValueChange: on.wanted }),
    ]),
    Section({ id: `${prefix}-rating`, header: "Rating" }, [
      StepperRow(`${prefix}-rating-value`, {
        title: "Rating",
        subtitle: "0 to 5 stars, 0 is unrated",
        value: issue.rating,
        minValue: 0,
        maxValue: 5,
        stepValue: 1,
        loopOver: false,
        onValueChange: on.rating,
      }),
    ]),
  ];
}

/** Lists and rating for one issue; changes go back to the series form, which saves them. */
class IssueForm extends Form {
  constructor(
    private readonly issue: LOFCGIssueEntry,
    private readonly onChange: () => void,
  ) {
    super();
  }

  override getSections(): ListSectionElement[] {
    return issueSections(
      this.issue,
      {
        read: Application.Selector(this as IssueForm, "onReadChange"),
        collected: Application.Selector(this as IssueForm, "onCollectedChange"),
        pull: Application.Selector(this as IssueForm, "onPullChange"),
        wanted: Application.Selector(this as IssueForm, "onWantedChange"),
        rating: Application.Selector(this as IssueForm, "onRatingChange"),
      },
      "issue",
    );
  }

  async onReadChange(value: boolean): Promise<void> {
    this.update({ read: value });
  }
  async onCollectedChange(value: boolean): Promise<void> {
    this.update({ collected: value });
  }
  async onPullChange(value: boolean): Promise<void> {
    this.update({ pull: value });
  }
  async onWantedChange(value: boolean): Promise<void> {
    this.update({ wanted: value });
  }
  async onRatingChange(value: number): Promise<void> {
    this.update({ rating: Math.round(value) });
  }

  private update(change: Partial<IssueState>): void {
    Object.assign(this.issue, change);
    this.reloadForm();
    this.onChange();
  }
}
