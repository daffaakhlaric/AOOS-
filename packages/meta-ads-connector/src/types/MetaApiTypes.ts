import { z } from "zod";

/**
 * Raw Meta Graph API v21.0 response shapes plus their Zod validators. Every field Meta reports
 * as a metric is a numeric-looking *string* (Graph API convention), so schemas below intentionally
 * keep those as `z.string()` — parsing to `number` happens later in `mappers/`, past the
 * "validated with Zod before use" boundary these schemas exist to enforce.
 */

export const MetaActionSchema = z.object({
  action_type: z.string(),
  value: z.string(),
});
export type MetaAction = z.infer<typeof MetaActionSchema>;

/** One row of `insights.date_preset(last_30d){...}` — Meta always wraps insights in an edge with a `data` array, even though AAOS only ever requests a single aggregated row. */
export const MetaInsightRowSchema = z.object({
  spend: z.string().optional(),
  impressions: z.string().optional(),
  reach: z.string().optional(),
  frequency: z.string().optional(),
  clicks: z.string().optional(),
  actions: z.array(MetaActionSchema).optional(),
  /** Separate top-level metric Meta reports alongside `actions[]`; used as a fallback source for D1/conversations — see `utils/D3Calculator.ts`. */
  messaging_conversation_started: z.string().optional(),
});
export type MetaInsightRow = z.infer<typeof MetaInsightRowSchema>;

export const MetaInsightsEdgeSchema = z.object({
  data: z.array(MetaInsightRowSchema),
});
export type MetaInsightsEdge = z.infer<typeof MetaInsightsEdgeSchema>;

export const MetaPagingSchema = z.object({
  cursors: z
    .object({
      before: z.string().optional(),
      after: z.string().optional(),
    })
    .optional(),
  next: z.string().optional(),
  previous: z.string().optional(),
});
export type MetaPaging = z.infer<typeof MetaPagingSchema>;

/**
 * `created_time` is not in the spec's literal campaign field-selector list, but is included here
 * (and requested by `MetaApiRequestBuilder`) because the AAOS `Campaign` domain entity requires a
 * `createdAt: Date` — a deliberate, documented deviation (see README "Deviations from spec").
 */
export const MetaCampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  objective: z.string(),
  status: z.string(),
  created_time: z.string().optional(),
  insights: MetaInsightsEdgeSchema.optional(),
});
export type MetaCampaign = z.infer<typeof MetaCampaignSchema>;

export const MetaCampaignListResponseSchema = z.object({
  data: z.array(MetaCampaignSchema),
  paging: MetaPagingSchema.optional(),
});
export type MetaCampaignListResponse = z.infer<typeof MetaCampaignListResponseSchema>;

/**
 * `targeting` (AAOS Analytics Platform Phase 3, "AdSet targeting gap" scope extension). Verified
 * (2026-08-31, Meta Marketing API "Targeting Specs" / "Flexible Targeting" references, no live
 * call available in this environment): unlike `creative` (Phase 2), `targeting` is NOT an edge —
 * it is a plain JSON object field already returned in full whenever requested bare as `targeting`
 * in the `fields` param, so `MetaApiRequestBuilder` requests it WITHOUT the `field{subfields}`
 * expansion syntax `creative{image_hash,video_id}` needed.
 *
 * Real, honest, documented shape gap found during verification: Meta's targeting-spec
 * `custom_audiences[]` entries (both on write, per the "Targeting Specs" reference's own
 * `[{'id': 123}]` example, and on read, which echoes the same stored spec back) carry only `id`
 * (and sometimes `name`) — NEVER `subtype`. `subtype` (`CUSTOM`/`LOOKALIKE`/`WEBSITE`/...) is a
 * property of the separate Custom Audience node itself (`GET /{custom-audience-id}?fields=subtype`),
 * not embedded in an ad set's targeting reference. Resolving true LOOKALIKE-vs-RETARGETING-vs-
 * CUSTOM_CRM distinction would require a further per-referenced-ID lookup call — a genuine,
 * separate scope (an N+1/fan-out concern this package's own rate-limiter discipline argues against
 * adding casually to this additive field-only extension) — left as a further, honestly-flagged
 * follow-up exactly like `AudienceClassifier.ts`'s own pre-existing top-of-file gap note. Every
 * `custom_audiences[]` entry pulled here is therefore mapped with `subtype: undefined`, which
 * `classifyAudience`'s own already-designed "any subtype this classifier doesn't otherwise
 * recognize → CUSTOM_CRM" fallback rule (bucket 3) handles correctly today — BROAD/INTEREST/
 * CUSTOM_CRM are now fully and correctly wired to real data; only the LOOKALIKE_1/RETARGETING
 * sub-distinction among custom-audience-targeted ad sets remains gapped pending that follow-up.
 *
 * `flexible_spec[].interests[]` real shape (`{id, name}`) is confirmed via Meta's own "Flexible
 * Targeting" reference and matches `AudienceClassifier.ts`'s pre-existing `AudienceTargetingInterest`
 * shape exactly — reused as-is, no new interest type invented.
 */
export const MetaAdSetTargetingCustomAudienceSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});
export type MetaAdSetTargetingCustomAudience = z.infer<
  typeof MetaAdSetTargetingCustomAudienceSchema
>;

export const MetaAdSetTargetingInterestSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type MetaAdSetTargetingInterest = z.infer<typeof MetaAdSetTargetingInterestSchema>;

export const MetaAdSetTargetingFlexibleSpecEntrySchema = z.object({
  interests: z.array(MetaAdSetTargetingInterestSchema).optional(),
});
export type MetaAdSetTargetingFlexibleSpecEntry = z.infer<
  typeof MetaAdSetTargetingFlexibleSpecEntrySchema
>;

/** The subset of Meta's real `targeting` spec object this package reads — see this file's own gap note above. Meta's real object carries many more fields (`geo_locations`, `age_min`, `genders`, ...) this package has no use for; `z.object` silently ignores unrecognized keys rather than requiring them all modeled here. */
export const MetaAdSetTargetingSchema = z.object({
  custom_audiences: z.array(MetaAdSetTargetingCustomAudienceSchema).optional(),
  flexible_spec: z.array(MetaAdSetTargetingFlexibleSpecEntrySchema).optional(),
});
export type MetaAdSetTargeting = z.infer<typeof MetaAdSetTargetingSchema>;

/**
 * `learning_stage_info` — Meta's real adset-level Learning Phase indicator (AAOS Samantha
 * Professional Optimizer scope). Verified against Meta's Marketing API "Ad Set" reference: a plain
 * JSON object field (not an edge, same convention as `targeting` above — requested bare, no
 * `field{subfields}` expansion needed). Real documented shape: `status` (one of
 * `LEARNING`/`LEARNING_LIMITED`/`SUCCESS`), `ad_set_id`, `conversions`, `allow_lookalike_expansion`.
 * This package only has a real use for `status` — the other 3 fields are accepted-but-ignored
 * (`z.object` silently ignores unmodeled keys), same "only model what we actually read" discipline
 * `MetaAdSetTargetingSchema` already establishes.
 *
 * Honest absence: the WHOLE `learning_stage_info` object can legitimately be absent from Meta's
 * response — a brand-new adset with zero real delivery yet, or one that predates Meta's own
 * learning-phase tracking, never returns this field at all (not `{}`, not a `null` — genuinely
 * omitted). `.optional()` on the object itself (not just its inner fields) models that honestly;
 * `status` also stays a loose `z.string()` here (validated against the real 3-member vocabulary
 * later, in `mappers/AdSetMapper.ts`) so an unrecognized future Meta status value degrades to
 * `undefined` rather than failing the whole adset parse closed.
 */
export const MetaAdSetLearningStageInfoSchema = z.object({
  status: z.string().optional(),
});
export type MetaAdSetLearningStageInfo = z.infer<typeof MetaAdSetLearningStageInfoSchema>;

export const MetaAdSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  /** Meta budget fields are IDR *cents* — see `utils/CurrencyUtils.ts` for the conversion to whole Rupiah. */
  daily_budget: z.string().optional(),
  targeting: MetaAdSetTargetingSchema.optional(),
  insights: MetaInsightsEdgeSchema.optional(),
  learning_stage_info: MetaAdSetLearningStageInfoSchema.optional(),
});
export type MetaAdSet = z.infer<typeof MetaAdSetSchema>;

