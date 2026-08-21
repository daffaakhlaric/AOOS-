import { TargetPersona } from "@aos/meta-ads-agent";
import { Branch } from "@aos/meta-ads-connector";
import { z } from "zod";

/**
 * `POST /api/v1/abtesting` — the "Buat A/B Test Baru" modal's payload, Mode Auto only (spec's
 * Mode Manual, where the manager supplies each variant's creative directly, is out of scope for
 * this pass — documented deferral, not a silent gap).
 *
 * Reuses the SAME brief fields `CreatePackageBodySchema` already validates (`unit`/`branch`/
 * `targetPersona`/`primaryMessage`/`format`/`urgency`) since each variant really is one
 * `CreativePackagesService.create({ generate: true })` call with only `angle` (and `title`)
 * overridden per variant — see coordinator note section 2.
 *
 * `waLink` is a manager-supplied `wa.me` link for an `IMAGES_ONLY`-decided variant's ad creative
 * (`CreateAdCreativeImageSpec.linkUrl`) — Go Live's own `resolveWaLink` derives this from
 * `waba_configs` by branch, but that lookup is tied to a `simulations` row this flow has none of;
 * asking the manager for the link directly is honest and avoids duplicating that branch-resolution
 * logic for a case (image-only AB variant) Go Live itself only reaches as a fallback.
 */
export const CreateAbTestBodySchema = z.object({
  name: z.string().trim().min(1),
  campaignId: z.string().trim().min(1),
  adSetId: z.string().trim().min(1),
  pageId: z.string().trim().min(1),
  waLink: z.string().trim().url(),
  mode: z.literal("AUTO").default("AUTO"),
  variantCount: z.union([z.literal(2), z.literal(3)]).default(2),

  // Brief fields, one per generated variant (only `angle` differs per variant).
  unit: z.string().trim().min(1),
  unitModel: z.string().trim().min(1).optional(),
  branch: z.nativeEnum(Branch),
  targetPersona: z.nativeEnum(TargetPersona).default(TargetPersona.PRIMARY_FAMILY),
  primaryMessage: z.string().trim().min(1),
  format: z.enum(["VIDEO_AND_IMAGES", "IMAGES_ONLY"]),
  urgency: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),

  // Threshold config (spec's "Buat A/B Test Baru" modal).
  thresholdSpend: z.number().int().positive().default(100_000),
  thresholdDays: z.number().int().positive().default(3),
  minMarginPct: z.number().positive().max(100).default(20),
  autoPauseLoser: z.boolean().default(true),
  autoScaleWinner: z.boolean().default(true),
});
export type CreateAbTestBodyDto = z.infer<typeof CreateAbTestBodySchema>;

export const ListAbTestsQuerySchema = z.object({
  status: z.enum(["DRAFT", "RUNNING", "COMPLETE", "PAUSED", "FAILED"]).optional(),
});
export type ListAbTestsQueryDto = z.infer<typeof ListAbTestsQuerySchema>;
