import type {
  IKnowledgeMarketplaceValidator,
  KnowledgeMarketplaceValidationInput,
  MarketplaceValidationIssue,
  MarketplaceValidationResult,
} from "../contracts/i-knowledge-marketplace-validator.js";
import { MarketplacePackageStatus } from "../domain/marketplace-package-status.js";

/** Stage 8 — Certification: a Listing entering `Published` must already carry a `MarketplaceCertification`. */
export class CertificationValidator implements IKnowledgeMarketplaceValidator {
  readonly name = "certification";

  validate(input: KnowledgeMarketplaceValidationInput): MarketplaceValidationResult {
    const issues: MarketplaceValidationIssue[] = [];
    if (input.targetState === MarketplacePackageStatus.PUBLISHED && !input.certification) {
      issues.push({
        path: "certification",
        message: "A Listing must be Certified before it can be Published",
      });
    }
    if (input.certification && input.certification.certifiedBy.trim().length === 0) {
      issues.push({
        path: "certification.certifiedBy",
        message: "Certification certifiedBy must not be empty",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