export const MetaAdSetListResponseSchema = z.object({
  data: z.array(MetaAdSetSchema),
  paging: MetaPagingSchema.optional(),
});
export type MetaAdSetListResponse = z.infer<typeof MetaAdSetListResponseSchema>;

/**
 * `creative{image_hash,video_id}` nested-field-expansion response (AAOS Analytics Platform Phase
 * 2, "Asset-First Analytics"). Both fields are `.optional()`: Meta only ever populates one of the
 * two (an ad's creative is an image XOR a video — see `domain/value-objects/CreativeAsset.ts`),
 * and either can also be entirely absent (creative shapes that use neither field, or no creative
 * attached). The `creative` object itself can also come back `{}` for such an ad rather than
 * being omitted, hence both inner fields optional rather than the whole object being enough.
 */
/**
 * `object_story_spec.link_data` — Meta's real single-creative (non-Dynamic-Creative) ad-copy shape
 * (AAOS Samantha Professional Optimizer, Part B). Verified against Meta's Marketing API "Ad
 * Creative" reference: `object_story_spec` is a real field on the `AdCreative` node (same node
 * `image_hash`/`video_id` already read from), and `link_data` is its real sub-object for a
 * link/website-destination ad — `message` (primary text), `name` (headline), `description` (the
 * real Meta field names, not renamed here) are its real, individually-optional text fields.
 *
 * Honest, DOCUMENTED scope boundary: this is the ONE real ad-copy shape this package covers.
 * Explicitly NOT covered (left absent/`undefined` rather than guessed at): a Dynamic Creative ad's
 * `asset_feed_spec.bodies[]/titles[]/descriptions[]` (multiple text options, a materially different
 * nested-array shape), and a video-only/other funnel creative that carries no `link_data` at all
 * (e.g. `video_data`-based object_story_spec). An ad using either of those real shapes simply
 * returns `primaryText`/`headline`/`description` all `undefined` from `mapCreativeText` — a real,
 * honest degrade, never a fabricated empty-string placeholder standing in for text Meta didn't
 * actually return in this shape.
 */
export const MetaAdCreativeLinkDataSchema = z.object({
  message: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});
export type MetaAdCreativeLinkData = z.infer<typeof MetaAdCreativeLinkDataSchema>;

export const MetaAdCreativeObjectStorySpecSchema = z.object({
  link_data: MetaAdCreativeLinkDataSchema.optional(),
});
export type MetaAdCreativeObjectStorySpec = z.infer<typeof MetaAdCreativeObjectStorySpecSchema>;

export const MetaAdCreativeSchema = z.object({
  image_hash: z.string().optional(),
  video_id: z.string().optional(),
  object_story_spec: MetaAdCreativeObjectStorySpecSchema.optional(),
});
export type MetaAdCreative = z.infer<typeof MetaAdCreativeSchema>;

export const MetaAdSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  created_time: z.string(),
  creative: MetaAdCreativeSchema.optional(),
  insights: MetaInsightsEdgeSchema.optional(),
});
export type MetaAd = z.infer<typeof MetaAdSchema>;

export const MetaAdListResponseSchema = z.object({
  data: z.array(MetaAdSchema),
  paging: MetaPagingSchema.optional(),
});
export type MetaAdListResponse = z.infer<typeof MetaAdListResponseSchema>;

