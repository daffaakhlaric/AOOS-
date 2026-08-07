import type { IKnowledgeGeneratorAiMarketplace } from "../contracts/i-knowledge-generator-ai-marketplace.js";
import type { IKnowledgeMarketplaceAnalyticsProvider } from "../contracts/i-knowledge-marketplace-analytics-provider.js";
import type { IKnowledgeMarketplaceApprovalProvider } from "../contracts/i-knowledge-marketplace-approval-provider.js";
import type { IKnowledgeMarketplaceBillingProvider } from "../contracts/i-knowledge-marketplace-billing-provider.js";
import type { IKnowledgeMarketplaceInstaller } from "../contracts/i-knowledge-marketplace-installer.js";
import type { IKnowledgeMarketplaceLicenseProvider } from "../contracts/i-knowledge-marketplace-license-provider.js";
import type { IKnowledgeMarketplacePublisher } from "../contracts/i-knowledge-marketplace-publisher.js";
import type { IKnowledgeMarketplaceRecommendationProvider } from "../contracts/i-knowledge-marketplace-recommendation-provider.js";
import type { IKnowledgeMarketplaceReviewer } from "../contracts/i-knowledge-marketplace-reviewer.js";
import type { IKnowledgeMarketplaceSearchProvider } from "../contracts/i-knowledge-marketplace-search-provider.js";
import type { IKnowledgeMarketplaceStorage } from "../contracts/i-knowledge-marketplace-storage.js";
import type { IKnowledgeQualityEngineMarketplace } from "../contracts/i-knowledge-quality-engine-marketplace.js";
import type { IKnowledgeValidatorAiMarketplace } from "../contracts/i-knowledge-validator-ai-marketplace.js";

/**
 * "EXTENSION POINTS: Interfaces ONLY. Never implement." (docs/PROMPT-005.7J-KNOWLEDGE-
 * MARKETPLACE.md) — every field is optional. Also carries the 3 Future Readiness
 * contracts for 005.7K/005.7L/005.7M.
 */
export interface KnowledgeMarketplaceConfig {
  readonly storage?: IKnowledgeMarketplaceStorage;
  readonly publisher?: IKnowledgeMarketplacePublisher;
  readonly reviewer?: IKnowledgeMarketplaceReviewer;
  readonly searchProvider?: IKnowledgeMarketplaceSearchProvider;
  readonly installer?: IKnowledgeMarketplaceInstaller;
  readonly licenseProvider?: IKnowledgeMarketplaceLicenseProvider;
  readonly billingProvider?: IKnowledgeMarketplaceBillingProvider;
  readonly recommendationProvider?: IKnowledgeMarketplaceRecommendationProvider;
  readonly analyticsProvider?: IKnowledgeMarketplaceAnalyticsProvider;
  readonly approvalProvider?: IKnowledgeMarketplaceApprovalProvider;
  readonly generatorAiProvider?: IKnowledgeGeneratorAiMarketplace;
  readonly qualityEngineProvider?: IKnowledgeQualityEngineMarketplace;
  readonly validatorAiProvider?: IKnowledgeValidatorAiMarketplace;
}
