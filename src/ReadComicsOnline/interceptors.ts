import { PaperbackInterceptor, Request, Response } from "@paperback/types";

const baseUrl = "https://readcomicsonline.ru";

export class ReadComicsOnlineInterceptor extends PaperbackInterceptor {
  private userAgentOverride?: string;

  private readonly IMAGE_MIN_INTERVAL_MS = 70;
  private reserveChain: Promise<number> = Promise.resolve(0);
  private nextImageAt = 0;

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

    if (isCdnImage(request.url)) {
      const wait = await this.reserveImageSlot();
      if (wait > 0) {
        await Application.sleep(wait / 1000);
      }
    }
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    if (isCdnImage(request.url) && response.status === 429) {
      await Application.sleep(1);
      try {
        const [retryResponse, retryData] =
          await Application.scheduleRequest(request);
        if (retryResponse.status === 200 && retryData.byteLength > 0) {
          return retryData;
        }
      } catch {
        /* keep the original response */
      }
    }
    return data;
  }

  private reserveImageSlot(): Promise<number> {
    this.reserveChain = this.reserveChain.then(() => {
      const now = Date.now();
      const wait = Math.max(0, this.nextImageAt - now);
      this.nextImageAt =
        Math.max(now, this.nextImageAt) + this.IMAGE_MIN_INTERVAL_MS;
      return wait;
    });
    return this.reserveChain;
  }
}

function isCdnImage(url: string): boolean {
  return /cdn\.readcomicsonline\.ru\/.+\.(?:jpe?g|png|webp|gif)/i.test(url);
}
