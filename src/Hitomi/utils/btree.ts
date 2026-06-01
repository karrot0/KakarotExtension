/**
 * Hitomi B-tree gallery index search.
 *
 * Hitomi's search works via a B-tree index on the server.
 * search.html is a client-side JS app that uses this same protocol.
 *
 * Protocol:
 * 1. Fetch galleries index version from RESOURCE_DOMAIN/galleriesindex/version
 * 2. SHA-256 hash the search term → take first 4 bytes as the B-tree key
 * 3. Walk the B-tree at galleriesindex/galleries.<version>.index
 *    using HTTP Range requests to read individual nodes
 * 4. When key is found, get (offset, length) into the data file
 * 5. Fetch gallery IDs from galleriesindex/galleries.<version>.data
 *    using Range: bytes=offset-(offset+length-1)
 * 6. Parse gallery IDs as big-endian Int32 values
 *
 * Reference: ltn.gold-usergeneratedcontent.net/searchlib.js
 */

import { RESOURCE_DOMAIN } from "./constant";

// -- Constants --

const B = 16;
const MAX_NODE_SIZE = 464;
const GALLERIES_INDEX_DIR = "galleriesindex";
const VERSION_CACHE_TTL_MS = 5 * 60 * 1000;

// -- Version cache --

let cachedVersion: string | null = null;
let cachedVersionTs = 0;
const DEBUG_HITOMI_BTREE =
  typeof globalThis !== "undefined" &&
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.KAKAROT_DEBUG_HITOMI === "1";

function logBTree(...args: unknown[]): void {
  if (DEBUG_HITOMI_BTREE) {
    console.log("[Hitomi BTree]", ...args);
  }
}

async function getGalleriesIndexVersion(
  fetcher: BTreeFetcher,
  forceRefresh = false,
): Promise<string> {
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedVersion &&
    now - cachedVersionTs < VERSION_CACHE_TTL_MS
  ) {
    return cachedVersion;
  }
  const url = `${RESOURCE_DOMAIN}/${GALLERIES_INDEX_DIR}/version?_=${now}`;
  const buffer = await fetcher(url);
  // TextDecoder is not available in Paperback's JavaScriptCore runtime.
  // The version is always pure ASCII digits, so String.fromCharCode works.
  const bytes = new Uint8Array(buffer);
  let text = "";
  for (let i = 0; i < bytes.length; i++) {
    text += String.fromCharCode(bytes[i]);
  }
  text = text.trim();
  if (!text || !/^\d+$/.test(text)) {
    throw new Error(`Invalid galleries index version: "${text}"`);
  }
  cachedVersion = text;
  cachedVersionTs = now;
  return text;
}

// -- SHA-256 (pure JS, synchronous) --
// Verified against Hitomi's hash_term() output:
//   "abc" → ba7816bf, "" → e3b0c442
//   "yuri" → c309191c, "anal" → 7902e270
//   "yu" → 5109f6dc, "ana" → 24d4b96f

