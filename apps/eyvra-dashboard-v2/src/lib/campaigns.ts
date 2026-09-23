import type { CampaignSummaryDto, CampaignHealthSummaryEntryDto } from "@/types/dashboard.types";
import { presentLabel } from "./presentation";
import { stripAdNameSuffix } from "./verdict";

export interface PortfolioCampaign extends CampaignSummaryDto {
  createdAt?: string;
  accountId: string;
  accountName: string;
  syncedAt: string;
}
export interface PortfolioResponse {
  campaigns: PortfolioCampaign[];
  errors: string[];
}
export interface HistoryPoint {
  date: string;
  spend: number;
  leads: number;
  ctr: number;
  cpl: number;
  clicks: number;
  impressions: number;
}
export function mapCampaignPortfolioItem(
  campaign: PortfolioCampaign,
  assessment?: CampaignHealthSummaryEntryDto,
) {
  const ads = campaign.adSets.flatMap((set) => set.ads);
  const leads = ads.reduce((sum, ad) => sum + ad.metrics.totalLead, 0);
  const decision = assessment?.decision.decision;
  const state =
    decision === "SCALE"
      ? "Scaling candidate"
      : decision === "NO_ACTION"
        ? "No action needed"
        : decision === "MONITOR"
          ? "Monitoring"
          : assessment?.diagnosis.rootCause === "CREATIVE_FATIGUE"
            ? "Creative refresh"
            : assessment
              ? "Decision required"
              : "Awaiting assessment";
  return {
    campaign,
    assessment,
    name: stripAdNameSuffix(campaign.name),
    leads,
    cpl: leads > 0 ? campaign.spend / leads : undefined,
    budget: campaign.dailyBudget || campaign.adSets.reduce((sum, set) => sum + set.dailyBudget, 0),
    health: assessment?.health.overallStatus ?? "UNKNOWN",
    state,
    issue: assessment?.diagnosis.rootCause
      ? presentLabel(assessment.diagnosis.rootCause)
      : decision === "NO_ACTION"
        ? "Healthy · monitoring"
        : "Waiting for sufficient signals",
    action: decision === "NO_ACTION" || decision === "MONITOR" ? "Monitor" : "Review Plan",
  };
}
export type CampaignView = ReturnType<typeof mapCampaignPortfolioItem>;
