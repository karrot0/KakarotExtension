const LANGUAGE_STATE_KEY = "mangaball_chapter_language_filter";
const NSFW_STATE_KEY = "mangaball_show_nsfw";

// Persisted "Show 18+ Content" toggle so it stays on across searches/sessions
// until explicitly turned off.
export function getNsfwSetting(): boolean {
  return Application.getState(NSFW_STATE_KEY) === true;
}

export function setNsfwSetting(value: boolean): void {
  Application.setState(value, NSFW_STATE_KEY);
}

// Codes match the language keys the API returns in each translation's
// `language` field (mangaball.net's own scheme). "all" disables filtering.
export const LANGUAGE_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "All Languages" },
  { id: "ar", label: "Arabic" },
  { id: "bg", label: "Bulgarian" },
  { id: "bn", label: "Bengali" },
  { id: "ca", label: "Catalan" },
  { id: "ca-ad", label: "Catalan (Andorra)" },
  { id: "ca-es", label: "Catalan (Spain)" },
  { id: "ca-fr", label: "Catalan (France)" },
  { id: "ca-it", label: "Catalan (Italy)" },
  { id: "ca-pt", label: "Catalan (Portugal)" },
  { id: "cs", label: "Czech" },
  { id: "da", label: "Danish" },
  { id: "de", label: "German" },
  { id: "el", label: "Greek" },
  { id: "en", label: "English" },
  { id: "es", label: "Spanish" },
  { id: "es-ar", label: "Spanish (Argentina)" },
  { id: "es-mx", label: "Spanish (Mexico)" },
  { id: "es-es", label: "Spanish (Spain)" },
  { id: "es-la", label: "Spanish (Latin America)" },
  { id: "es-419", label: "Spanish (Latin America)" },
  { id: "fa", label: "Persian" },
  { id: "fi", label: "Finnish" },
  { id: "fr", label: "French" },
  { id: "he", label: "Hebrew" },
  { id: "hi", label: "Hindi" },
  { id: "hu", label: "Hungarian" },
  { id: "ib", label: "Icelandic" },
  { id: "ib-is", label: "Icelandic (Iceland)" },
  { id: "id", label: "Indonesian" },
  { id: "it", label: "Italian" },
  { id: "it-it", label: "Italian (Italy)" },
  { id: "is", label: "Icelandic" },
  { id: "jp", label: "Japanese (Japan)" },
  { id: "kr", label: "Korean" },
  { id: "kn", label: "Kannada" },
  { id: "kn-in", label: "Kannada (India)" },
  { id: "kn-my", label: "Kannada (Malaysia)" },
  { id: "kn-sg", label: "Kannada (Singapore)" },
  { id: "kn-tw", label: "Kannada (Taiwan)" },
  { id: "ml", label: "Malayalam" },
  { id: "ml-in", label: "Malayalam (India)" },
  { id: "ml-my", label: "Malayalam (Malaysia)" },
  { id: "ml-sg", label: "Malayalam (Singapore)" },
  { id: "ml-tw", label: "Malayalam (Taiwan)" },
  { id: "ms", label: "Malay" },
  { id: "ne", label: "Nepali" },
  { id: "nl", label: "Dutch" },
  { id: "nl-be", label: "Dutch (Belgium)" },
  { id: "no", label: "Norwegian" },
  { id: "pl", label: "Polish" },
  { id: "pt-br", label: "Portuguese (Brazil)" },
  { id: "pt-pt", label: "Portuguese (Portugal)" },
  { id: "ro", label: "Romanian" },
  { id: "ru", label: "Russian" },
  { id: "sk", label: "Slovak" },
  { id: "sl", label: "Slovenian" },
  { id: "sq", label: "Albanian" },
  { id: "sr", label: "Serbian" },
  { id: "sr-cyrl", label: "Serbian (Cyrillic)" },
  { id: "sv", label: "Swedish" },
  { id: "ta", label: "Tamil" },
  { id: "th", label: "Thai" },
  { id: "th-hk", label: "Thai (Hong Kong)" },
  { id: "th-kh", label: "Thai (Cambodia)" },
  { id: "th-la", label: "Thai (Laos)" },
  { id: "th-my", label: "Thai (Malaysia)" },
  { id: "th-sg", label: "Thai (Singapore)" },
  { id: "tr", label: "Turkish" },
  { id: "uk", label: "Ukrainian" },
  { id: "vi", label: "Vietnamese" },
  { id: "zh", label: "Chinese" },
  { id: "zh-cn", label: "Chinese (Simplified)" },
  { id: "zh-hk", label: "Chinese (Hong Kong)" },
  { id: "zh-mo", label: "Chinese (Macau)" },
  { id: "zh-sg", label: "Chinese (Singapore)" },
  { id: "zh-tw", label: "Chinese (Taiwan)" },
];

export function getLanguageSetting(): string[] {
  const value = Application.getState(LANGUAGE_STATE_KEY);
  if (Array.isArray(value)) {
    const langs = value.filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    return langs.length > 0 ? langs : ["all"];
  }
  if (typeof value === "string" && value) {
    return [value];
  }
  return ["all"];
}

export function setLanguageSetting(value: string[]): void {
  Application.setState(value.length > 0 ? value : ["all"], LANGUAGE_STATE_KEY);
}

// A translation passes when "all" is selected, or its language code matches a
// selected id, or (fallback) its display name matches a selected option's label.
export function isLanguageAllowed(code: string, name?: string): boolean {
  const setting = getLanguageSetting();
  if (setting.includes("all")) return true;

  const c = code.trim().toLowerCase();
  if (c && setting.includes(c)) return true;

  if (name) {
    const n = name.trim().toLowerCase();
    return setting.some((id) => {
      const option = LANGUAGE_OPTIONS.find((o) => o.id === id);
      return option ? option.label.toLowerCase() === n : false;
    });
  }
  return false;
}
