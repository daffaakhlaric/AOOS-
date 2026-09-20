import { ImageModel } from "./ImageModel.js";
import { VideoModel } from "./VideoModel.js";

/**
 * Minimal, HONEST static registry of the real generation models this codebase actually calls
 * (PROMPT 48, scoped down from the spec's dynamic-registry vision — see Phase 27's audit). Only
 * `ImageModel.NANO_BANANA_PRO`, `VideoModel.VEO3`, and `VideoModel.VEO3_FAST` exist today; this
 * registry does NOT add `capabilities[]`, `scores`, or a dynamic `status` field, since fabricating
 * that flexibility for a 3-model set would misrepresent what this codebase can actually do.
 */

/** Which generation pipeline a model belongs to. */
export type GenerationModelKind = "IMAGE" | "VIDEO";

/**
 * Relative generation speed, known honestly only for the two video models: `VEO3_FAST` is named
 * for being the faster/cheaper variant, and is already this codebase's default/non-HIGH-urgency
 * choice (see `FormatDecider`/`PropertyFormatDecider`). `ImageModel.NANO_BANANA_PRO` has no known
 * relative-speed comparator (it's the only image model), so it carries no `speedTier`.
 */
export type SpeedTier = "FAST" | "STANDARD";

/** One registry entry: a real model value plus only the honestly-known attributes about it. */
export interface GenerationModelEntry {
  readonly kind: GenerationModelKind;
  readonly value: ImageModel | VideoModel;
  readonly speedTier?: SpeedTier;
}

/** The 3 real models this codebase calls, in Kie AI API terms — see each field's own docstring. */
export const GENERATION_MODEL_REGISTRY: readonly GenerationModelEntry[] = [
  { kind: "IMAGE", value: ImageModel.NANO_BANANA_PRO },
  { kind: "VIDEO", value: VideoModel.VEO3, speedTier: "STANDARD" },
  { kind: "VIDEO", value: VideoModel.VEO3_FAST, speedTier: "FAST" },
];

/**
 * The urgency-equivalent tier `resolveVideoModel` routes on — matches `CreativeUrgency`
 * (`packages/meta-ads-agent/src/types/AgentTypes.ts`) structurally. Not imported directly: this
 * package has no dependency on `@aos/meta-ads-agent`, and the PROPERTY vertical's
 * `PropertyFormatDecider` derives this same tier from `PropertyAdAngle` rather than a real
 * `urgency` field (see its `ANGLE_URGENCY` map) — a shared structural type keeps both callers
 * honest without a cross-package dependency.
 */
export type VideoUrgencyTier = "HIGH" | "MEDIUM" | "LOW";

/**
 * PROMPT 50 — GENERATION QUALITY TIERS, scoped down from the spec's tenant-plan-gated vision (see
 * Phase 27's audit, confirmed still accurate: grepping `apps/aaos-api/src/` and every migration
 * under `apps/aaos-api/supabase/migrations/` for `tenantPlan|subscriptionTier|billingPlan|
 * tenant_plan` returns zero hits — there is no real, persisted tenant-plan/billing concept
 * anywhere in this codebase). Fabricating one just to gate these tiers would invent a whole new
 * entitlement system far beyond this phase's scope, so these tiers are NOT tenant-plan-limited —
 * they're a plain, opt-in quality-tier-to-model mapping over the 3 real models above, ready for a
 * future phase (e.g. PROMPT 51's mass generation) to consume.
 *
 * Only a VIDEO lever exists honestly today: `DRAFT` picks the faster/cheaper `VEO3_FAST`,
 * `PREMIUM` picks the higher-quality `VEO3` explicitly (regardless of urgency), and `STANDARD`
 * means "no override" — defer to the existing urgency-based `resolveVideoModel` behavior below,
 * unchanged. There is deliberately NO image-tier mapping: `GENERATION_MODEL_REGISTRY` has exactly
 * one real image model (`ImageModel.NANO_BANANA_PRO`), so no tier can honestly change image
 * quality/cost today — inventing a fake "cheap image model" to fill out DRAFT would misrepresent
 * what this codebase can actually do.
 */
export enum GenerationQualityTier {
  DRAFT = "DRAFT",
  STANDARD = "STANDARD",
  PREMIUM = "PREMIUM",
}

/**
 * Resolves which `VideoModel` a given urgency-equivalent tier should use, reading the registry's
 * `speedTier` instead of an inline ternary. Behavior-preserving refactor of the two identical
 * ternaries this replaces (`FormatDecider.decideVideoSpec`, `PropertyFormatDecider.decideVideoSpec`
 * before this change): HIGH urgency gets the higher-quality `STANDARD`-speed `VEO3`; MEDIUM/LOW
 * both get the faster `VEO3_FAST` — unchanged from the prior `urgency === "HIGH" ? VEO3 : VEO3_FAST`
 * logic.
 *
 * `qualityTier` (PROMPT 50) is a new, OPTIONAL second parameter, purely additive: every existing
 * caller (`FormatDecider.decideVideoSpec`, `PropertyFormatDecider.decideVideoSpec`) calls this
 * with just `urgency` and is completely unaffected. When a caller opts in with `DRAFT` or
 * `PREMIUM`, that tier OVERRIDES the urgency-based choice outright; `STANDARD` (or omitting the
 * parameter) leaves the pre-existing urgency-based logic exactly as it was.
 */
export function resolveVideoModel(
  urgency: VideoUrgencyTier,
  qualityTier?: GenerationQualityTier,
): VideoModel {
  if (qualityTier === GenerationQualityTier.DRAFT) {
    return VideoModel.VEO3_FAST;
  }
  if (qualityTier === GenerationQualityTier.PREMIUM) {
    return VideoModel.VEO3;
  }
  const desiredSpeedTier: SpeedTier = urgency === "HIGH" ? "STANDARD" : "FAST";
  const entry = GENERATION_MODEL_REGISTRY.find(
    (candidate) => candidate.kind === "VIDEO" && candidate.speedTier === desiredSpeedTier,
  );
  /* v8 ignore next 5 -- unreachable: the registry above always contains exactly one VIDEO entry
   * per SpeedTier ("STANDARD" for VEO3, "FAST" for VEO3_FAST), so a matching entry always exists. */
  if (!entry) {
    throw new Error(
      `resolveVideoModel: no registered VIDEO model for speedTier "${desiredSpeedTier}"`,
    );
  }
  return entry.value as VideoModel;
}
