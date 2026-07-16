import { PaperbackInterceptor, Request } from "@paperback/types";
import { HitomiFile } from "./model";
import { addDataReceived } from "./settings";
import { ImageUriResolver } from "./utils/uri";

const hitomiInterceptorNoticeTimestamps = new Map<string, number>();

function logHitomiInterceptorNotice(
  key: string,
  message: string,
  minimumIntervalMs = 15000,
): void {
  const now = Date.now();
  const last = hitomiInterceptorNoticeTimestamps.get(key) ?? 0;
  if (now - last < minimumIntervalMs) {
    return;
  }
  hitomiInterceptorNoticeTimestamps.set(key, now);
  console.log(message);
}

export class HitomiInterceptor extends PaperbackInterceptor {
  private static readonly FALLBACK_IMAGE_URL =
    "https://ltn.gold-usergeneratedcontent.net/favicon-192x192.png";
  private syncGGCallback: (() => Promise<void>) | null = null;
  private cookieHeaderProvider: ((url: string) => string | undefined) | null =
    null;
  // Set to true when a CDN 404/403 signals that gg.js has rotated
  private ggRefreshNeeded = false;
  // Download pacing to avoid CDN 503/429 bursts during long chapter downloads.
  private imageThrottleChain: Promise<void> = Promise.resolve();
  private imageNextAllowedAt = 0;
  private activeImageRequests = 0;
  private pendingImageRequestResolvers: Array<{
    resolve: () => void;
    granted: boolean;
  }> = [];
  private activeImageRequestLeases = new Set<number>();
  private nextImageRequestLeaseId = 1;
  private rateLimitBackoffUntil = 0;
  private rateLimitStrikeCount = 0;
  private lastStrikeTime = 0;
  private readonly MAX_CONCURRENT_IMAGE_REQUESTS = 8;
  private readonly IMAGE_REQUEST_LEASE_TIMEOUT_MS = 1600;
  private readonly IMAGE_MIN_INTERVAL_MS = 16;
  private readonly IMAGE_DOWNLOAD_EXTRA_INTERVAL_MS = 10;
  private readonly IMAGE_JITTER_MAX_MS = 8;
  private readonly MAX_BACKOFF_MS = 1200;
  private readonly STRIKE_DECAY_MS = 30000;

  setSyncGG(fn: () => Promise<void>): void {
    this.syncGGCallback = fn;
  }

  setCookieHeaderProvider(
    fn: ((url: string) => string | undefined) | null,
  ): void {
    this.cookieHeaderProvider = fn;
  }

  // Reset rate limiting state - call this on app restart/reinit
  resetRateLimitState(): void {
    this.rateLimitBackoffUntil = 0;
    this.rateLimitStrikeCount = 0;
    this.lastStrikeTime = 0;
    this.imageNextAllowedAt = 0;
    this.imageThrottleChain = Promise.resolve();
    this.activeImageRequests = 0;
    this.pendingImageRequestResolvers = [];
    this.activeImageRequestLeases.clear();
    this.nextImageRequestLeaseId = 1;
  }

  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      Referer: "https://hitomi.la/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    };

    if (this.cookieHeaderProvider && request.url.startsWith("http")) {
      const cookieHeader = this.cookieHeaderProvider(request.url);
      if (cookieHeader) {
        request.headers = {
          ...request.headers,
          Cookie: cookieHeader,
        };
      }
    }

