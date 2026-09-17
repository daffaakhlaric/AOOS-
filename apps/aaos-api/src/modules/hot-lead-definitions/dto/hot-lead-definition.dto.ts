import { z } from "zod";

/** Mirrors `packages/lead-store/src/domain/value-objects/LeadStatus.ts`'s real `LeadStatus` enum values — read directly before writing this schema, never re-derived/guessed. Kept as a local string-literal list (not an import of the `@aos/lead-store` enum) so this module never depends on that package, per this phase's explicit scope ("do NOT modify `@aos/lead-store`", and by extension keep this brand-new small module free of runtime coupling to it). */
const LEAD_STATUS_VALUES = ["NEW", "COLD", "WARM", "HOT", "ASSIGNED", "CLOSED"] as const;

/** The only 8 fields `evaluateHotLead` can actually evaluate against a real `Lead` — 6 real `LeadQualificationFlags` keys plus `score`/`status`. Deliberately excludes the raw spec's fictional rule fields (`buying_timeline_days`, `reachable`, `area_match`, `budget_match`) — see `054_growth_objectives.sql`'s header doc (b). */
const RULE_FIELDS = [
  "budget",
  "unit",
  "area",
  "payment",
  "timeline",
  "name",
  "score",
  "status",
] as const;

const RULE_OPERATORS = ["=", "!=", "<", "<=", ">", ">="] as const;

const HotLeadRuleSchema = z.object({
  field: z.enum(RULE_FIELDS),
  operator: z.enum(RULE_OPERATORS),
  value: z.union([z.boolean(), z.number(), z.string()]),
});

/** `PUT /api/v1/hot-lead-definitions` body. `mode`-conditional shape enforced via `.refine` (Zod has no native discriminated-union-by-value-with-cross-field-requirement short of this) — `leadStatusValue` required (and a real `LeadStatus` member) when `mode = LEAD_STATUS`, `rules` required (non-empty) when `mode = RULE_BASED`. */
export const PutHotLeadDefinitionBodySchema = z
  .object({
    mode: z.enum(["LEAD_STATUS", "RULE_BASED"]),
    leadStatusValue: z.enum(LEAD_STATUS_VALUES).optional(),
    rules: z.array(HotLeadRuleSchema).optional(),
  })
  .refine((body) => body.mode !== "LEAD_STATUS" || body.leadStatusValue !== undefined, {
    message: "leadStatusValue is required when mode is LEAD_STATUS",
    path: ["leadStatusValue"],
  })
  .refine(
    (body) => body.mode !== "RULE_BASED" || (body.rules !== undefined && body.rules.length > 0),
    {
      message: "rules must be a non-empty array when mode is RULE_BASED",
      path: ["rules"],
    },
  );
export type PutHotLeadDefinitionBodyDto = z.infer<typeof PutHotLeadDefinitionBodySchema>;

export interface HotLeadRuleDto {
  readonly field: (typeof RULE_FIELDS)[number];
  readonly operator: (typeof RULE_OPERATORS)[number];
  readonly value: boolean | number | string;
}

export interface HotLeadDefinitionResponseDto {
  readonly tenantId: string;
  readonly mode: "LEAD_STATUS" | "RULE_BASED";
  readonly leadStatusValue?: string;
  readonly rules?: readonly HotLeadRuleDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Row shape this mapper accepts — structurally compatible with `HotLeadDefinitionRow` (keeps `dto/` free of an infra-layer import, same layering `growth-objective.dto.ts` keeps). */
export interface HotLeadDefinitionRowLike {
  readonly tenant_id: string;
  readonly mode: string;
  readonly lead_status_value: string | null;
  readonly rules: unknown;
  readonly created_at: string;
  readonly updated_at: string;
}

export function toHotLeadDefinitionResponseDto(
  row: HotLeadDefinitionRowLike,
): HotLeadDefinitionResponseDto {
  return {
    tenantId: row.tenant_id,
    mode: row.mode as HotLeadDefinitionResponseDto["mode"],
    ...(row.lead_status_value !== null ? { leadStatusValue: row.lead_status_value } : {}),
    ...(row.rules !== null && row.rules !== undefined
      ? { rules: row.rules as readonly HotLeadRuleDto[] }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
