import { HitomiFile } from "../model";
import { HitomiError, HitomiErrorCode } from "./common";
import { IMAGE_DOMAIN, IMAGE_URI_PARTS, RESOURCE_DOMAIN } from "./constant";

export function getNozomiUri(
  options: {
    language?: string;
    tag?: { type: string; name: string };
    popularityOrderBy?: string;
  } = {},
): string {
  let path = "index";
  let language = options.language || "all";

  if (typeof options.tag === "object") {
    const normalizedTagName = options.tag.name.trim().replace(/\s+/g, " ");
    const encodedTagName = encodeURIComponent(normalizedTagName);
    switch (options.tag.type) {
      case "male":
      case "female": {
        path = `tag/${options.tag.type}:${encodedTagName}`;
        break;
      }
      case "language": {
        language = normalizedTagName;
        break;
      }
      default: {
        path = `${options.tag.type}/${encodedTagName}`;
        break;
      }
    }
  }

  if (typeof options.popularityOrderBy === "string") {
    path =
      options.popularityOrderBy !== "day" ? options.popularityOrderBy : "today";
    return `${RESOURCE_DOMAIN}/popular/${path}-${language}.nozomi`;
  }

  return `${RESOURCE_DOMAIN}/n/${path}-${language}.nozomi`;
}

export class ImageUriResolver {
  private static lastSyncedAt = 0;
  private static readonly GG_CACHE_TTL_MS = 30 * 60 * 1000;

  static invalidate(): void {
    IMAGE_URI_PARTS[2].clear();
    ImageUriResolver.lastSyncedAt = 0;
  }

  static needsSync(): boolean {
    return (
      IMAGE_URI_PARTS[2].size === 0 ||
      Date.now() - ImageUriResolver.lastSyncedAt >
        ImageUriResolver.GG_CACHE_TTL_MS
    );
  }

  static parseGG(responseText: string) {
    IMAGE_URI_PARTS[2].clear();

    const bMatch = responseText.match(/(?:var\s+)?b\s*[:=]\s*['"]([^'"]+)['"]/);
    if (bMatch) {
      IMAGE_URI_PARTS[0] = bMatch[1].replace(/\/$/, "");
    }

    const oMatch = responseText.match(/(?:var\s+)?o\s*=\s*(\d+)/);
    if (oMatch) {
      IMAGE_URI_PARTS[1] = oMatch[1] === "0";
    }

    const cArrayMatch = responseText.match(/(?:var\s+)?c\s*=\s*\[([\d,\s]+)\]/);
    if (cArrayMatch) {
      const numbers = cArrayMatch[1]
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n));
      numbers.forEach((n) => IMAGE_URI_PARTS[2].add(n));
    }

    if (IMAGE_URI_PARTS[2].size === 0) {
      const caseMatches = responseText.matchAll(/case\s+(\d+):/g);
      for (const match of caseMatches) {
        IMAGE_URI_PARTS[2].add(parseInt(match[1], 10));
      }
      if (IMAGE_URI_PARTS[2].size === 0) {
        const lines = responseText.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("c")) {
            const match = line.match(/c\s*=\s*(\d+)/);
            if (match) IMAGE_URI_PARTS[2].add(parseInt(match[1], 10));
          } else if (trimmed.startsWith("case")) {
            const match = line.match(/case\s*(\d+):/);
            if (match) IMAGE_URI_PARTS[2].add(parseInt(match[1], 10));
          }
        }
      }
    }

    if (IMAGE_URI_PARTS[0].length === 0) {
      IMAGE_URI_PARTS[0] = "1763701202";
    }

    if (
      IMAGE_URI_PARTS[0].length === 0 ||
      IMAGE_URI_PARTS[2].size === 0 ||
      IMAGE_URI_PARTS[2].has(NaN)
    ) {
      throw new HitomiError(
        HitomiErrorCode.INVALID_VALUE,
        "ImageUriResolver: Failed to parse gg.js",
      );
    }

    ImageUriResolver.lastSyncedAt = Date.now();
  }

  static getImageUri(
    image: HitomiFile,
    extension: string,
    options: { isThumbnail?: boolean; isSmall?: boolean } = {},
  ): string {
    if (IMAGE_URI_PARTS[2].size === 0) {
      throw new HitomiError(
        HitomiErrorCode.INVALID_CALL,
        "ImageUriResolver.getImageUri()",
        "be called after ImageUriResolver.synchronize()",
      );
    }

    const requested = extension.toLowerCase();
    let resolvedExtension: "webp" | "avif" = "webp";

    if (requested === "avif") {
      resolvedExtension = image.hasAvif ? "avif" : "webp";
    } else if (requested === "webp") {
      resolvedExtension = image.hasWebp
        ? "webp"
        : image.hasAvif
          ? "avif"
          : "webp";
    } else {
      resolvedExtension = image.hasAvif ? "avif" : "webp";
    }

    let subdomain = "";
    let path = "";

    if (!options.isThumbnail) {
      if (options.isSmall) {
        throw new HitomiError(
          HitomiErrorCode.INVALID_VALUE,
          "options['isSmall']",
          "be used with options['isThumbnail']",
        );
      }
      const imageHashCode = Number.parseInt(
        image.hash.slice(-1) + image.hash.slice(-3, -1),
        16,
      );
      subdomain = resolvedExtension[0];
      path = `${IMAGE_URI_PARTS[0]}/${imageHashCode}/${image.hash}`;
      subdomain +=
        IMAGE_URI_PARTS[2].has(imageHashCode) === IMAGE_URI_PARTS[1]
          ? "2"
          : "1";
    } else {
      path = `${resolvedExtension}${options.isSmall ? "small" : "big"}tn/${image.hash.slice(-1)}/${image.hash.slice(-3, -1)}/${image.hash}`;
      const imageHashCode = Number.parseInt(
        image.hash.slice(-1) + image.hash.slice(-3, -1),
        16,
      );
      const prefix =
        IMAGE_URI_PARTS[2].has(imageHashCode) === IMAGE_URI_PARTS[1]
          ? "b"
          : "a";
      subdomain = `${prefix}tn`;
    }

    return `https://${subdomain}.${IMAGE_DOMAIN}/${path}.${resolvedExtension}`;
  }
}
