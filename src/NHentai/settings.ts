export interface LanguageOption {
  id: string;
  label: string;
  abbreviation: string;
  token?: string;
  slugs: string[];
}

export interface SortOption {
  id: string;
  label: string;
}

const LANGUAGE_STATE_KEY = "nhentai.settings.language";
const EXTRA_ARGUMENTS_STATE_KEY = "nhentai.settings.extraArguments";
const HIDE_READ_STATE_KEY = "nhentai.settings.hideRead";

export const DEFAULT_LANGUAGE = "english";
export const DEFAULT_EXTRA_ARGUMENTS = "";
export const DEFAULT_HIDE_READ = false;

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    id: "all",
    label: "All Languages",
    abbreviation: "ALL",
    token: undefined,
    slugs: [],
  },
  {
    id: "english",
    label: "English",
    abbreviation: "EN",
    token: "english",
    slugs: ["english"],
  },
  {
    id: "japanese",
    label: "Japanese",
    abbreviation: "JP",
    token: "japanese",
    slugs: ["japanese"],
  },
  {
    id: "chinese",
    label: "Chinese",
    abbreviation: "CN",
    token: "chinese",
    slugs: ["chinese"],
  },
  {
    id: "korean",
    label: "Korean",
    abbreviation: "KR",
    token: "korean",
    slugs: ["korean"],
  },
];

export function getLanguageSetting(): string {
  return (
    (Application.getState(LANGUAGE_STATE_KEY) as string | undefined) ??
    DEFAULT_LANGUAGE
  );
}

export function setLanguageSetting(value: string): void {
  Application.setState(value, LANGUAGE_STATE_KEY);
}

export function getLanguageToken(
  languageSetting: string = getLanguageSetting(),
): string | undefined {
  return LANGUAGE_OPTIONS.find((option) => option.id === languageSetting)
    ?.token;
}

export function getLanguageAbbreviationFromSlug(
  slug: string | undefined,
): string {
  if (!slug) {
    return "UNK";
  }
  const match = LANGUAGE_OPTIONS.find((option) => option.slugs.includes(slug));
  if (match) {
    return match.abbreviation;
  }
  return slug.slice(0, Math.min(3, slug.length)).toUpperCase();
}

export function getLanguageDisplayNameFromSlug(
  slug: string | undefined,
): string {
  if (!slug) {
    return "Unknown";
  }
  const match = LANGUAGE_OPTIONS.find((option) => option.slugs.includes(slug));
  if (match) {
    return match.label;
  }
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function getExtraArgumentsSetting(): string {
  return (
    (Application.getState(EXTRA_ARGUMENTS_STATE_KEY) as string | undefined) ??
    DEFAULT_EXTRA_ARGUMENTS
  );
}

export function setExtraArgumentsSetting(value: string): void {
  // Replace smart quotes with regular quotes to ensure API compatibility and prevent injection issues.
  const sanitized = value
    .replace(/['\u2018\u2019]/g, "'")
    .replace(/["\u201C\u201D]/g, '"');
  Application.setState(sanitized, EXTRA_ARGUMENTS_STATE_KEY);
}

export function getHideReadSetting(): boolean {
  const value = Application.getState(HIDE_READ_STATE_KEY) as boolean | undefined;
  return value ?? DEFAULT_HIDE_READ;
}

export function setHideReadSetting(value: boolean): void {
  Application.setState(Boolean(value), HIDE_READ_STATE_KEY);
}

export function resetNHentaiSettings(): void {
  Application.setState(DEFAULT_LANGUAGE, LANGUAGE_STATE_KEY);
  Application.setState(DEFAULT_EXTRA_ARGUMENTS, EXTRA_ARGUMENTS_STATE_KEY);
  Application.setState(DEFAULT_HIDE_READ, HIDE_READ_STATE_KEY);
}

export const SORT_OPTIONS: SortOption[] = [
  { id: "date", label: "Most Recent" },
  { id: "popular", label: "Popular All-Time" },
  { id: "popular-today", label: "Popular Today" },
  { id: "popular-week", label: "Popular Weekly" },
  { id: "popular-month", label: "Popular Monthly" },
];
