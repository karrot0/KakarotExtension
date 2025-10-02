import { PaperbackInterceptor, Request, Response } from "@paperback/types";

export class ElftoonInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      referer: `https://elftoon.com/`,
      origin: `https://elftoon.com`,
      "user-agent": await Application.getDefaultUserAgent(),
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.5",
      "accept-encoding": "gzip, deflate, br",
      "cache-control": "no-cache",
      pragma: "no-cache",
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
