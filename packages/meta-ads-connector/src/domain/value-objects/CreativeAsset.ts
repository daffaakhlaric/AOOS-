/**
 * The Meta creative asset backing an ad. A real Meta ad creative carries EITHER `image_hash` OR
 * `video_data.video_id` — never both (confirmed via Meta's Marketing API "Ad Creative" reference:
 * an image creative and a video creative are mutually-exclusive creative shapes). Unified into one
 * discriminated field here — rather than two independent optional strings on `AdProps` — so a
 * consumer can never observe an invalid "both present" (or ambiguous "which one is real") state
 * the domain doesn't actually have.
 *
 * `Ad.creativeAsset` is `undefined` when Meta's `creative{image_hash,video_id}` expansion returned
 * neither field (e.g. no creative attached yet, or a creative shape — Dynamic Creative, Instant
 * Experience/Canvas, Collection — that uses neither top-level field) — there is simply no asset id
 * to roll up for that ad in that case, not an error.
 */
export type CreativeAsset =
  | { readonly kind: "IMAGE"; readonly imageHash: string }
  | { readonly kind: "VIDEO"; readonly videoId: string };
