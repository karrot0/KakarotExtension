import { ContentRating, type ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Kenmei",
  description: "Integrate with Kenmei (kenmei.co) for manga tracking",
  version: "1.2",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  capabilities:
    SourceIntents.SETTINGS_FORM_PROVIDING |
    SourceIntents.DISCOVER_SECTION_PROVIDING |
    SourceIntents.SEARCH_RESULT_PROVIDING |
    SourceIntents.PROGRESS_PROVIDING,
  badges: [
    { label: "Tracker", textColor: "#FFFFFF", backgroundColor: "#5B4CF5" },
  ],
  developers: [
    {
      name: "Karrot",
    },
  ],
} as ExtensionInfo;
