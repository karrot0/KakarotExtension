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
// <manga_mangadb_id>92149</manga_mangadb_id>
// <manga_title>
// <![CDATA[ Tomo-chan is a Girl! ]]>
// </manga_title>
// <my_read_volumes>0</my_read_volumes>
// <my_read_chapters>953.6</my_read_chapters>
// <my_status>0</my_status>
// <update_on_import>1</update_on_import>
// </manga>
// <manga>
// <manga_mangadb_id>155430</manga_mangadb_id>
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

export const xml = {
  parseMAL: (xmlContent: string): MangaItem[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
      throw new Error("Invalid XML format");
    }

    const mangaNodes = xmlDoc.getElementsByTagName("manga");
    const mangaList: MangaItem[] = [];

    for (let i = 0; i < mangaNodes.length; i++) {
      const manga = mangaNodes[i];
      const title =
        manga.getElementsByTagName("manga_title")[0]?.textContent?.trim() || "";
      const chapters = parseFloat(
        manga.getElementsByTagName("my_read_chapters")[0]?.textContent || "0",
      );
      const volumes = parseFloat(
        manga.getElementsByTagName("my_read_volumes")[0]?.textContent || "0",
      );
      const status = parseInt(
        manga.getElementsByTagName("my_status")[0]?.textContent || "0",
      );

      if (title) {
        mangaList.push({
          title,
          chapters,
          volumes,
          status,
        });
      }
    }

    return mangaList;
  },
};
