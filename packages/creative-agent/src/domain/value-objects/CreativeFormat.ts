/** Kai's format decision for a `CreativeBrief` — whether to spend Kie AI video credits or generate images only (spec "Format Decision Logic"). Decided deterministically by `FormatDecider`, never randomly. */
export enum CreativeFormat {
  VIDEO_AND_IMAGES = "VIDEO_AND_IMAGES",
  IMAGES_ONLY = "IMAGES_ONLY",
}
