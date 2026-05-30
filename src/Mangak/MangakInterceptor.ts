import { PaperbackInterceptor, Request, Response } from "@paperback/types";

export class MangakInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const isMangak = request.url.includes("mangak.io");
    request.headers = {
      ...request.headers,
      referer: isMangak ? "https://mangak.io/" : "https://mangabuddy.com/",
      "user-agent": await Application.getDefaultUserAgent(),
    };
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