/**
 * Meta Graph API "Field Expansion" response shapes (developers.facebook.com/docs/graph-api/
 * guides/field-expansion) — the N+1-fanout fix (real, currently-broken-in-production "User
 * request limit reached" incident). Instead of `PullCampaignData` issuing one `getCampaigns` call
 * then a separate `getAdSets` call per campaign then a separate `getAds` call per adset (an
 * account with 20 campaigns × 3 adsets ≈ 81 sequential real Meta calls for ONE pull), a single
 * `campaigns?fields=...,adsets.limit(N){...,ads.limit(M){...}}` request asks Meta to inline the
 * whole campaign→adset→ad tree (each level's own `insights` included) in one HTTP round trip.
 * This is Meta's own documented, recommended pattern for exactly this N+1 problem — not a hack.
 *
 * Each nested edge (`adsets`, `ads`) is requested with its own `.limit(N)` pagination modifier and
 * comes back with its own `paging` object, exactly like a top-level edge — so a campaign/adset
 * whose real child count exceeds that page size is honestly detectable (`paging.next` present)
 * rather than silently dropped. `PullCampaignData`'s `extractOrFetch` helper (see
 * `meta-api-call-helpers.ts`) is the real, honest fallback for that overflow case: it re-fetches
 * that one campaign's/adset's full child list via the pre-existing dedicated `getAdSets`/`getAds`
 * paginated edge calls, so a >N-adset campaign or >N-ad adset never loses data — the fanout this
 * fix eliminates is only ever paid again for the rare overflowing branch, not the whole tree.
 *
 * `MetaAdSetExpandedSchema`/`MetaCampaignExpandedSchema` are `.extend()`-ed from the pre-existing
 * flat `MetaAdSetSchema`/`MetaCampaignSchema` (this file, above) — every field the flat schemas
 * already validate is unchanged; only the new nested edge field is added. This keeps
 * `MetaResponseMapper.mapCampaigns`/`mapAdSets`/`mapAds` (which only ever read the flat fields)
 * fully reusable, unmodified, against the expanded rows — the real domain-entity output shape
 * (`Campaign`/`AdSet`/`Ad`) is byte-for-byte unchanged by this HTTP-shape optimization.
 */
export const MetaAdSetExpandedSchema = MetaAdSetSchema.extend({
  ads: MetaAdListResponseSchema.optional(),
});
export type MetaAdSetExpanded = z.infer<typeof MetaAdSetExpandedSchema>;

export const MetaAdSetExpandedEdgeSchema = z.object({
  data: z.array(MetaAdSetExpandedSchema),
  paging: MetaPagingSchema.optional(),
});
export type MetaAdSetExpandedEdge = z.infer<typeof MetaAdSetExpandedEdgeSchema>;

export const MetaCampaignExpandedSchema = MetaCampaignSchema.extend({
  adsets: MetaAdSetExpandedEdgeSchema.optional(),
});
export type MetaCampaignExpanded = z.infer<typeof MetaCampaignExpandedSchema>;

export const MetaCampaignExpandedListResponseSchema = z.object({
  data: z.array(MetaCampaignExpandedSchema),
  paging: MetaPagingSchema.optional(),
});
export type MetaCampaignExpandedListResponse = z.infer<
  typeof MetaCampaignExpandedListResponseSchema
>;

/** Response of `POST /{ad-id}`, `POST /{adset-id}`, `POST /{campaign-id}` action calls. Meta returns `{ success: true }` for status/field updates. */
export const MetaUpdateResponseSchema = z
  .object({
    success: z.boolean().optional(),
    id: z.string().optional(),
  })
  .refine((v) => v.success !== undefined || v.id !== undefined, {
    message: "Meta update response must contain at least one of `success` or `id`",
  });
export type MetaUpdateResponse = z.infer<typeof MetaUpdateResponseSchema>;

/** Response of `POST /{ad-account}/campaigns` and `POST /{ad-account}/adsets` create calls (AAOS-W1D-S3). Meta always returns `{ id: "<new-object-id>" }` on success. */
export const MetaCreateResponseSchema = z.object({
  id: z.string(),
});
export type MetaCreateResponse = z.infer<typeof MetaCreateResponseSchema>;

/**
 * Response of `GET /{ad_account_id}?fields=name` — the lightweight account-name lookup added for
 * the multi-account pill selector (`docs/PROMPT-AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE.md`
 * coordinator note #6). Deliberately its own tiny schema/request, NOT a byproduct of the full
 * `getCampaigns` pull — fetching the whole campaign tree just to read an account's display name
 * would be wasteful and would count against the same Meta rate limit this app has repeatedly had
 * trouble with.
 */
export const MetaAdAccountResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type MetaAdAccountResponse = z.infer<typeof MetaAdAccountResponseSchema>;

