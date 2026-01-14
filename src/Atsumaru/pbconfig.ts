import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
    name: "Atsumaru",
    description: "Extension that pulls content from atsu.moe",
    version: "1.0.0-alpha.4",
    icon: "icon.png",
    language: "English",
    contentRating: ContentRating.EVERYONE,
    capabilities: [
        SourceIntents.DISCOVER_SECIONS_PROVIDING,
        SourceIntents.SEARCH_RESULTS_PROVIDING,
        SourceIntents.CHAPTER_PROVIDING,
    ],
    badges: [],
    developers: [
        {
            name: "Karrot",
        },
        {
            name: "LucifersCircle"
        }
    ],
} satisfies SourceInfo;
