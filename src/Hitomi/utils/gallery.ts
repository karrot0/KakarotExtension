import { GalleryIdOptions, HitomiGallery, HitomiTag } from "../model";
import { searchGalleryIdsByTerm } from "./btree";
import { getIdSet } from "./common";
import { RAW_GALLERY_KEYS, RESOURCE_DOMAIN } from "./constant";
import { getNozomiUri } from "./uri";

function buildNozomiRangeHeaders(
  startIdIndex: number,
  endIdIndex: number,
): { Range: string } | undefined {
  const start = Math.max(0, Math.floor(startIdIndex));
  const endExclusive = Math.max(start + 1, Math.floor(endIdIndex));
  const byteStart = start * 4;
  const byteEnd = endExclusive * 4 - 1;
  if (!Number.isFinite(byteStart) || !Number.isFinite(byteEnd)) {
    return undefined;
  }
  return { Range: `bytes=${byteStart}-${byteEnd}` };
}

export async function getGallery(
  id: string,
  fetcher: (url: string) => Promise<string>,
): Promise<HitomiGallery> {
  const raw = await fetcher(`${RESOURCE_DOMAIN}/galleries/${id}.js`);
  let jsonStr: string | undefined;
  const match = raw.match(/var\s+galleryinfo\s*=\s*(\{[\s\S]*?\})\s*$/);
  if (match) {
    jsonStr = match[1];
  } else {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first)
      jsonStr = raw.slice(first, last + 1);
  }
  if (!jsonStr) {
    throw new Error("Gallery JSON not found");
  }

  const responseJson = JSON.parse(jsonStr);
  const gallery: HitomiGallery = {
    id: Number(id),
    title: {
      display: responseJson["title"],
      japanese:
        typeof responseJson["japanese_title"] === "string"
          ? responseJson["japanese_title"]
          : null,
    },
    type: responseJson["type"],
    languageName: {
      english:
        typeof responseJson["language"] === "string"
          ? responseJson["language"]
          : null,
      local:
        typeof responseJson["language_localname"] === "string"
          ? responseJson["language_localname"]
          : null,
    },
    artists: [],
    groups: [],
    series: [],
    characters: [],
    tags: [],
    files: [],
    publishedDate: new Date(0),
    translations: [],
    relatedIds: [],
  };

  type GalleryArrayKey = "artists" | "groups" | "series" | "characters";
  for (const key of RAW_GALLERY_KEYS) {
    const plural = `${key}s`;
    const arr = responseJson[plural];
    if (!arr) continue;
    const target = (
      !plural.startsWith("p") ? plural : "series"
    ) as GalleryArrayKey;
    for (const entry of arr) {
      if (!entry) continue;
      gallery[target].push(entry[key]);
    }
  }

  if (Array.isArray(responseJson["tags"])) {
    for (const t of responseJson["tags"]) {
      if (!t) continue;
      let type: HitomiTag["type"] = "tag";
      if (t["male"]) type = "male";
      else if (t["female"]) type = "female";
      gallery.tags.push({ type, name: t["tag"] });
    }
  }

  if (Array.isArray(responseJson["files"])) {
    const files = responseJson["files"];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f) continue;
      gallery.files.push({
        index: i,
        hash: f["hash"],
        name: f["name"],
        hasAvif: f["hasavif"] === 1,
        hasWebp: f["haswebp"] !== 0,
        width: f["width"],
        height: f["height"],
      });
    }
  }

  const dateStr = responseJson["datepublished"] || responseJson["date"];
  if (typeof dateStr === "string") gallery.publishedDate = new Date(dateStr);

  if (Array.isArray(responseJson["languages"])) {
    for (const lang of responseJson["languages"]) {
      if (!lang) continue;
      gallery.translations.push({
        id: Number(lang["galleryid"]),
        languageName: {
          english: lang["name"],
          local: lang["language_localname"],
        },
      });
    }
  }

  if (Array.isArray(responseJson["related"])) {
    gallery.relatedIds = responseJson["related"];
  }

  return gallery;
}