function sha256(input: Uint8Array): Uint8Array {
  const K: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const msgLen = input.length;
  const bitLen = msgLen * 8;
  const padLen = (64 - ((msgLen + 9) % 64)) % 64;
  const totalLen = msgLen + 1 + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(input);
  padded[msgLen] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(totalLen - 4, bitLen, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Int32Array(64);

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getInt32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 =
        (((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
          ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
          (w[i - 15] >>> 3)) |
        0;
      const s1 =
        (((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
          ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
          (w[i - 2] >>> 10)) |
        0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 =
        (((e >>> 6) | (e << 26)) ^
          ((e >>> 11) | (e << 21)) ^
          ((e >>> 25) | (e << 7))) |
        0;
      const ch = ((e & f) ^ (~e & g)) | 0;
      const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 =
        (((a >>> 2) | (a << 30)) ^
          ((a >>> 13) | (a << 19)) ^
          ((a >>> 22) | (a << 10))) |
        0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) | 0;
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const result = new Uint8Array(32);
  const rv = new DataView(result.buffer);
  rv.setInt32(0, h0, false);
  rv.setInt32(4, h1, false);
  rv.setInt32(8, h2, false);
  rv.setInt32(12, h3, false);
  rv.setInt32(16, h4, false);
  rv.setInt32(20, h5, false);
  rv.setInt32(24, h6, false);
  rv.setInt32(28, h7, false);
  return result;
}

export function sha256Bytes(input: Uint8Array): Uint8Array {
  return sha256(input);
}

/**
 * Hash a search term to a 4-byte key for B-tree lookup.
 * Matches Hitomi's hash_term() in searchlib.js — takes each char's
 * charCodeAt(0) as a byte (same as UTF-8 for ASCII).
 */
function hashTerm(term: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < term.length; i++) {
    const codePoint = term.codePointAt(i) ?? 0;
    if (codePoint > 0xffff) i++;

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(0xf0 | (codePoint >> 18));
      bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    }
  }
  return sha256(new Uint8Array(bytes)).slice(0, 4);
}

function normalizeSearchTerm(term: string): string {
  return term
    .replace(/[/#]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

// -- B-tree node --

interface BTreeNode {
  keys: Uint8Array[];
  datas: [number, number][];
  subnodeAddresses: number[];
}

function decodeNode(buffer: ArrayBuffer): BTreeNode | null {
  if (!buffer || buffer.byteLength === 0) return null;

  const dv = new DataView(buffer);
  let pos = 0;
  const has = (bytes: number) => pos + bytes <= buffer.byteLength;

  if (!has(4)) return null;
  const numberOfKeys = dv.getInt32(pos, false);
  pos += 4;
  if (numberOfKeys < 0 || numberOfKeys > B) return null;

  const keys: Uint8Array[] = [];
  for (let i = 0; i < numberOfKeys; i++) {
    if (!has(4)) return null;
    const keySize = dv.getInt32(pos, false);
    pos += 4;
    if (keySize <= 0 || keySize > 32 || !has(keySize)) return null;
    keys.push(new Uint8Array(buffer.slice(pos, pos + keySize)));
    pos += keySize;
  }

  if (!has(4)) return null;
  const numberOfDatas = dv.getInt32(pos, false);
  pos += 4;
  if (numberOfDatas < 0 || numberOfDatas > B) return null;

  const datas: [number, number][] = [];
  for (let i = 0; i < numberOfDatas; i++) {
    if (!has(12)) return null;
    const high = dv.getUint32(pos, false);
    const low = dv.getUint32(pos + 4, false);
    pos += 8;
    const length = dv.getInt32(pos, false);
    pos += 4;
    datas.push([high * 0x100000000 + low, length]);
  }

  const subnodeAddresses: number[] = [];
  for (let i = 0; i < B + 1; i++) {
    if (!has(8)) return null;
    const high = dv.getUint32(pos, false);
    const low = dv.getUint32(pos + 4, false);
    subnodeAddresses.push(high * 0x100000000 + low);
    pos += 8;
  }

  return { keys, datas, subnodeAddresses };
}

function compareArrays(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function locateKey(key: Uint8Array, node: BTreeNode): [boolean, number] {
  let cmp = -1;
  let i: number;
  for (i = 0; i < node.keys.length; i++) {
    cmp = compareArrays(key, node.keys[i]);
    if (cmp <= 0) break;
  }
  return [cmp === 0, i];
}

function isLeaf(node: BTreeNode): boolean {
  return node.subnodeAddresses.every((addr) => addr === 0);
}

// -- Fetcher type (must support Range headers in cache-safe way) --

export type BTreeFetcher = (
  url: string,
  headers?: Record<string, string>,
) => Promise<ArrayBuffer>;

// -- Core search --

async function bTreeSearch(
  indexUrl: string,
  key: Uint8Array,
  fetcher: BTreeFetcher,
): Promise<[number, number] | null> {
  let address = 0;

  for (let depth = 0; depth < 20; depth++) {
    const rangeEnd = address + MAX_NODE_SIZE - 1;
    logBTree(`depth=${depth} fetching Range:${address}-${rangeEnd}`);

    const buffer = await fetcher(indexUrl, {
      Range: `bytes=${address}-${rangeEnd}`,
    });

    // Safety: if the framework ignored the Range header and returned the full
    // 1.6 GB index file (or a large chunk), bail out immediately.
    if (buffer.byteLength > MAX_NODE_SIZE * 2) {
      console.error(
        `[Hitomi BTree] Range request returned ${buffer.byteLength} bytes ` +
          `(expected ~${MAX_NODE_SIZE}). Range header may not be supported by framework.`,
      );
      throw new Error(
        `BTree Range response too large: ${buffer.byteLength} bytes (expected ${MAX_NODE_SIZE})`,
      );
    }

    logBTree(`depth=${depth} received ${buffer.byteLength} bytes`);

    const node = decodeNode(buffer);
    if (!node || node.keys.length === 0) {
      logBTree(`depth=${depth} node decode failed or empty`);
      return null;
    }

    logBTree(`depth=${depth} nKeys=${node.keys.length} isLeaf=${isLeaf(node)}`);

    const [found, where] = locateKey(key, node);
    if (found) return node.datas[where] ?? null;
    if (isLeaf(node)) return null;

    const childAddr = node.subnodeAddresses[where];
    if (childAddr === 0) return null;
    address = childAddr;
  }

  return null;
}

function parseGalleryIdsFromData(buffer: ArrayBuffer): number[] {
  if (!buffer || buffer.byteLength < 4) return [];

  const view = new DataView(buffer);
  const count = view.getInt32(0, false);
  if (count <= 0 || count > 10_000_000) return [];

  const needed = count * 4 + 4;
  // Allow the buffer to be larger than needed (trailing data is OK from Range requests)
  // Only fail if the buffer is too small to contain the expected data
  if (buffer.byteLength < needed) {
    console.warn(
      `[Hitomi BTree] Data length too small: got ${buffer.byteLength}, expected at least ${needed}`,
    );
    return [];
  }

  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(view.getInt32(4 + i * 4, false));
  }
  return ids;
}

// -- Public API --

/**
 * Search Hitomi's galleries B-tree index for a plain text term.
 *
 * IMPORTANT: The fetcher passed here must NOT cache by URL alone.
 * B-tree makes multiple Range requests to the same URL with different
 * Range headers. If the fetcher caches by URL, every node fetch after
 * the root returns stale (root) data and the search silently fails.
 *
 * @param term - The search term (e.g., "yuri", "anal", "yu").
 * @param fetcher - HTTP fetcher that supports Range headers and caches by URL+Range.
 * @returns Array of gallery IDs matching the term.
 */
async function searchGalleryIdsByNormalizedTerm(
  normalized: string,
  fetcher: BTreeFetcher,
  forceVersionRefresh = false,
  versionOverride?: string,
): Promise<number[]> {
  const version =
    versionOverride ??
    (await getGalleriesIndexVersion(fetcher, forceVersionRefresh));
  const key = hashTerm(normalized);
  const keyHex = Array.from(key)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  logBTree(`version=${version} key=${keyHex}`);

  const indexUrl = `${RESOURCE_DOMAIN}/${GALLERIES_INDEX_DIR}/galleries.${version}.index`;
  const dataUrl = `${RESOURCE_DOMAIN}/${GALLERIES_INDEX_DIR}/galleries.${version}.data`;

  const dataRange = await bTreeSearch(indexUrl, key, fetcher);
  if (!dataRange) {
    logBTree(`Term "${normalized}" not found in galleries B-tree index`);
    return [];
  }

  const [offset, length] = dataRange;
  logBTree(`"${normalized}" found: offset=${offset} length=${length}`);
  if (length <= 0 || length > 100_000_000) return [];

  const dataBuffer = await fetcher(dataUrl, {
    Range: `bytes=${offset}-${offset + length - 1}`,
  });

  const ids = parseGalleryIdsFromData(dataBuffer);
  logBTree(`"${normalized}" -> ${ids.length} gallery IDs`);
  return ids;
}

function intersectIdLists(lists: number[][]): number[] {
  if (lists.length === 0) return [];
  const sorted = [...lists].sort((a, b) => a.length - b.length);
  let current = new Set(sorted[0]);
  for (let i = 1; i < sorted.length; i++) {
    const next = new Set(sorted[i]);
    const intersection = new Set<number>();
    for (const id of current) {
      if (next.has(id)) intersection.add(id);
    }
    current = intersection;
    if (current.size === 0) break;
  }
  return [...current].sort((a, b) => b - a);
}

export async function searchGalleryIdsByTerm(
  term: string,
  fetcher: BTreeFetcher,
): Promise<number[]> {
  const normalized = normalizeSearchTerm(term);
  if (!normalized) return [];

  logBTree(`Searching "${normalized}"`);

  const parts = normalized.split(/\s+/).filter((part) => part.length > 0);

  // Hitomi's quick search treats whitespace as separate raw fuzzy terms and
  // intersects each word's galleries B-tree postings.  Do not fall back to
  // slugged tag Nozomi paths or an exact multi-word phrase key here; phrase
  // keys can be much narrower than the website's search result set.
  if (parts.length > 1) {
    const version = await getGalleriesIndexVersion(fetcher);
    const partResults: number[][] = [];
    for (const part of parts) {
      const result = await searchGalleryIdsByNormalizedTerm(
        part,
        fetcher,
        false,
        version,
      );
      partResults.push(result);
    }

    return partResults.every((result) => result.length > 0)
      ? intersectIdLists(partResults)
      : [];
  }

  let ids = await searchGalleryIdsByNormalizedTerm(normalized, fetcher);

  // Retry once with a freshly fetched version.  Hitomi can publish a new
  // galleries.<version> pair while the short-lived extension cache still points
  // at the previous version, which presents as a false "term not found".
  if (ids.length === 0) {
    ids = await searchGalleryIdsByNormalizedTerm(normalized, fetcher, true);
  }

  return ids;
}

export function invalidateVersionCache(): void {
  cachedVersion = null;
  cachedVersionTs = 0;
}
