import { PaperbackInterceptor, Request, Response } from "@paperback/types";

export class Interceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const match = request.url.match(/^(https?:\/\/[^\/]+)/);
    const origin = match ? match[1] : "https://mangapark.io";
    request.headers = {
      ...request.headers,
      referer: `${origin}/`,
      origin: origin,
      "user-agent": await Application.getDefaultUserAgent(),
      cookie: "nsfw=2",
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