/**
 * One row of `GET /search?type=adinterest&q=<term>` (AAOS-SIMULASI-TARGETING). Built against a
 * REAL, live response captured 2026-08-18 (`q=automotive`):
 *
 * ```json
 * {"id":"6003304550260","name":"Automotive industry (industry)",
 *  "audience_size_lower_bound":386766403,"audience_size_upper_bound":454837290,
 *  "path":["Interests","Additional interests","Automotive industry (industry)"],
 *  "description":null,"topic":"Hobbies and activities"}
 * ```
 *
 * Deliberate nullability/optionality choices, each grounded in the real captured payloads:
 * - `description` really does come back `null` for some interests and `""` for others, so it is
 *   `.nullable()` (and `.optional()`, since Meta omits it entirely on some rows) — never required.
 * - `topic` is present on every captured row but is NOT documented as guaranteed, so it stays
 *   optional rather than failing an otherwise-usable row closed.
 * - `disambiguation_category` appears on some rows only (e.g. brand-vs-concept disambiguation) and
 *   AAOS has no use for it; it is accepted-but-ignored rather than required.
 *
 * Unlike the metric fields above, the two `audience_size_*` bounds really are JSON *numbers* in
 * Meta's search response (not numeric strings), so they are `z.number()`.
 */
export const MetaAdInterestSchema = z.object({
  id: z.string(),
  name: z.string(),
  audience_size_lower_bound: z.number(),
  audience_size_upper_bound: z.number(),
  path: z.array(z.string()),
  description: z.string().nullable().optional(),
  topic: z.string().optional(),
  disambiguation_category: z.string().optional(),
});
export type MetaAdInterest = z.infer<typeof MetaAdInterestSchema>;

/** Response of `GET /search?type=adinterest&q=<term>` — a plain `{ data: [...] }` edge. */
export const MetaAdInterestSearchResponseSchema = z.object({
  data: z.array(MetaAdInterestSchema),
  paging: MetaPagingSchema.optional(),
});
export type MetaAdInterestSearchResponse = z.infer<typeof MetaAdInterestSearchResponseSchema>;

/**
 * One row of `GET /search?type=adgeolocation&location_types=["city"]&q=<name>` (AAOS EPIC S,
 * Phase S2). Verified 2026-09-01 against Meta's Marketing API "Targeting Search" reference
 * (developers.facebook.com/docs/marketing-api/audiences/reference/targeting-search) — no live call
 * available in this environment, so this schema is built against the documented example response
 * shape rather than a captured payload (unlike `MetaAdInterestSchema`'s live-captured rows above;
 * see `tests/helpers/ad-location-fixtures.ts` for the honest provenance note on the fixtures built
 * from this schema):
 *
 * ```json
 * {"key":"2447439","name":"Manhattan","type":"city","country_code":"US",
 *  "country_name":"United States","region":"Kansas","region_id":3859,
 *  "supports_region":true,"supports_city":true}
 * ```
 *
 * Deliberate optionality choices:
 * - `key`, `name`, `type`, `country_code` are the fields the docs' own example and every
 *   cross-checked SDK model (e.g. the Go Marketing API SDK's `AdGeoLocation` struct) agree are
 *   always present — required here.
 * - `region`/`region_id`/`country_name` are documented as present for `city`-type rows but are not
 *   guaranteed for every location type this schema might one day see reused for (e.g. `country`),
 *   so kept optional rather than failing an otherwise-usable row closed.
 * - `supports_region`/`supports_city` are booleans Meta documents but AAOS has no current use for;
 *   accepted-but-optional for the same reason.
 * - `region_id` really is a JSON *number* (not a numeric string) per the documented example, unlike
 *   the metric fields elsewhere in this file.
 */
export const MetaAdLocationSchema = z.object({
  key: z.string(),
  name: z.string(),
  type: z.string(),
  country_code: z.string(),
  country_name: z.string().optional(),
  region: z.string().optional(),
  region_id: z.number().optional(),
  supports_region: z.boolean().optional(),
  supports_city: z.boolean().optional(),
});
export type MetaAdLocation = z.infer<typeof MetaAdLocationSchema>;