export async function getGalleryIds(
  options: GalleryIdOptions = {},
  fetcher: (url: string, headers?: any) => Promise<ArrayBuffer>,
): Promise<number[]> {
  const tags = options.tags ?? [];
  const languageTags =
    options.languages ??
    tags.filter((t) => t.type === "language").map((t) => t.name);
  const nonLanguageTags = tags.filter((t) => t.type !== "language");

  const languages = languageTags.length > 0 ? languageTags : ["all"];

  const hasTags = nonLanguageTags.length > 0;
  const hasRange = typeof options.range === "object";
  const hasFuzzyTags = nonLanguageTags.some((t) => t.isFuzzy);
  const remoteRangeApplied = !hasTags && hasRange;
  const remoteRangeHeaders = remoteRangeApplied
    ? buildNozomiRangeHeaders(
        options.range?.start ?? 0,
        options.range?.end ?? 0,
      )
    : undefined;

  // For unfiltered popular browsing, limit download to the first 5000 IDs
  // (20KB) to avoid downloading the entire nozomi file.  Filtered searches
  // must use the full popular file as an ordering/base set; truncating it
  // before intersecting with B-tree quick-search results drops valid matches.
  const MAX_POPULAR_IDS = 5000;
  const canRangePopularBase =
    typeof options.popularityOrderBy === "string" && !hasTags;
  const popularRangeHeaders = canRangePopularBase
    ? (buildNozomiRangeHeaders(
        options.range?.start ?? 0,
        Math.max(options.range?.end ?? 0, MAX_POPULAR_IDS),
      ) ?? {})
    : undefined;

  /**
   * Fetch gallery IDs for a single tag. Handles three cases:
   * 1. Fuzzy: B-tree search → nozomi expansion fallback
   * 2. Ambiguous: fetch female:, male:, tag: nozomi → union
   * 3. Standard: single nozomi fetch
   */
  const fetchTagIds = async (
    tag: HitomiTag,
    lang: string,
  ): Promise<Set<number>> => {
    if (tag.isFuzzy) {
      try {
        const btreeIds = new Set(
          await searchGalleryIdsByTerm(tag.name, fetcher),
        );
        if (btreeIds.size > 0) {
          return btreeIds;
        }
      } catch {
        // B-tree failed. Plain text search must not be reinterpreted as a tag.
      }

      // `forceFuzzy` is used for the user's general search box text.  If the
      // B-tree has no hit, return no IDs instead of probing /n/tag/...nozomi;
      // those precise tag URLs are only for source settings/search filters.
      if (tag.forceFuzzy) {
        return new Set<number>();
      }

      return fetchPreciseTagIds(tag, lang);
    }

    if (tag.type === "ambiguous") {
      // Ambiguous tags: fetch female:, male:, and neutral nozomi URLs → union
      return fetchNozomiExpansion(tag.name, lang);
    }

    // Standard nozomi fetch for known tag types
    return fetcher(getNozomiUri({ tag, language: lang }))
      .then((buffer) => getIdSet(buffer))
      .catch(() => new Set<number>());
  };

  const fetchPreciseTagIds = async (
    tag: HitomiTag,
    lang: string,
  ): Promise<Set<number>> => {
    if (tag.type === "ambiguous") {
      return fetchNozomiExpansion(tag.name, lang);
    }

    return fetcher(
      getNozomiUri({
        tag: { type: tag.type, name: tag.name },
        language: lang,
      }),
    )
      .then((buffer) => getIdSet(buffer))
      .catch(() => new Set<number>());
  };

  /**
   * Nozomi expansion: fetch female:, male:, and neutral tag: variants → union.
   * Used for ambiguous tags and as fuzzy search fallback.
   */
  const fetchNozomiExpansion = async (
    name: string,
    lang: string,
  ): Promise<Set<number>> => {
    const variants: { type: string; name: string }[] = [
      { type: "female", name },
      { type: "male", name },
      { type: "tag", name },
    ];
    const results = await Promise.all(
      variants.map((v) =>
        fetcher(getNozomiUri({ tag: v, language: lang }))
          .then((buffer) => getIdSet(buffer))
          .catch(() => new Set<number>()),
      ),
    );
    const union = new Set<number>();
    for (const s of results) for (const id of s) union.add(id);
    return union;
  };

  const fetchByLanguage = async (lang: string): Promise<Set<number>> => {
    // Determine if we need the base language index for intersection.
    // Needed when: popular sort, range slicing, first tag is negative (nothing
    // positive to start from), or any fuzzy tags (B-tree results are
    // language-agnostic and must be filtered by language).
    const needsBase =
      typeof options.popularityOrderBy === "string" ||
      hasRange ||
      (hasTags && nonLanguageTags[0]?.isNegative) ||
      hasFuzzyTags;

    const basePromise = needsBase
      ? fetcher(
          getNozomiUri({
            popularityOrderBy: options.popularityOrderBy,
            language: lang,
          }),
          typeof options.popularityOrderBy === "string"
            ? popularRangeHeaders
            : remoteRangeHeaders,
        ).then((buffer) => getIdSet(buffer))
      : null;

    // Separate positive and negative tags
    const positiveTags = nonLanguageTags.filter((t) => !t.isNegative);
    const negativeTags = nonLanguageTags.filter((t) => t.isNegative);

    // Fetch IDs for all tags in parallel
    const [positiveResults, negativeResults] = await Promise.all([
      Promise.all(
        positiveTags.map(async (tag) => ({
          tag,
          ids: await fetchTagIds(tag, lang),
        })),
      ),
      Promise.all(negativeTags.map(async (tag) => fetchTagIds(tag, lang))),
    ]);

    // Group positive results by orGroup for OR logic.
    // Tags without orGroup are standalone (each intersected independently).
    // Tags sharing the same orGroup are unioned first, then intersected.
    const groupSets: Set<number>[] = [];
    const orGroupMap = new Map<number, Set<number>>();

    for (const { tag, ids } of positiveResults) {
      if (tag.orGroup !== undefined) {
        const existing = orGroupMap.get(tag.orGroup);
        if (existing) {
          // Union into existing group
          for (const id of ids) existing.add(id);
        } else {
          orGroupMap.set(tag.orGroup, new Set(ids));
        }
      } else {
        // Standalone positive tag → its own group
        groupSets.push(ids);
      }
    }

    // Add OR group unions to the group sets
    for (const [, unionSet] of orGroupMap) {
      groupSets.push(unionSet);
    }

    // Add base set as one of the intersect groups if present
    if (basePromise) {
      groupSets.unshift(await basePromise);
    } else if (groupSets.length === 0) {
      // No tags, no base — fetch all language IDs
      const baseSet = await fetcher(getNozomiUri({ language: lang }), {}).then(
        (buffer) => getIdSet(buffer),
      );
      groupSets.push(baseSet);
    }

    if (groupSets.length === 0) return new Set<number>();

    // Intersect all groups (start from smallest for efficiency)
    groupSets.sort((a, b) => a.size - b.size);
    let current = new Set<number>(groupSets[0]);
    for (let i = 1; i < groupSets.length; i++) {
      const next = groupSets[i];
      const inter = new Set<number>();
      for (const id of current) if (next.has(id)) inter.add(id);
      current = inter;
      if (current.size === 0) return new Set<number>();
    }

    // Subtract negative tag IDs
    for (const neg of negativeResults) for (const id of neg) current.delete(id);

    let finalIds = Array.from(current);
    // Sort by descending ID for date-based queries (no popularityOrderBy).
    // Higher Hitomi gallery IDs = newer uploads, so descending = newest first.
    // This ensures OR-union results are interleaved chronologically instead of
    // having all tag-1 results appear before all tag-2 results.
    if (!options.popularityOrderBy || options.popularityOrderBy === "index")
      finalIds.sort((a, b) => b - a);
    if (options.range && !remoteRangeApplied) {
      const start = options.range.start ?? 0;
      const end = options.range.end ?? finalIds.length;
      finalIds = finalIds.slice(start, end);
    }
    return new Set<number>(finalIds);
  };

  const languageResults = await Promise.all(
    languages.map((lang) => fetchByLanguage(lang)),
  );
  const union = new Set<number>();
  for (const set of languageResults) {
    for (const id of set) union.add(id);
  }

  return Array.from(union);
}
