/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

export function parseRetryAfterMs(
  headers: Record<string, string>,
): number | undefined {
  const retryAfter = headers["retry-after"] ?? headers["Retry-After"];
  if (!retryAfter) return undefined;
  const numericSeconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(numericSeconds)) {
    return Math.max(0, numericSeconds * 1000);
  }
  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return undefined;
}
