import type { KnowledgeItemSnapshot } from "../types/knowledge-item.js";
import { generateId } from "../utils/id-generator.js";
import { KnowledgeFinding } from "../value-objects/knowledge-finding.js";

/**
 * Real rule-based structural analysis: inspects each item's caller-supplied structured fields
 * and emits a `KnowledgeFinding` for every structural deficiency detected (missing summary,
 * missing owner, missing examples, incomplete required fields, too-short content).
 */
export class KnowledgeAnalysisEngine {
  private static readonly MIN_CONTENT_LENGTH = 40;

  analyzeStructure(item: KnowledgeItemSnapshot): readonly KnowledgeFinding[] {
    const findings: KnowledgeFinding[] = [];

    if (!item.hasSummary) {
      findings.push(this.finding(item.id, "structure", "Item is missing a summary", "warning"));
    }
    if (!item.hasOwner) {
      findings.push(this.finding(item.id, "structure", "Item has no assigned owner", "warning"));
    }
    if (!item.hasExamples) {
      findings.push(this.finding(item.id, "structure", "Item has no examples", "info"));
    }
    if (item.requiredFieldsTotal > 0 && item.requiredFieldsPresent < item.requiredFieldsTotal) {
      findings.push(
        this.finding(
          item.id,
          "completeness",
          `Item is missing ${item.requiredFieldsTotal - item.requiredFieldsPresent} required field(s)`,
          "critical",
        ),
      );
    }
    if (item.contentLength < KnowledgeAnalysisEngine.MIN_CONTENT_LENGTH) {
      findings.push(this.finding(item.id, "structure", "Item content is too short", "warning"));
    }

    return findings;
  }

  analyzeCorpusStructure(items: readonly KnowledgeItemSnapshot[]): readonly KnowledgeFinding[] {
    return items.flatMap((item) => this.analyzeStructure(item));
  }

  private finding(
    itemId: string,
    category: string,
    message: string,
    severity: "info" | "warning" | "critical",
  ): KnowledgeFinding {
    return new KnowledgeFinding({ id: generateId("finding"), itemId, category, message, severity });
  }
}
