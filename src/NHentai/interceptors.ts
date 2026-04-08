import { PaperbackInterceptor, Request, Response } from "@paperback/types";
import { addDataReceived } from "./settings";

export class NHentaiInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      referer: `https://nhentai.net/`,
      "user-agent": await Application.getDefaultUserAgent(),
    };
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    if (data && typeof data.byteLength === "number") {
      addDataReceived(data.byteLength);
    }
    return data;
  }
}
