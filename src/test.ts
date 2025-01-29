import { URLBuilder } from "./utils/url-builder/base";

function createChapterRequest(baseUrl: string, mangaId: string) {
  const request = {
    url: new URLBuilder(baseUrl)
      .addPath("ajax")
      .addPath("read")
      .addPath(mangaId)
      .addPath("chapter")
      .addPath("en")
      .build(),
    method: "GET",
    headers: {
      Referer: baseUrl,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    },
  };
  console.log("Request:", request);
  return request;
}

export { createChapterRequest };
