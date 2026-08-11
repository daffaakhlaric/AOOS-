import type { InventoryUnit } from "@aos/dss-inventory-connector";

import { HandoffPackage } from "../domain/entities/HandoffPackage.js";
import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import { ALL_QUALIFICATION_STATUSES } from "../domain/value-objects/QualificationStatus.js";
import { JessyKnowledgeBase } from "../intelligence/JessyKnowledgeBase.js";

const MAX_HIGHLIGHTS = 3;

/** Builder Pattern: assembles the `HandoffPackage` a sales human receives when a lead goes HOT (spec "Handoff Package"). */
export class HandoffPackageBuilder {
  static build(
    conversation: LeadConversation,
    matchedUnits: ReadonlyArray<InventoryUnit>,
  ): HandoffPackage {
    const profile = conversation.profile;
    const branchName = JessyKnowledgeBase.branch(conversation.branchId).name;
    const qualifiedCriteria = ALL_QUALIFICATION_STATUSES.filter((status) =>
      profile.isQualified(status),
    );

    return HandoffPackage.create({
      leadPhone: conversation.leadPhone,
      branchId: conversation.branchId,
      conversationSummary: HandoffPackageBuilder.buildSummary(conversation, branchName),
      score: conversation.score,
      qualifiedCriteria,
      extractedInfo: {
        budget: profile.budget,
        unit: profile.unit,
        area: profile.area,
        paymentMethod: profile.paymentMethod,
        timeline: profile.timeline,
        name: profile.name,
      },
      recommendedAction: HandoffPackageBuilder.buildRecommendedAction(
        conversation.score.toNumber(),
      ),
      matchedUnits,
      conversationHighlights: HandoffPackageBuilder.buildHighlights(conversation),
    });
  }

  private static buildSummary(conversation: LeadConversation, branchName: string): string {
    const profile = conversation.profile;
    const parts: string[] = [];
    parts.push(profile.unit !== undefined ? `Lead serius soal ${profile.unit}.` : "Lead serius.");
    if (profile.budget !== undefined || profile.paymentMethod !== undefined) {
      const budgetText =
        profile.budget !== undefined ? `Budget ${profile.budget}` : "Budget belum jelas";
      const paymentText =
        profile.paymentMethod !== undefined ? `, mau ${profile.paymentMethod}` : "";
      parts.push(`${budgetText}${paymentText}.`);
    }
    if (profile.area !== undefined) {
      parts.push(`Area ${profile.area}, cocok ke ${branchName}.`);
    }
    parts.push("Sudah tanya unit dan DP.");
    parts.push("Tinggal atur jadwal test drive. Hubungi sekarang.");
    return parts.join(" ");
  }

  private static buildRecommendedAction(score: number): string {
    return score >= 90 ? "Hubungi sekarang, siap test drive" : "Hubungi secepatnya, lead HOT";
  }

  private static buildHighlights(conversation: LeadConversation): string[] {
    return conversation.messages
      .filter((message) => message.isInbound)
      .slice(-MAX_HIGHLIGHTS)
      .map((message) => message.text);
  }
}