    // Rewrite lazy-placeholder URLs to real CDN URLs at download time.
    // This ensures fresh gg.js values are used for every image, preventing
    // failures when Hitomi rotates gg.js mid-chapter-download.
    const isImagePlaceholder = request.url.startsWith("hitomi://image/");
    const isThumbPlaceholder = request.url.startsWith("hitomi://thumb/");
    if (isImagePlaceholder || isThumbPlaceholder) {
      if (
        this.syncGGCallback &&
        (this.ggRefreshNeeded || ImageUriResolver.needsSync())
      ) {
        if (this.ggRefreshNeeded) {
          ImageUriResolver.invalidate();
        }
        try {
          await this.syncGGCallback();
          if (ImageUriResolver.needsSync()) {
            throw new Error(
              "ImageUriResolver synchronization did not complete",
            );
          }
          this.ggRefreshNeeded = false;
        } catch (e) {
          console.warn("[Hitomi] interceptRequest: syncGG failed", e);
          request.url = HitomiInterceptor.FALLBACK_IMAGE_URL;
          return request;
        }
      }

      const rest = request.url.slice(
        isImagePlaceholder
          ? "hitomi://image/".length
          : "hitomi://thumb/".length,
      );
      const parts = rest.split("/").filter((p) => p.length > 0);
      if (parts.length < 2) {
        console.warn(
          "[Hitomi] interceptRequest: malformed placeholder URL",
          request.url,
        );
        request.url = HitomiInterceptor.FALLBACK_IMAGE_URL;
        return request;
      }

      const hash = parts[0];
      const extRaw = parts[1].toLowerCase();
      const ext: "webp" | "avif" = extRaw === "avif" ? "avif" : "webp";
      const thumbSizeRaw = parts[2]?.toLowerCase();
      const isSmallThumb = thumbSizeRaw === "small";

      // Validate hash is not empty
      if (!hash || hash.length < 3) {
        console.warn(
          "[Hitomi] interceptRequest: invalid hash in placeholder",
          hash,
        );
        request.url = HitomiInterceptor.FALLBACK_IMAGE_URL;
        return request;
      }

      const file: HitomiFile = {
        index: 0,
        hash,
        name: `image.${ext}`,
        hasWebp: ext === "webp",
        hasAvif: ext === "avif",
        width: 0,
        height: 0,
      };

      try {
        const resolvedUrl = ImageUriResolver.getImageUri(file, ext, {
          isThumbnail: isThumbPlaceholder,
          isSmall: isThumbPlaceholder ? isSmallThumb : false,
        });
        // Ensure we got a valid HTTPS URL back
        if (resolvedUrl && resolvedUrl.startsWith("https://")) {
          request.url = resolvedUrl;
        } else {
          console.warn(
            "[Hitomi] interceptRequest: getImageUri returned invalid URL",
            resolvedUrl,
          );
          request.url = HitomiInterceptor.FALLBACK_IMAGE_URL;
        }
      } catch (e) {
        console.warn(
          "[Hitomi] interceptRequest: getImageUri failed for",
          hash,
          ext,
          e,
        );
        request.url = HitomiInterceptor.FALLBACK_IMAGE_URL;
      }
    }

    if (this.isFullSizeCdnImageRequest(request.url)) {
      await this.refreshResolvedImageRequestUrl(request);
    }

    if (this.isFullSizeCdnImageRequest(request.url)) {
      const leaseId = await this.acquireImageRequestSlot();
      (request as Request & { __hitomiLeaseId?: number }).__hitomiLeaseId =
        leaseId;
      try {
        await this.reserveImageRequestSlot();
      } catch (e) {
        this.releaseImageRequestLease(leaseId);
        throw e;
      }
    }

