import type { ExecutionAction, VerdictTargetType } from "@aos/meta-ads-connector";
import { z } from "zod";

/** `POST /api/v1/verdicts` body — per the spec's Meta Ads endpoints section. */
export const ExecuteVerdictBodySchema = z.object({
  verdict: z.enum(["PAUSE", "SCALE", "FIX", "REFRESH", "KEEP", "REVIEW"]),
  targetId: z.string().min(1, "targetId must not be empty"),
  targetType: z.enum(["ad", "adset", "campaign"]),
});

export type ExecuteVerdictBodyDto = z.infer<typeof ExecuteVerdictBodySchema>;

/**
 * `POST /api/v1/verdicts` response (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A) — a superset of
 * `@aos/meta-ads-connector`'s `ExecutionResult`, adding `simulated`/the `"SIMULATED"` action for
 * when `ModeGuardService.executeOrSimulate` runs this tenant's DEV-mode path instead of a real
 * Meta API call. `"SIMULATED"` is deliberately NOT added to the connector package's own
 * `ExecutionAction` union — that type belongs to `packages/meta-ads-connector`, which has no
 * concept of per-tenant DEV/LIVE mode; this DTO lives entirely at the `aaos-api` HTTP boundary.
 * `previousValue`/`newValue`/`targetId`/`targetType` are always the real request values — only
 * `action`/`simulated` differ between the two paths, so a DEV-mode caller can still tell exactly
 * what verdict WOULD have been executed, honestly labeled as not having actually happened.
 */
export interface ExecuteVerdictResponseDto {
  readonly action: ExecutionAction | "SIMULATED";
  readonly targetId: string;
  readonly targetType: VerdictTargetType;
  readonly previousValue?: string | number;
  readonly newValue?: string | number;
  readonly simulated: boolean;
}
