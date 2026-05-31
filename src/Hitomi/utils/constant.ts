export const RAW_GALLERY_KEYS = [
  "parody",
  "artist",
  "group",
  "character",
] as const;

export const TAG_TYPES = new Set([
  ...RAW_GALLERY_KEYS.slice(1),
  "type",
  "language",
  "series",
  "male",
  "female",
  "tag",
]);

// b, o, c components for image URI resolution
export const IMAGE_URI_PARTS: [string, boolean, Set<number>] = [
  "",
  false,
  new Set<number>(),
];

export const RESOURCE_DOMAIN = "https://ltn.gold-usergeneratedcontent.net";
export const IMAGE_DOMAIN = "gold-usergeneratedcontent.net";
