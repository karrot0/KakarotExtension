import { PaperbackInterceptor, Request, Response } from "@paperback/types";

export class Interceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const url = new URL(request.url);
    request.headers = {
      ...request.headers,
      referer: `${url.protocol}//${url.host}/`,
      origin: `${url.protocol}//${url.host}`,
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
