import type { CampaignView } from "./campaigns";
import type { WorkspaceData } from "./campaign-workspace";
import { presentLabel, presentText } from "./presentation";

/** Presentation only. Missing policy, scheduling and sufficiency data remain unknown. */
export function mapLearningGuardian(item: CampaignView) {
  const sets = item.campaign.adSets.filter((s) => s.status === "ACTIVE");
  const learning = sets.filter((s) => s.learningStatus === "LEARNING").length;
  const limited = sets.filter((s) => s.learningStatus === "LEARNING_LIMITED").length;
  const paused = item.campaign.status === "PAUSED";
  const ended = ["ARCHIVED", "DELETED", "ENDED", "COMPLETED"].includes(item.campaign.status);
  const decision = item.assessment?.decision;
  return {
    state: paused
      ? "Campaign Dijeda"
      : ended
        ? "Campaign Selesai"
        : learning
          ? "Learning"
          : limited
            ? "Learning Terbatas"
            : "Belum terkonfirmasi",
    title: paused
      ? "Campaign dijeda. Tinjau sebelum melanjutkan."
      : ended
        ? "Tinjauan akhir performa campaign"
        : learning
          ? "Samantha memantau fase learning campaign ini"
          : "Samantha memantau performa campaign ini",
    description: paused
      ? "Delivery berhenti. Tidak ada optimasi aktif yang dikonfirmasi."
      : ended
        ? "Gunakan hasil campaign untuk meninjau creative dan kualitas lead."
        : learning
          ? `${learning} ad set aktif dilaporkan Meta masih learning. Kebijakan proteksi internal belum terhubung.`
          : "Pantau rekomendasi, bukti, dan kesiapan data sebelum menentukan perubahan.",
    recommendation:
      paused || ended
        ? "Tinjau hasil"
        : decision
          ? decision.decision === "NO_ACTION"
            ? "Tidak ada perubahan"
            : decision.decision === "MONITOR"
              ? "Observasi"
              : presentLabel(decision.decision)
          : "Menunggu assessment",
    confidence: decision ? `${Math.round(decision.confidence * 100)}%` : "Belum tersedia",
    success:
      decision?.monitoringPlan.successConditions.map(presentText).join(" · ") ||
      "Belum ada kondisi yang ditetapkan.",
    rollback:
      decision?.monitoringPlan.rollbackConditions.map(presentText).join(" · ") ||
      "Belum ada kebijakan rollback yang ditetapkan.",
    reviewWindow: decision
      ? `${decision.monitoringPlan.reviewAfterHours} jam setelah tindakan; belum menjadi jadwal.`
      : "Belum ada monitoring plan.",
    learning,
  };
}

export function mapRecentCampaignActivity(data?: WorkspaceData) {
  return [...(data?.activities ?? [])]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      agent: presentLabel(a.agent),
      title: presentLabel(a.actionType),
      at: a.createdAt,
    }));
}

export function mapCampaignDetail(item: CampaignView, data?: WorkspaceData) {
  const ads = item.campaign.adSets.flatMap((s) => s.ads);
  return {
    guardian: mapLearningGuardian(item),
    activity: mapRecentCampaignActivity(data),
    adSets: item.campaign.adSets.length,
    activeAds: ads.filter((ad) => ad.status === "ACTIVE").length,
    ads: ads.length,
    // CRM is lifetime attributed. It must not be mixed with period Meta KPIs or CPQL.
    hotLeads: data?.leads?.filter((l) => l.temperature === "HOT").length,
    hotRate: data?.leads?.length
      ? data.leads.filter((l) => l.temperature === "HOT").length / data.leads.length
      : undefined,
  };
}
