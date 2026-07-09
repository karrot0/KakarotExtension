import { PaperbackInterceptor, Request, Response, CloudflareError } from "@paperback/types";

export class MangacloudInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      referer: `https://mangacloud.org/`,
      "user-agent": await Application.getDefaultUserAgent(),
    };
    return request;
  }

  override async interceptResponse(
    _request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    // Cloudflare blocks clients without a valid cf_clearance cookie. On the API
    // it does this silently with a 409 (no cf-mitigated header, no challenge
    // page), so status alone is the signal. Point the bypass at the main HTML
    // site — its .mangacloud.org clearance also unblocks api.mangacloud.org.
    const cfMitigated = response.headers?.["cf-mitigated"];
    if (
      cfMitigated === "challenge" ||
      response.status === 409 ||
      response.status === 403 ||
      response.status === 503
    ) {
      throw new CloudflareError({
        url: "https://mangacloud.org/",
        method: "GET",
        headers: {
          "user-agent": await Application.getDefaultUserAgent(),
        },
      });
    }

    return data;
  }
}