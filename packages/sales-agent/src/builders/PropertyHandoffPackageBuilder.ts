import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import { PropertyHandoffPackage } from "../domain/entities/PropertyHandoffPackage.js";
import type { PropertyListing } from "../domain/entities/PropertyListing.js";
import { ALL_QUALIFICATION_STATUSES } from "../domain/value-objects/QualificationStatus.js";
import { JessyKnowledgeBase } from "../intelligence/JessyKnowledgeBase.js";

const MAX_HIGHLIGHTS = 3;

/**
 * PROPERTY-vertical sibling to `HandoffPackageBuilder` (spec section 12 point 2): assembles the
 * `PropertyHandoffPackage` a sales human receives when a PROPERTY lead goes HOT. `LeadConversation
 * .profile` enrichment stays automotive-only (Phase 7's explicit scope note — `nextPropertyCriterionToAsk`
 * is a pure function of message text, not `profile`), so `extractedInfo`/`qualifiedCriteria` are
 * real fields here but will read empty until a future phase adds PROPERTY profile enrichment.
 */
export class PropertyHandoffPackageBuilder {
  static build(
    conversation: LeadConversation,
    matchedListings: ReadonlyArray<PropertyListing>,
  ): PropertyHandoffPackage {
    const profile = conversation.profile;
    const branchName = JessyKnowledgeBase.branch(conversation.branchId).name;
    const qualifiedCriteria = ALL_QUALIFICATION_STATUSES.filter((status) =>
      profile.isQualified(status),
    );

    return PropertyHandoffPackage.create({
      leadPhone: conversation.leadPhone,
      branchId: conversation.branchId,
      conversationSummary: PropertyHandoffPackageBuilder.buildSummary(conversation, branchName),
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
      recommendedAction: PropertyHandoffPackageBuilder.buildRecommendedAction(
        conversation.score.toNumber(),
      ),
      matchedListings,
      conversationHighlights: PropertyHandoffPackageBuilder.buildHighlights(conversation),
    });
  }

  private static buildSummary(conversation: LeadConversation, branchName: string): string {
    const parts: string[] = [];
    parts.push("Lead serius soal properti.");
    parts.push(`Cocok ke ${branchName}.`);
    parts.push("Sudah tanya listing dan simulasi KPR/DP.");
    parts.push("Tinggal atur jadwal survey lokasi. Hubungi sekarang.");
    return parts.join(" ");
  }

  private static buildRecommendedAction(score: number): string {
    return score >= 90 ? "Hubungi sekarang, siap survey lokasi" : "Hubungi secepatnya, lead HOT";
  }

  private static buildHighlights(conversation: LeadConversation): string[] {
    return conversation.messages
      .filter((message) => message.isInbound)
      .slice(-MAX_HIGHLIGHTS)
      .map((message) => message.text);
  }
}
