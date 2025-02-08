import * as cheerio from "cheerio";

// xml example

// <myanimelist>
// <myinfo>
// <user_export_type>2</user_export_type>
// </myinfo>
// <manga>
// <manga_mangadb_id>73271</manga_mangadb_id>
// <manga_title>
// <![CDATA[ Re:Monster ]]>
// </manga_title>
// <my_read_volumes>0</my_read_volumes>
// <my_read_chapters>86</my_read_chapters>
// <my_status>0</my_status>
// <update_on_import>1</update_on_import>
// </manga>
// <manga>
// <manga_mangadb_id>92149</mangadb_id>
// <manga_title>
// <![CDATA[ Tomo-chan is a Girl! ]]>
// </manga_title>
// <my_read_volumes>0</my_read_volumes>
// <my_read_chapters>953.6</my_read_chapters>
// <my_status>0</my_status>
// <update_on_import>1</update_on_import>
// </manga>
// <manga>
// <manga_mangadb_id>155430</mangadb_id>
// <manga_title>
// <![CDATA[ Demon King of the Royal Class ]]>
// </manga_title>
// <my_read_volumes>0</my_read_volumes>
// <my_read_chapters>71</my_read_chapters>
// <my_status>0</my_status>
// <update_on_import>1</update_on_import>
// </manga>
// </myanimelist>

export interface MangaItem {
  title: string;
  chapters: number;
  volumes: number;
  status: number;
}

export const txt = {
  // ... existing txt importer functions ...
};

export const json = {
  // ... existing json importer functions ...
};

interface MALManga {
  title: string;
}

export const xml = {
  parseMAL(rawXml: string): MALManga[] {
    if (!rawXml || !rawXml.includes("<myanimelist>")) {
      throw new Error("Invalid or empty MAL XML content");
    }

    const $ = cheerio.load(rawXml, {
      xml: true,
      xmlMode: true,
    });

    const mangaList: MALManga[] = [];

    $("manga").each((_, element) => {
      const title = $(element).find("manga_title").text().trim();
      if (title) {
        mangaList.push({ title });
      }
    });

    if (mangaList.length === 0) {
      throw new Error("No manga entries found in XML");
    }

    return mangaList;
  },
};
