import {
  JSONObject,
} from "@paperback/types";

export interface ScribbleHubMetadata extends JSONObject {
  page?: number;
  collectedIds?: string[];
  searchCollectedIds?: string[];
}