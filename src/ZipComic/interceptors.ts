import { PaperbackInterceptor, Request, Response } from "@paperback/types";

export class ZipComicInterceptor extends PaperbackInterceptor {
  private userAgentOverride?: string;

  setUserAgent(userAgent: string): void {
    this.userAgentOverride = userAgent;
  }

  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      referer: `https://www.zipcomic.com/`,
      "user-agent":
        this.userAgentOverride ?? (await Application.getDefaultUserAgent()),
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.5",
    };
    return request;
  }

  override async interceptResponse(
    _request: Request,
    _response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    return data;
  }
}
