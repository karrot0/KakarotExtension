import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";

const LOCG_ORIGIN = "https://leagueofcomicgeeks.com";

export class LOFCGHeaderInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      "origin": LOCG_ORIGIN,
      "referer": `${LOCG_ORIGIN}/`,
      "user-agent": await Application.getDefaultUserAgent(),
      ...request.headers,
    };
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    void request;
    void response;
    return data;
  }
}