/**
 * Response of `GET /search?type=adgeolocation&location_types=["city"]&q=<name>` — a plain
 * `{ data: [...] }` edge, same envelope shape as `MetaAdInterestSearchResponseSchema`. Meta's real
 * API returns `{"data": []}` (never an error) when a query has zero matches, and returns every
 * matching row — undifferentiated except by `region`/`region_id`/`key` — for an ambiguous query
 * that resolves to multiple distinct real places (e.g. multiple same-named cities in different
 * regions); AAOS makes no attempt to auto-disambiguate here (AAOS EPIC S, Phase S2 scope
 * boundary — see `SearchAdLocations`'s own docstring).
 */
export const MetaAdLocationSearchResponseSchema = z.object({
  data: z.array(MetaAdLocationSchema),
  paging: MetaPagingSchema.optional(),
});
export type MetaAdLocationSearchResponse = z.infer<typeof MetaAdLocationSearchResponseSchema>;

/**
 * Response of `POST /{ad-account}/advideos` (AAOS-GO-LIVE) — Meta's real video-upload endpoint,
 * called with a `file_url` pointing at an already-hosted (GCS) video. Meta returns just the new
 * video node's `id`, later referenced as `video_data.video_id` in an ad creative.
 */
export const MetaVideoUploadResponseSchema = z.object({
  id: z.string(),
});
export type MetaVideoUploadResponse = z.infer<typeof MetaVideoUploadResponseSchema>;

/**
 * Response of `POST /{ad-account}/adimages` (AAOS-GO-LIVE) — Meta's real image-upload endpoint.
 * Meta's real response shape keys `images` by the same string the caller uploaded under (the
 * `bytes` field name when uploading raw bytes, or literally the source URL when uploading via
 * `url=` as AAOS does here) — see Meta Marketing API "Ad Image" reference. AAOS never predicts
 * that key; `UploadCreativeAsset` reads whichever single entry comes back.
 */
export const MetaImageUploadResponseSchema = z.object({
  images: z.record(z.string(), z.object({ hash: z.string(), url: z.string() })),
});
export type MetaImageUploadResponse = z.infer<typeof MetaImageUploadResponseSchema>;

/**
 * Response of `POST /act_{ad-account-id}/customaudiences` (AAOS-ABTESTING-LOOKALIKE Part 2) — used
 * both for creating a `subtype: "CUSTOM"` audience and a `subtype: "LOOKALIKE"` audience (Meta
 * models Lookalikes as custom-audience-shaped resources, not a separate endpoint — verified
 * 2026-08-21 against Meta's Marketing API "Custom Audiences"/"Lookalike Audiences" guides). Meta
 * returns just the new node's `id` on success, same shape as `MetaCreateResponseSchema`.
 */
export const MetaCustomAudienceCreateResponseSchema = z.object({
  id: z.string(),
});
export type MetaCustomAudienceCreateResponse = z.infer<
  typeof MetaCustomAudienceCreateResponseSchema
>;

/**
 * Response of `POST /{custom-audience-id}/users` (AAOS-ABTESTING-LOOKALIKE Part 2) — Meta's real
 * hashed-user-upload endpoint. Verified 2026-08-21 (Meta Marketing API "Custom Audiences" guide):
 * Meta reports `num_received`/`num_invalid_entries` plus a `session_id` echoed back. All fields
 * kept optional here — AAOS's real interest is only "did the call succeed" (a non-2xx already
 * short-circuits to `err()` before this schema is even reached), so this stays tolerant of Meta
 * omitting any individual field rather than failing an otherwise-successful upload closed.
 */
export const MetaCustomAudienceUsersResponseSchema = z.object({
  session_id: z.number().optional(),
  num_received: z.number().optional(),
  num_invalid_entries: z.number().optional(),
  audience_id: z.union([z.string(), z.number()]).optional(),
});
export type MetaCustomAudienceUsersResponse = z.infer<typeof MetaCustomAudienceUsersResponseSchema>;

export const MetaErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});
export type MetaErrorResponse = z.infer<typeof MetaErrorResponseSchema>;
