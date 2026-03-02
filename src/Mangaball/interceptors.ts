import { PaperbackInterceptor, Request, Response } from "@paperback/types";

export class Interceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const enableNsfw = request.headers?.["x-enable-nsfw"] === "true";
    if (enableNsfw) {
      const existingCookie = request.headers?.cookie || "";
      const additional = "show18PlusContent=true";
      const cookieHeader = existingCookie
        ? existingCookie.split(";").some((c) => c.trim().startsWith("show18PlusContent"))
          ? existingCookie
          : `${existingCookie}; ${additional}`
        : additional;
      request.headers = {
        ...request.headers,
        cookie: cookieHeader,
      };
    }
    if (request.headers) {
      delete request.headers["x-enable-nsfw"];
    }

    request.headers = {
      ...request.headers,
      origin: `https://mangaball.net`,
      referer: `https://mangaball.net`,
      "user-agent": await Application.getDefaultUserAgent(),
    } as Record<string, string>;
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    return data;
  }
}
