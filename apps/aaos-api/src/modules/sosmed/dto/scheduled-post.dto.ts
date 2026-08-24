import { z } from "zod";

/**
 * `POST/PUT/GET/DELETE /api/v1/sosmed/posts*` request/response DTOs (AAOS-SOSMED-AUTOMATION
 * Phase 3 — the scheduler + Post Manager, still no OAuth). Field-level docs below follow the same
 * "be honest about what's real" discipline `SosmedPublishingService`'s doc comments already
 * established in Phase 2.
 */

const MediaTypeEnum = z.enum(["IMAGE", "VIDEO", "CAROUSEL"]);
const ContentTypeEnum = z.enum(["PROMO", "EDUKASI", "TESTIMONI", "BTS", "TIPS", "MARKET_UPDATE"]);
const CreatableStatusEnum = z.enum(["DRAFT", "SCHEDULED"]);
const AnyPostStatusEnum = z.enum([
  "DRAFT",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
]);

/**
 * A manager-pasted Page/IG access token + the platform id it targets — accepted here because there
 * is no `sosmed_accounts` row to resolve one from yet (no OAuth flow exists anywhere in this
 * codebase — that's Phase 4). This is NEVER written to the `scheduled_posts` row (that table has
 * no `access_token` column — see `supabase/migrations/014_sosmed.sql` — and adding one would
 * reopen the exact credential-custody question the coordinator note flags for
 * `sosmed_accounts.access_token`, for a table this phase deliberately keeps out of that
 * discussion). It is held only in-process, by `PendingAccessTokenStore` (see that file's docstring
 * for the full reasoning) — lost on every restart/redeploy, never logged, never persisted to
 * Supabase. Supplying it here is what lets `SosmedSchedulerService`'s unattended `@Cron` loop
 * actually publish a `SCHEDULED` post later; omitting it is fine too — `POST .../publish-now`
 * accepts the same shape fresh, for a manager sitting at the Post Manager UI right now.
 */
const PublishTargetSchema = z.discriminatedUnion("platform", [
  z.object({
    platform: z.literal("FACEBOOK"),
    pageId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1),
  }),
  z.object({
    platform: z.literal("INSTAGRAM"),
    igUserId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1),
  }),
]);
export type PublishTargetDto = z.infer<typeof PublishTargetSchema>;

export const CreateScheduledPostBodySchema = z
  .object({
    caption: z.string().trim().min(1),
    mediaUrl: z.string().trim().url().optional(),
    mediaType: MediaTypeEnum.optional(),
    hashtags: z.array(z.string().trim().min(1)).optional(),
    contentType: ContentTypeEnum.optional(),
    productId: z.string().trim().min(1).optional(),
    angle: z.string().trim().min(1).optional(),
    /** `sosmed_accounts.id` this post targets — no such rows exist yet (no OAuth), so this is always `undefined` in practice this phase; accepted anyway so the field is ready once Phase 4 lands. */
    accountId: z.string().trim().min(1).optional(),
    generatedBy: z.string().trim().min(1).optional(),
    kaiPackageId: z.string().trim().min(1).optional(),
    scheduledAt: z.string().trim().datetime().optional(),
    status: CreatableStatusEnum.default("DRAFT"),
    publishTarget: PublishTargetSchema.optional(),
  })
  .refine((body) => body.status !== "SCHEDULED" || body.scheduledAt !== undefined, {
    message: "scheduledAt wajib diisi ketika status SCHEDULED.",
    path: ["scheduledAt"],
  });
export type CreateScheduledPostBodyDto = z.infer<typeof CreateScheduledPostBodySchema>;

export const UpdateScheduledPostBodySchema = z.object({
  caption: z.string().trim().min(1).optional(),
  mediaUrl: z.string().trim().url().optional(),
  mediaType: MediaTypeEnum.optional(),
  hashtags: z.array(z.string().trim().min(1)).optional(),
  contentType: ContentTypeEnum.optional(),
  productId: z.string().trim().min(1).optional(),
  angle: z.string().trim().min(1).optional(),
  accountId: z.string().trim().min(1).optional(),
  scheduledAt: z.string().trim().datetime().optional(),
  status: AnyPostStatusEnum.optional(),
  publishTarget: PublishTargetSchema.optional(),
});
export type UpdateScheduledPostBodyDto = z.infer<typeof UpdateScheduledPostBodySchema>;

export const ListScheduledPostsQuerySchema = z.object({
  status: AnyPostStatusEnum.optional(),
});
export type ListScheduledPostsQueryDto = z.infer<typeof ListScheduledPostsQuerySchema>;

/**
 * `POST /api/v1/sosmed/posts/:id/publish-now` — optional. When supplied, this exact fresh
 * token+target is used ONCE for this call and never stored anywhere (not even
 * `PendingAccessTokenStore`). When omitted, `SosmedPostsService.publishNow` falls back to whatever
 * `publishTarget` was supplied at create/update time — the same fallback `SosmedSchedulerService`'s
 * `@Cron` loop relies on, since nothing types a token in at 3am.
 */
export const PublishNowBodySchema = PublishTargetSchema.optional();
export type PublishNowBodyDto = z.infer<typeof PublishNowBodySchema>;
