import type { JSONObject } from "@paperback/types";
import type { ReadComicsOnlineSearchMeta } from "./forms";

export interface Metadata extends JSONObject {
  page?: number;
  offset?: number;
  collectedIds?: string[];
  searchMeta?: ReadComicsOnlineSearchMeta;
  csrfToken?: string;
}
