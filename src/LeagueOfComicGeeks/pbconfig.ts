import { ContentRating, type ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "LeagueOfComicGeeks",
  description:
    "Extension that integrates with leagueofcomicgeeks.com for tracking and collection management.",
  version: "1.0.0-alpha.1",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  capabilities:
    SourceIntents.SETTINGS_FORM_PROVIDING |
    SourceIntents.DISCOVER_SECTION_PROVIDING |
    SourceIntents.SEARCH_RESULT_PROVIDING |
    SourceIntents.PROGRESS_PROVIDING,
  badges: [
    {
      label: "Western Comics",
      textColor: "#FFFFFF",
      backgroundColor: "#C71585",
    },
  ],
  developers: [
    {
      name: "Karrot",
    },
  ],
} as ExtensionInfo;
