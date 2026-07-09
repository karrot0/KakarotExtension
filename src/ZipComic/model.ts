import type { JSONObject } from "@paperback/types";

export interface Metadata extends JSONObject {
  page?: number;
  collectedIds?: string[];
}
