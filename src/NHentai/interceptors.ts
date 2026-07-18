/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */
import {
  CloudflareError,
  PaperbackInterceptor,
  Request,
  Response,
} from "@paperback/types";
import { addDataReceived } from "./settings";
import { parseRetryAfterMs } from "./utils/http";

export class NHentaiInterceptor extends PaperbackInterceptor {
  private cookieHeaderProvider: ((url: string) => string | undefined) | null =
    null;
  private cachedUserAgent: string | null = null;
  private imageThrottleChain: Promise<void> = Promise.resolve();
  private imageNextAllowedAt = 0;
  private galleryFastWindowCounts = new Map<string, number>();
  private rateLimitBackoffUntil = 0;
  private rateLimitStrikeCount = 0;
  private lastStrikeTime = 0;
  private readonly FAST_WINDOW_IMAGE_COUNT = 50;
  private readonly COVER_IMAGE_MIN_INTERVAL_MS = 38;
  private readonly COVER_IMAGE_JITTER_MAX_MS = 4;
  private readonly FAST_IMAGE_MIN_INTERVAL_MS = 80;
  private readonly FAST_IMAGE_JITTER_MAX_MS = 10;
  private readonly STEADY_IMAGE_MIN_INTERVAL_MS = 130;
  private readonly STEADY_IMAGE_JITTER_MAX_MS = 30;
  private readonly MAX_BACKOFF_MS = 2500;
  private readonly STRIKE_DECAY_MS = 45000;

  setCookieHeaderProvider(
    fn: ((url: string) => string | undefined) | null,
  ): void {
    this.cookieHeaderProvider = fn;
  }

  resetRateLimitState(): void {
    this.imageThrottleChain = Promise.resolve();
    this.imageNextAllowedAt = 0;
    this.galleryFastWindowCounts.clear();
    this.rateLimitBackoffUntil = 0;
    this.rateLimitStrikeCount = 0;
    this.lastStrikeTime = 0;
  }

  resetImageFastWindowForGallery(galleryId: string): void {
    this.galleryFastWindowCounts.delete(galleryId);
  }

  resetCoverPacing(): void {
    // Let the next batch of cover images start without inheriting leftover
    // pacing delay from reader or previous search pages.
    this.imageNextAllowedAt = 0;
  }

