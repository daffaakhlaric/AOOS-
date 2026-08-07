import type { KnowledgeMarketplaceContext } from "../context/knowledge-marketplace-context.js";
import type { MarketplaceCertification } from "../domain/marketplace-certification.js";
import type { MarketplaceCompatibility } from "../domain/marketplace-compatibility.js";
import type { MarketplaceDependency } from "../domain/marketplace-dependency.js";
import type { MarketplaceMetadata } from "../domain/marketplace-metadata.js";
import type { MarketplacePackageStatus } from "../domain/marketplace-package-status.js";
import type { MarketplacePackage } from "../domain/marketplace-package.js";
import type { MarketplacePublisher } from "../domain/marketplace-publisher.js";

export interface MarketplaceValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface MarketplaceValidationResult {
  readonly valid: boolean;
  readonly issues: readonly MarketplaceValidationIssue[];
}

/**
 * The unit every Validator stage reads. `currentState`/`targetState` feed the Lifecycle
 * stage — all optional so the Validator can also run standalone on a bare
 * metadata/context/package triple. Registry-derived facts (`publisher`,
 * `categoryResolvable`, `dependencies`, `compatibility`, `certification`,
 * `knownPackageIds`) are precomputed by the caller (Pipeline/Facade), matching the
 * "Validator stages are pure functions over their input" convention used in
 * `@aos/knowledge-policy`.
 */
export interface KnowledgeMarketplaceValidationInput {
  readonly metadata: MarketplaceMetadata;
  readonly context: KnowledgeMarketplaceContext;
  readonly package: MarketplacePackage;
  readonly currentState?: MarketplacePackageStatus;
  readonly targetState?: MarketplacePackageStatus;
  readonly publisher?: MarketplacePublisher;
  readonly categoryResolvable?: boolean;
  readonly dependencies?: readonly MarketplaceDependency[];
  readonly knownPackageIds?: readonly string[];
  readonly compatibility?: MarketplaceCompatibility;
  readonly certification?: MarketplaceCertification;
}

/** A caller-supplied extra validation stage `KnowledgeMarketplaceValidator` runs alongside its own 10 built-in stages. */
export interface IKnowledgeMarketplaceValidator {
  readonly name: string;
  validate(input: KnowledgeMarketplaceValidationInput): MarketplaceValidationResult;
}
