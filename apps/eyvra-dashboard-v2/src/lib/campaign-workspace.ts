import type { ActivityDto, CreativePackageDto } from "@/types/dashboard.types";
export interface CampaignLead {
  id: string;
  status: string;
  temperature: string;
  score: number;
  createdAt: string;
  contacted: boolean;
  qualifiedAt?: string;
}
/**
 * Real, already-fetched `AbTestResponseDto` shape (`apps/aaos-api/.../abtesting/dto/
 * ab-test-response.dto.ts`) — the workspace route (`app/api/campaigns/[campaignId]/workspace/
 * route.ts`) forwards `/api/v1/abtesting` responses straight through with only a `campaignId`
 * filter, so every field below is already present on the wire today; widening this interface adds
 * zero new backend calls or computation, it only stops the TypeScript type from dropping fields the
 * response already carries. `rphLead` (Rp per real lead) is the REAL primary metric
 * `decideWinner`/`monitorRunningTests` evaluate winners on server-side — present it honestly as
 * that, never relabeled as "CPQL"/"Hot Lead Rate" (no CRM-stage data backs those here).
 */
export interface CampaignExperiment {
  id: string;
  name: string;
  campaignId: string;
  adSetId?: string;
  status: string;
  thresholdSpend: number;
  thresholdDays: number;
  minMarginPct: number;
  autoPauseLoser?: boolean;
  autoScaleWinner?: boolean;
  winnerVariantId?: string;
  /** Real Rp/lead of the declared winner — undefined until a winner exists. */
  winnerRphLead?: number;
  /** Real rounded % the winner beat the runner-up's Rp/lead by — undefined until a winner exists. */
  improvementPct?: number;
  startedAt?: string;
  completedAt?: string;
  failedReason?: string;
  createdAt: string;
  variants: {
    id: string;
    variantLabel: string;
    angle: string;
    status: string;
    creativePackageId: string;
    metaAdId?: string;
    spend: number;
    impressions?: number;
    clicks?: number;
    conversations?: number;
    leads: number;
    /** Real Rp/lead for this variant; undefined/null when it has no leads yet. */
    rphLead?: number;
    ctr?: number;
    lastSyncedAt?: string;
    imageUrl?: string;
    videoUrl?: string;
    primaryText?: string;
    headline?: string;
  }[];
}
export interface CampaignPackage extends CreativePackageDto {
  adId?: string;
  listingId?: string;
  briefId: string;
  angle: string;
  reason: string;
  primaryMessage: string;
  fatigueStatus: string;
  publishedMetaAdIds?: string[];
  generatedAt?: string;
  reviewedAt?: string;
  copyVariants: { id: string; variantLabel: string; primaryText: string; headline: string }[];
}
export interface CampaignActivity extends ActivityDto {
  input?: unknown;
  output?: unknown;
}
export interface WorkspaceData {
  leads?: CampaignLead[];
  tests?: CampaignExperiment[];
  packages?: CampaignPackage[];
  activities?: CampaignActivity[];
  listingId?: string | null;
  errors: string[];
}
/** Exact structured references only: campaign names and substrings are not reliable attribution. */
export function referencesCampaign(value: unknown, campaignId: string): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((v) => referencesCampaign(v, campaignId));
  return Object.entries(value).some(
    ([key, v]) =>
      (["campaignId", "campaign_id", "metaCampaignId"].includes(key) && v === campaignId) ||
      referencesCampaign(v, campaignId),
  );
}
export function linkedPackages(
  packages: CampaignPackage[],
  adIds: string[],
  tests: CampaignExperiment[],
  listingId?: string | null,
) {
  const packageIds = new Set(
    tests.flatMap((test) => test.variants.map((v) => v.creativePackageId)),
  );
  return packages.filter(
    (pkg) =>
      packageIds.has(pkg.id) ||
      (pkg.adId && adIds.includes(pkg.adId)) ||
      pkg.publishedMetaAdIds?.some((id) => adIds.includes(id)) ||
      (listingId && pkg.listingId === listingId),
  );
}
export function experimentProgress(test: CampaignExperiment, now = Date.now()) {
  const spend = test.variants.length ? Math.min(...test.variants.map((v) => v.spend)) : 0;
  const days = test.startedAt ? Math.max(0, (now - Date.parse(test.startedAt)) / 86400000) : 0;
  return Math.round(
    Math.min(
      1,
      test.thresholdSpend > 0 ? spend / test.thresholdSpend : 0,
      test.thresholdDays > 0 ? days / test.thresholdDays : 0,
    ) * 100,
  );
}

export function recordedChanges(
  value: unknown,
): { metric: string; before: string | number; after: string | number }[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  const before = record.before;
  const after = record.after;
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
  const old = before as Record<string, unknown>,
    current = after as Record<string, unknown>;
  return ["dailyBudget", "daily_budget", "budget", "spend", "cpl", "ctr", "status"].flatMap(
    (metric) => {
      const a = old[metric],
        b = current[metric];
      return (typeof a === "number" || typeof a === "string") &&
        (typeof b === "number" || typeof b === "string")
        ? [{ metric, before: a, after: b }]
        : [];
    },
  );
}