  override async interceptRequest(request: Request): Promise<Request> {
    if (!this.cachedUserAgent) {
      this.cachedUserAgent = await Application.getDefaultUserAgent();
    }
    request.headers = {
      ...request.headers,
      referer: `https://nhentai.net/`,
      "user-agent": this.cachedUserAgent!,
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
    if (this.isFullSizeCdnImageRequest(request.url)) {
      await this.reserveImageRequestSlot(request.url);
    }
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

    if (response.headers?.["cf-mitigated"] === "challenge") {
      throw new CloudflareError({
        url: request.url,
        method: request.method ?? "GET",
        headers: { "user-agent": await Application.getDefaultUserAgent() },
      });
    }

    if (this.isFullSizeCdnImageRequest(request.url)) {
      const status = response.status;
      const now = Date.now();

      if (
        this.lastStrikeTime > 0 &&
        now - this.lastStrikeTime > this.STRIKE_DECAY_MS
      ) {
        this.rateLimitStrikeCount = Math.max(0, this.rateLimitStrikeCount - 1);
        if (this.rateLimitStrikeCount === 0) {
          this.rateLimitBackoffUntil = 0;
        }
      }

      if (status === 429 || status === 503) {
        this.rateLimitStrikeCount = Math.min(5, this.rateLimitStrikeCount + 1);
        this.lastStrikeTime = now;
        const retryAfterMs = parseRetryAfterMs(response.headers);
        const cooldownMs = Math.min(
          this.MAX_BACKOFF_MS,
          retryAfterMs ?? 650 * 2 ** (this.rateLimitStrikeCount - 1),
        );
        this.rateLimitBackoffUntil = Math.max(
          this.rateLimitBackoffUntil,
          now + cooldownMs,
        );
        console.log(
          `[NHentai] CDN ${status} detected - applying ${cooldownMs}ms image cooldown`,
        );
      } else if (status >= 200 && status < 300) {
        this.rateLimitStrikeCount = Math.max(0, this.rateLimitStrikeCount - 1);
        if (this.rateLimitStrikeCount === 0) {
          this.rateLimitBackoffUntil = 0;
        }
      }
    }

    return data;
  }

  private isFullSizeCdnImageRequest(url: string): boolean {
    return this.getFullSizeCdnImageMatch(url) !== null;
  }

  private getFullSizeCdnImageMatch(
    url: string,
  ): { galleryId: string; pageNumber: number } | null {
    const match = url.match(
      /^https?:\/\/i\d*\.nhentai\.net\/galleries\/(\d+)\/(\d+)\.(?:jpg|jpeg|png|gif|webp)(?:\?|$)/i,
    );
    if (!match) return null;
    const pageNumber = Number.parseInt(match[2] ?? "", 10);
    // page 1 is NOT exempt — it enters the chain with cover-specific pacing
    return {
      galleryId: match[1] ?? "",
      pageNumber: Number.isFinite(pageNumber) ? pageNumber : 0,
    };
  }

  private async reserveImageRequestSlot(url: string): Promise<void> {
    // The chain is held only for the synchronous state read+advance — never while sleeping.
    // This prevents compounding stalls where N concurrent requests each hold the chain
    // for their full sleep duration, multiplying the batch gap by N.
    let waitMs = 0;
    await this.enqueueImageSlot(() => {
      const now = Date.now();
      const waitForBackoff = Math.max(0, this.rateLimitBackoffUntil - now);
      const waitForPacing = Math.max(0, this.imageNextAllowedAt - now);
      waitMs = Math.max(waitForBackoff, waitForPacing);
      const pacing = this.getImageRequestPacing(url);
      const jitter = Math.floor(Math.random() * pacing.jitterMaxMs);
      this.imageNextAllowedAt =
        Math.max(now, this.imageNextAllowedAt) + pacing.minIntervalMs + jitter;
      return Promise.resolve();
    });
    if (waitMs > 0) {
      await this.sleep(waitMs);
    }
  }

  private getImageRequestPacing(url: string): {
    minIntervalMs: number;
    jitterMaxMs: number;
  } {
    if (this.rateLimitStrikeCount > 0) {
      return {
        minIntervalMs: this.STEADY_IMAGE_MIN_INTERVAL_MS,
        jitterMaxMs: this.STEADY_IMAGE_JITTER_MAX_MS,
      };
    }

    const match = this.getFullSizeCdnImageMatch(url);
    if (!match?.galleryId) {
      return {
        minIntervalMs: this.STEADY_IMAGE_MIN_INTERVAL_MS,
        jitterMaxMs: this.STEADY_IMAGE_JITTER_MAX_MS,
      };
    }

    if (match.pageNumber === 1) {
      return {
        minIntervalMs: this.COVER_IMAGE_MIN_INTERVAL_MS,
        jitterMaxMs: this.COVER_IMAGE_JITTER_MAX_MS,
      };
    }

    const usedFastSlots =
      this.galleryFastWindowCounts.get(match.galleryId) ?? 0;
    this.galleryFastWindowCounts.set(match.galleryId, usedFastSlots + 1);

    if (usedFastSlots < this.FAST_WINDOW_IMAGE_COUNT) {
      return {
        minIntervalMs: this.FAST_IMAGE_MIN_INTERVAL_MS,
        jitterMaxMs: this.FAST_IMAGE_JITTER_MAX_MS,
      };
    }

    return {
      minIntervalMs: this.STEADY_IMAGE_MIN_INTERVAL_MS,
      jitterMaxMs: this.STEADY_IMAGE_JITTER_MAX_MS,
    };
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
}
