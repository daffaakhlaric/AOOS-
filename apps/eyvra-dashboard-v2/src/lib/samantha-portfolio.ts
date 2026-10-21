import type { PortfolioCampaign } from "./campaigns";
import type { CampaignHealthSummaryEntryDto } from "@/types/dashboard.types";

export const SAMANTHA_NAV = [
  ["Overview", "/samantha"],
  ["Campaign Decisions", "/samantha/decisions"],
  ["Creative Intelligence", "/samantha/creative-intelligence"],
  ["Ads Audit", "/samantha/audit"],
  ["Simulation Lab", "/samantha/simulation"],
  ["Chat", "/samantha/chat"],
  ["Settings", "/samantha/settings"],
] as const;
export const DECISION_FILTERS = [
  "Semua",
  "Perlu Aksi",
  "Scaling",
  "Creative",
  "Tracking",
  "Hold",
] as const;
export type DecisionFilter = (typeof DECISION_FILTERS)[number];
export function matchesDecision(entry: CampaignHealthSummaryEntryDto, filter: DecisionFilter) {
  const action = entry.decision.decision;
  switch (filter) {
    case "Perlu Aksi":
      return !["KEEP", "MONITOR", "NO_ACTION"].includes(action);
    case "Scaling":
      return action === "SCALE";
    case "Creative":
      return ["REQUEST_KAI_CREATIVE", "REFRESH"].includes(action);
    case "Tracking":
      return ["WARNING", "CRITICAL"].includes(entry.health.tracking.status);
    case "Hold":
      return ["KEEP", "MONITOR", "NO_ACTION"].includes(action);
    default:
      return true;
  }
}
export function rankDecisions(entries: readonly CampaignHealthSummaryEntryDto[]) {
  const rank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
  return [...entries].sort(
    (a, b) =>
      (rank[b.decision.impact] ?? 0) - (rank[a.decision.impact] ?? 0) ||
      b.decision.confidence - a.decision.confidence,
  );
}
export function portfolioTotals(campaigns: readonly PortfolioCampaign[] | undefined) {
  if (!campaigns) return undefined;
  return {
    spend: campaigns.reduce((sum, c) => sum + c.spend, 0),
    leads: campaigns.reduce(
      (sum, c) =>
        sum + c.adSets.reduce((n, s) => n + s.ads.reduce((v, a) => v + a.metrics.totalLead, 0), 0),
      0,
    ),
  };
}
export interface ReviewEvent {
  id: string;
  eventType: string;
  title: string;
  scheduledAt: string;
  status: string;
  recurrence: string;
  targetId?: string;
}
export function upcomingReviews(events: readonly ReviewEvent[], now: number) {
  return events
    .filter(
      (e) =>
        [
          "SAMANTHA_ANALYZE",
          "TAMARA_ANALYZE",
          "SAMANTHA_INTELLIGENCE_REFRESH",
          "TAMARA_INTELLIGENCE_REFRESH",
        ].includes(e.eventType) &&
        e.status === "PENDING" &&
        Date.parse(e.scheduledAt) >= now,
    )
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
}
