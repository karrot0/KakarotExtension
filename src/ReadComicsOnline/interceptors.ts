import { PaperbackInterceptor, Request, Response } from "@paperback/types";

const baseUrl = "https://readcomicsonline.ru";

export class ReadComicsOnlineInterceptor extends PaperbackInterceptor {
  // cf_clearance is bound to the User-Agent that solved the challenge — the
  // WebView's UA. Native requests must send that exact UA or Cloudflare rejects
  // the clearance and re-challenges. The extension reads the WebView UA at init
  // and sets it here so native image loads match the stored clearance.
  private userAgentOverride?: string;

  setUserAgent(userAgent: string): void {
    this.userAgentOverride = userAgent;
  }

  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      referer: `${baseUrl}/`,
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
