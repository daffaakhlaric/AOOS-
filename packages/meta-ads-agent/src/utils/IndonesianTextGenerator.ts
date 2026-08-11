import { formatIDR } from "@aos/meta-ads-connector";

import type { AgentMemory } from "../domain/entities/AgentMemory.js";
import type { DailyDigestTopPerformer } from "../domain/entities/DailyDigest.js";
import { TOP_UNITS } from "../intelligence/BusinessKnowledgeBase.js";

export interface DigestTextInput {
  readonly date: Date;
  readonly targetHotLeads: number;
  readonly currentHotLeads: number;
  readonly progressPercentage: number;
  readonly forecastedHotLeads: number;
  readonly onTrack: boolean;
  readonly budgetAllocatedIDR: number;
  readonly budgetSpentIDR: number;
  readonly budgetSpentPercentage: number;
  readonly burnRateIDR: number;
  readonly budgetRemainingIDR: number;
  readonly daysOfBudgetRemaining: number;
  readonly autoExecutedSummaryLines: ReadonlyArray<string>;
  readonly creativeBriefSummaryLines: ReadonlyArray<string>;
  readonly pendingEscalationSummaryLines: ReadonlyArray<string>;
  readonly topPerformers: ReadonlyArray<DailyDigestTopPerformer>;
  readonly weeklyRecommendation: string;
  /** AAOS-W1D-S1S2 (S2) — when supplied, appends a "📦 Status Stok" + "🎁 Promo Aktif" section built from real `AgentMemory` inventory/promo data. Omitted (no section) for W1D-base callers that don't pass memory. */
  readonly memory?: AgentMemory;
}

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function formatDateID(date: Date): string {
  return `${date.getUTCDate()} ${MONTH_NAMES_ID[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Generates Tamara's plain-Indonesian daily digest narrative, dynamically, from real computed
 * numbers (never a hardcoded string) — matching the spec's example structure/tone: objective
 * progress, budget, "what I did today", creative briefs, pending escalations, top performers,
 * weekly recommendation.
 */
export class IndonesianTextGenerator {
  static generateDigest(input: DigestTextInput): string {
    const lines: string[] = [];
    lines.push(`📊 Laporan Harian Tamara — ${formatDateID(input.date)}`);
    lines.push("");
    lines.push("🎯 Progress Objective");
    lines.push(`Target : ${input.targetHotLeads} hot leads`);
    lines.push(`Sekarang : ${input.currentHotLeads} hot leads (${input.progressPercentage}%)`);
    lines.push(
      `Proyeksi : ${input.forecastedHotLeads} leads akhir bulan ${input.onTrack ? "✅ ON TRACK" : "⚠️ AT RISK"}`,
    );
    lines.push("");
    lines.push("💰 Budget");
    lines.push(
      `Terpakai : ${formatIDR(input.budgetSpentIDR)} dari ${formatIDR(input.budgetAllocatedIDR)} (${input.budgetSpentPercentage}%)`,
    );
    lines.push(`Burn rate : ${formatIDR(input.burnRateIDR)}/hari`);
    lines.push(
      `Sisa : ${formatIDR(input.budgetRemainingIDR)} (cukup untuk ${input.daysOfBudgetRemaining} hari)`,
    );
    lines.push("");
    lines.push("✅ Yang Saya Lakukan Hari Ini");
    if (input.autoExecutedSummaryLines.length === 0) {
      lines.push("• Tidak ada aksi auto-execute hari ini");
    } else {
      for (const line of input.autoExecutedSummaryLines) {
        lines.push(`• ${line}`);
      }
    }
    lines.push("");
    lines.push("🎨 Creative Brief Dikirim ke Kai");
    if (input.creativeBriefSummaryLines.length === 0) {
      lines.push("• Tidak ada creative brief hari ini");
    } else {
      for (const line of input.creativeBriefSummaryLines) {
        lines.push(`• ${line}`);
      }
    }
    lines.push("");
    lines.push("⏳ Menunggu Approval Kamu");
    if (input.pendingEscalationSummaryLines.length === 0) {
      lines.push("• Tidak ada yang menunggu approval");
    } else {
      for (const line of input.pendingEscalationSummaryLines) {
        lines.push(`• ${line}`);
      }
    }
    lines.push("");
    lines.push("📈 Top Performer Hari Ini");
    if (input.topPerformers.length === 0) {
      lines.push("• Belum ada data performer hari ini");
    } else {
      for (const performer of input.topPerformers) {
        lines.push(
          `• ${performer.label}: ${formatIDR(performer.rphChatIDR)}/chat (${performer.conversations} chat)`,
        );
      }
    }
    lines.push("");
    lines.push("💡 Rekomendasi Minggu Ini");
    lines.push(input.weeklyRecommendation);

    if (input.memory) {
      lines.push("");
      lines.push(...IndonesianTextGenerator.inventorySection(input.memory));
    }

    return lines.join("\n");
  }

  /**
   * AAOS-W1D-S1S2 (S2) — "📦 Status Stok" + "🎁 Promo Aktif" section, per the spec's exact
   * format. Stock counts are grouped by model, then by branch, computed directly from
   * `memory.currentInventory` — never hardcoded. Out-of-stock warnings are derived by checking,
   * for every `TOP_UNITS` model × its listed `branches`, whether `memory.currentInventory` has
   * zero matching units at that branch (the same "known model, zero units at this branch" concept
   * `VerdictDecisionEngine.checkStock` uses for its auto-pause override).
   */
  private static inventorySection(memory: AgentMemory): string[] {
    const lines: string[] = ["📦 Status Stok"];

    const byModel = new Map<string, number>();
    for (const unit of memory.currentInventory) {
      byModel.set(unit.model, (byModel.get(unit.model) ?? 0) + 1);
    }

    if (byModel.size === 0) {
      lines.push("Tidak ada data stok saat ini");
    } else {
      for (const [model, total] of byModel) {
        const byBranch = new Map<string, number>();
        for (const unit of memory.currentInventory) {
          if (unit.model === model) {
            byBranch.set(unit.branch, (byBranch.get(unit.branch) ?? 0) + 1);
          }
        }
        const branchBreakdown = [...byBranch.entries()]
          .map(([branch, count]) => `${branch} ${count}`)
          .join(", ");
        lines.push(`${model} : ${total} unit (${branchBreakdown}) ✅`);
      }
    }

    for (const unitProfile of TOP_UNITS) {
      for (const branch of unitProfile.branches) {
        const inStockHere = memory.currentInventory.some(
          (u) => u.matchesModel(unitProfile.model) && u.branch === branch,
        );
        if (!inStockHere) {
          lines.push(`⚠️ ${unitProfile.model} ${branch} : stok habis — campaign di-pause otomatis`);
        }
      }
    }

    lines.push("");
    lines.push("🎁 Promo Aktif");
    if (memory.activePromos.length === 0) {
      lines.push("• Tidak ada promo aktif saat ini");
    } else {
      for (const promo of memory.activePromos) {
        const validUntil = promo.validUntil
          ? `berlaku s/d ${formatDateID(promo.validUntil)}`
          : "berlaku tanpa batas waktu";
        lines.push(`• ${promo.title} (${validUntil})`);
      }
    }

    return lines;
  }
}
