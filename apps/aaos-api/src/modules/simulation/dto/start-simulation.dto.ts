import { PropertyAdAngle } from "@aos/creative-agent";
import { AdAngle } from "@aos/meta-ads-agent";
import { Branch } from "@aos/meta-ads-connector";
import { z } from "zod";

/**
 * `POST /api/v1/simulation/start` request body's `campaigns`/`totals` shape.
 *
 * Real bug fix (identical root cause/fix as `modules/llm/dto/analyze.dto.ts`'s
 * `AnalyzeRequestSchema` — see that file's docstring for the full explanation): this used to
 * mirror `aaos-api`'s OWN internal `GET /api/v1/campaigns` response shape (`CampaignResponseDto`,
 * with `metaId`/campaign-level `funnel`/`branch`/`createdAt`/ad-set-level `dailyBudget`/etc.) on
 * the assumption Step 2 "forwards it verbatim to the real `LlmService.analyze`" — but `LlmService.
 * analyze`'s OWN request schema has the exact same bug, and neither shape is what
 * `apps/aaos-dashboard`'s `SimulationWizardClient.tsx` actually sends: `campaigns:
 * campaignsData?.campaigns ?? []`, i.e. the dashboard's client-safe, trimmed `CampaignSummaryDto[]`
 * (`apps/aaos-dashboard/src/types/dashboard.types.ts`). This schema now mirrors THAT real shape.
 */
const AdMetricsSchema = z.object({
  spend: z.number(),
  frequency: z.number(),
  clicks: z.number(),
  conversations: z.number(),
  d2: z.number(),
  d3: z.number(),
  d5: z.number(),
  leadForm: z.number(),
  totalLead: z.number(),
  rphD3: z.number().nullable(),
  rphLead: z.number().nullable(),
});

const AdSchema = z.object({
  id: z.string(),
  stableId: z.string(),
  name: z.string(),
  status: z.string(),
  funnel: z.string(),
  branch: z.string(),
  verdict: z.string(),
  metrics: AdMetricsSchema,
  daysSinceCreation: z.number().optional(),
});

const AdSetSchema = z.object({
  id: z.string(),
  stableId: z.string(),
  name: z.string(),
  status: z.string(),
  spend: z.number(),
  ads: z.array(AdSchema),
});

const CampaignSchema = z.object({
  id: z.string(),
  stableId: z.string(),
  name: z.string(),
  objective: z.string(),
  status: z.string(),
  spend: z.number(),
  adSets: z.array(AdSetSchema),
});

/** Step 1's objective snapshot — kept as a loose passthrough bag (persisted verbatim for history/status display, not re-validated field-by-field here) rather than duplicating `ObjectiveResponseDto`'s full Zod mirror a third time in this codebase. */
const ObjectiveSnapshotSchema = z.record(z.string(), z.unknown());

/** The ad Step 3 (Kai) should brief — same shape `POST /api/v1/llm/creative-brief`'s `ad` context accepts (`CreativeBriefAdContextSchema` in `modules/llm/dto/creative-brief.dto.ts`), reused via an identical mirror rather than importing that non-exported schema across modules. */
const KaiAdContextSchema = z.object({
  name: z.string().min(1),
  branch: z.nativeEnum(Branch).optional(),
  metrics: z
    .object({
      spend: z.number().optional(),
      frequency: z.number().optional(),
      totalLead: z.number().optional(),
    })
    .partial()
    .optional(),
});

export const StartSimulationBodySchema = z.object({
  objective: ObjectiveSnapshotSchema,
  campaignDataSource: z.enum(["cache", "fresh"]),
  campaigns: z.array(CampaignSchema),
  // Real bug fix: `rphD3`/`rphLead` in the real totals object are `number | null` (division-by-zero
  // safe), same fix as `AnalyzeRequestSchema`'s `TotalsSchema` in `modules/llm/dto/analyze.dto.ts`.
  totals: z.record(z.string(), z.number().nullable()).optional(),
  kaiAd: KaiAdContextSchema,
  kaiAngle: z.nativeEnum(AdAngle).optional(),
  kaiBranch: z.nativeEnum(Branch),
  /**
   * Not validated against `@aos/conversation-simulator`'s real `PersonaId` enum here — aaos-api
   * has no dependency on that package (it belongs to `apps/aaos-simulator`'s domain). An unknown
   * id is instead caught honestly downstream: `apps/aaos-simulator`'s own `/api/simulate` rejects
   * it, and `SimulationService` records that persona's run as a real failure (`ok: false`), never
   * silently dropped or faked as a success.
   */
  personaIds: z.array(z.string().min(1)).min(1, "Pilih minimal 1 persona untuk Clara"),
  branch: z.string().min(1).optional(),
  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — the real `listings.id` the dashboard's Step 1
   * "Pilih Listing" dropdown selected (PROPERTY tenants only; absent/ignored for AUTOMOTIVE). Step
   * 3's `buildPropertyKaiPromptDetail` needs a real listing row to build a `PropertyCreativeBrief`
   * from — never fabricated from `kaiAd`'s automotive Meta-ad fields.
   */
  listingId: z.string().min(1).optional(),
  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — the real `PropertyAdAngle` Step 1's property
   * angle selector chose (PROPERTY tenants only). Kept separate from `kaiAngle` (automotive
   * `AdAngle`) — the two enums are deliberately not unified, see `PropertyAdAngle.ts`'s docstring.
   */
  kaiPropertyAngle: z.nativeEnum(PropertyAdAngle).optional(),
});
export type StartSimulationBodyDto = z.infer<typeof StartSimulationBodySchema>;

export interface StartSimulationResponseDto {
  readonly id: string;
  readonly status: "RUNNING";
}
