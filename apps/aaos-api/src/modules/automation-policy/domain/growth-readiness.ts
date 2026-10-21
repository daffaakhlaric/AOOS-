import type { GrowthPolicy } from "./growth-policy.js";
/** Capability-specific readiness. CRM is not a prerequisite for Meta-only operations. */
export function growthReadiness(
  p: GrowthPolicy,
  facts: { metaConfigured: boolean; schedulerEnabled: boolean; creativeConfigured: boolean },
) {
  const actions = [
    {
      key: "ANALYZE",
      label: "Analisis campaign",
      available: facts.metaConfigured && facts.schedulerEnabled,
      execution: "SCHEDULED",
      reason: "Menggunakan statistik Meta; tidak memerlukan CRM.",
      href: "/samantha",
    },
    {
      key: "CREATE_CAMPAIGN_DRAFT",
      label: "Buat campaign",
      available: facts.metaConfigured,
      execution: "MANUAL",
      reason:
        "Campaign Builder tersedia; akun, Page, tujuan, aset dan preflight diperiksa saat pembuatan.",
      href: "/campaigns/new",
    },
    {
      key: "APPROVE",
      label: "Approval campaign dan creative",
      available: true,
      execution: "MANUAL",
      reason: "Approval memakai alur yang sudah tersedia; bukan persetujuan otomatis.",
      href: "/samantha",
    },
    {
      key: "REQUEST_KAI_REFRESH",
      label: "Produksi creative",
      available: facts.creativeConfigured,
      execution: "QUEUED",
      reason:
        "Dari brief/proyek Kai yang valid, worker melanjutkan generasi dan QA. Pemilihan proyek otomatis belum terhubung.",
      href: "/kai-studio",
    },
    {
      key: "SCALE",
      label: "Scaling otomatis",
      available: false,
      execution: "BLOCKED",
      reason:
        "Executor scaling dengan pemeriksaan budget, cooldown dan verifikasi hasil masih perlu disambungkan. CRM tidak wajib jika memakai Leads Meta.",
      href: "/automation/growth-settings",
    },
  ];
  return {
    ready: false,
    status: actions.some((a) => a.available) ? "PARTIAL" : "BLOCKED",
    actions,
    optimizationBasis: p.optimizationBasis,
    blockers: ["Scaling otomatis dan pemicu creative lintas campaign belum terhubung penuh."],
    warnings:
      p.optimizationBasis === "META_LEAD"
        ? [
            "Optimasi memakai lead dan CPL Meta. Kualitas lead, booking, dan CPQL belum dapat dinilai tanpa data outcome.",
          ]
        : [
            "Target outcome bisnis tetap memerlukan bukti CRM. Pilih Leads Meta untuk optimasi tanpa CRM.",
          ],
  };
}