    return request;
  }

  override async interceptResponse(
    request: Request,
    response: unknown,
    data: any,
  ): Promise<any> {
    const bodyBytes =
      data && typeof data.byteLength === "number" ? Number(data.byteLength) : 0;
    const contentLengthBytes = this.extractResponseContentLength(response);
    const accountedBytes = bodyBytes > 0 ? bodyBytes : contentLengthBytes;
    if (accountedBytes > 0) {
      addDataReceived(accountedBytes);
    }

    // Detect CDN 404/403: indicates gg.js has been rotated server-side.
    // Flag so the next placeholder URL triggers a fresh gg.js sync before
    // computing the real CDN URL.
    if (
      response !== null &&
      typeof response === "object" &&
      "status" in response &&
      typeof response.status === "number"
    ) {
      const status = (response as { status: number }).status;
      if (this.isFullSizeCdnImageRequest(request.url)) {
        const now = Date.now();

        // Decay strikes over time - if no issues for STRIKE_DECAY_MS, reduce strike count
        if (
          this.lastStrikeTime > 0 &&
          now - this.lastStrikeTime > this.STRIKE_DECAY_MS
        ) {
          this.rateLimitStrikeCount = Math.max(
            0,
            this.rateLimitStrikeCount - 2,
          );
          if (this.rateLimitStrikeCount === 0) {
            this.rateLimitBackoffUntil = 0; // Clear backoff when strikes cleared
          }
        }

        if (status === 429 || status === 503) {
          this.rateLimitStrikeCount = Math.min(
            4,
            this.rateLimitStrikeCount + 1,
          ); // Max 4 strikes
          this.lastStrikeTime = now;
          const cooldownMs = Math.min(
            this.MAX_BACKOFF_MS,
            300 * 2 ** (this.rateLimitStrikeCount - 1),
          );
          this.rateLimitBackoffUntil = now + cooldownMs;
          logHitomiInterceptorNotice(
            "hitomi-interceptor:cooldown",
            `[Hitomi] CDN ${status} detected — applying ${cooldownMs}ms cooldown (strike ${this.rateLimitStrikeCount})`,
            10000,
          );
        } else if (status >= 200 && status < 300) {
          // Successful request - decay strikes faster
          this.rateLimitStrikeCount = Math.max(
            0,
            this.rateLimitStrikeCount - 1,
          );
          if (this.rateLimitStrikeCount === 0) {
            this.rateLimitBackoffUntil = 0;
          }
        }
      }

      if (
        (status === 404 || status === 403) &&
        request.url.includes("gold-usergeneratedcontent.net") &&
        !request.url.includes("gg.js") &&
        !request.url.includes(".nozomi")
      ) {
        logHitomiInterceptorNotice(
          "hitomi-interceptor:gg-refresh",
          "[Hitomi] CDN 404/403 detected — gg.js refresh scheduled for next image",
          10000,
        );
        this.ggRefreshNeeded = true;
      }
    }

    if (this.isFullSizeCdnImageRequest(request.url)) {
      const leaseId = (request as Request & { __hitomiLeaseId?: number })
        .__hitomiLeaseId;
      if (leaseId !== undefined) {
        this.releaseImageRequestLease(leaseId);
      }
    }

    return data;
  }

  private isCdnImageRequest(url: string): boolean {
    if (!url.includes("gold-usergeneratedcontent.net")) return false;
    if (url.includes("gg.js") || url.includes(".nozomi")) return false;
    // Only pace real image payload requests. Do not classify gallery JS or index files as image traffic.
    return /\.(?:webp|avif)(?:\?|$)/i.test(url);
  }

  private isFullSizeCdnImageRequest(url: string): boolean {
    if (!this.isCdnImageRequest(url)) {
      return false;
    }
    const parsed = this.parseImageRequestUrl(url);
    return parsed ? !parsed.isThumbnail : true;
  }

  private async acquireImageRequestSlot(): Promise<number> {
    const grantSlot = () => {
      this.activeImageRequests++;
      const leaseId = this.nextImageRequestLeaseId++;
      this.activeImageRequestLeases.add(leaseId);
      this.startImageRequestLeaseTimer(leaseId);
      return leaseId;
    };

    if (this.activeImageRequests < this.MAX_CONCURRENT_IMAGE_REQUESTS) {
      return grantSlot();
    }

    const waiter = {
      resolve: () => {
        return;
      },
      granted: false,
    };

    const gate = new Promise<void>((resolve) => {
      waiter.resolve = resolve;
    });
    this.pendingImageRequestResolvers.push(waiter);
    await gate;

    return grantSlot();
  }

  private releaseImageRequestLease(leaseId: number): void {
    if (!this.activeImageRequestLeases.delete(leaseId)) {
      return;
    }

    if (this.activeImageRequests > 0) {
      this.activeImageRequests--;
    }

    while (this.pendingImageRequestResolvers.length > 0) {
      const next = this.pendingImageRequestResolvers.shift();
      if (!next) {
        continue;
      }
      next.granted = true;
      next.resolve();
      break;
    }
  }

  private startImageRequestLeaseTimer(leaseId: number): void {
    void this.sleep(this.IMAGE_REQUEST_LEASE_TIMEOUT_MS).then(() => {
      if (!this.activeImageRequestLeases.has(leaseId)) {
        return;
      }
      logHitomiInterceptorNotice(
        "hitomi-interceptor:lease-timeout",
        "[Hitomi] Releasing stale image request slot after timeout",
        10000,
      );
      this.releaseImageRequestLease(leaseId);
    });
  }

  private async reserveImageRequestSlot(): Promise<void> {
    await this.enqueueImageSlot(async () => {
      const now = Date.now();
      const waitForBackoff = Math.max(0, this.rateLimitBackoffUntil - now);
      const waitForPacing = Math.max(0, this.imageNextAllowedAt - now);
      const waitMs = Math.max(waitForBackoff, waitForPacing);
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }
      const jitter = Math.floor(Math.random() * this.IMAGE_JITTER_MAX_MS);
      const extraIntervalMs =
        this.activeImageRequests >= this.MAX_CONCURRENT_IMAGE_REQUESTS - 2
          ? this.IMAGE_DOWNLOAD_EXTRA_INTERVAL_MS
          : 0;
      this.imageNextAllowedAt =
        Date.now() + this.IMAGE_MIN_INTERVAL_MS + extraIntervalMs + jitter;
    });
  }

  private async enqueueImageSlot(fn: () => Promise<void>): Promise<void> {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.imageThrottleChain;
    this.imageThrottleChain = previous.then(() => gate);
    await previous;
    try {
      await fn();
    } finally {
      release();
    }
  }

  private sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }
    return Application.sleep(ms / 1000);
  }

  private async refreshResolvedImageRequestUrl(
    request: Request,
  ): Promise<void> {
    if (
      !(this.ggRefreshNeeded || ImageUriResolver.needsSync()) ||
      !this.syncGGCallback
    ) {
      return;
    }

    const parsed = this.parseImageRequestUrl(request.url);
    if (!parsed) {
      return;
    }

    if (this.ggRefreshNeeded) {
      ImageUriResolver.invalidate();
    }

    try {
      await this.syncGGCallback();
      if (ImageUriResolver.needsSync()) {
        throw new Error("ImageUriResolver synchronization did not complete");
      }
      const refreshedUrl = ImageUriResolver.getImageUri(
        parsed.file,
        parsed.extension,
        {
          isThumbnail: parsed.isThumbnail,
          isSmall: parsed.isSmall,
        },
      );
      if (refreshedUrl.startsWith("https://")) {
        request.url = refreshedUrl;
        this.ggRefreshNeeded = false;
      }
    } catch (e) {
      console.warn(
        "[Hitomi] interceptRequest: failed to refresh stale image URL",
        e,
      );
    }
  }

  private parseImageRequestUrl(url: string): {
    extension: "webp" | "avif";
    file: HitomiFile;
    isThumbnail: boolean;
    isSmall: boolean;
  } | null {
    const match = url.match(
      /^(?:https?:\/\/)?[^/]+\/(.+?)\.(webp|avif)(?:\?.*)?$/i,
    );
    if (!match) {
      return null;
    }

    const path = match[1];
    const extension = match[2].toLowerCase() as "webp" | "avif";
    const segments = path.split("/");
    const hash = segments[segments.length - 1];
    if (!hash || hash.length < 3) {
      return null;
    }

    const isSmall = path.includes("smalltn/");
    const isThumbnail = isSmall || path.includes("bigtn/");
    return {
      extension,
      isThumbnail,
      isSmall,
      file: {
        index: 0,
        hash,
        name: `image.${extension}`,
        hasWebp: extension === "webp",
        hasAvif: extension === "avif",
        width: 0,
        height: 0,
      },
    };
  }

  private extractResponseContentLength(response: unknown): number {
    if (!response || typeof response !== "object") {
      return 0;
    }

    const headers = (response as { headers?: unknown }).headers;
    if (!headers || typeof headers !== "object") {
      return 0;
    }

    const map = headers as Record<string, unknown>;
    const value =
      map["Content-Length"] ?? map["content-length"] ?? map["CONTENT-LENGTH"];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return 0;
  }
}
