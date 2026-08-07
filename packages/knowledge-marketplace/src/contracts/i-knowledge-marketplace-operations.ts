import type { KnowledgeMarketplaceContext } from "../context/knowledge-marketplace-context.js";
import type { KnowledgeMarketplaceRecord } from "../domain/knowledge-marketplace-record.js";
import type { MarketplaceCategoryName } from "../domain/marketplace-category-name.js";
import type { MarketplaceCertificationLevel } from "../domain/marketplace-certification-level.js";
import type { MarketplaceCertification } from "../domain/marketplace-certification.js";
import type { MarketplaceCompatibility } from "../domain/marketplace-compatibility.js";
import type { MarketplaceDependencyKind } from "../domain/marketplace-dependency-kind.js";
import type { MarketplaceDependency } from "../domain/marketplace-dependency.js";
import type { MarketplaceMetadata } from "../domain/marketplace-metadata.js";

/**
 * "MARKETPLACE OPERATIONS: Metadata only. Implement: Create Listing, Update Listing,
 * Submit, Review, Certify, Publish, Deprecate, Suspend, Archive, Remove, Add Dependency,
 * Remove Dependency, Add Compatibility, Update Metadata, Search Metadata, Browse
 * Category. No download. No installer. No package deployment."
 * (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md) — typed input/result contracts for each
 * of the 16 operations.
 */
export interface CreateListingInput {
  readonly metadata: MarketplaceMetadata;
  readonly context: KnowledgeMarketplaceContext;
  readonly packageName: string;
  readonly currentVersion: string;
  readonly packageDescription?: string;
}

export interface UpdateListingInput {
  readonly token: string;
  readonly title?: string;
  readonly summary?: string;
  readonly description?: string;
  readonly reason?: string;
}

export interface SubmitListingInput {
  readonly token: string;
  readonly reason?: string;
}

export interface ReviewListingInput {
  readonly token: string;
  readonly reviewedBy: string;
  readonly approved: boolean;
  readonly notes?: string;
}

export interface CertifyListingInput {
  readonly token: string;
  readonly certifiedBy: string;
  readonly level: MarketplaceCertificationLevel;
  readonly notes?: string;
}

export interface CertifyListingResult {
  readonly listing: KnowledgeMarketplaceRecord;
  readonly certification: MarketplaceCertification;
}

export interface PublishListingInput {
  readonly token: string;
  readonly reason?: string;
}

export interface DeprecateListingInput {
  readonly token: string;
  readonly reason?: string;
}

export interface SuspendListingInput {
  readonly token: string;
  readonly reason?: string;
}

export interface ArchiveListingInput {
  readonly token: string;
  readonly reason?: string;
}

export interface RemoveListingInput {
  readonly token: string;
  readonly reason?: string;
}

export interface AddDependencyInput {
  readonly token: string;
  readonly dependencyPackageId: string;
  readonly kind: MarketplaceDependencyKind;
  readonly versionRange?: string;
}

export interface AddDependencyResult {
  readonly listing: KnowledgeMarketplaceRecord;
  readonly dependency: MarketplaceDependency;
}

export interface RemoveDependencyInput {
  readonly token: string;
  readonly dependencyId: string;
}

export interface AddCompatibilityInput {
  readonly token: string;
  readonly aosVersion: string;
  readonly requiredKnowledgeVersion: string;
  readonly requiredPackages?: readonly string[];
  readonly optionalPackages?: readonly string[];
  readonly runtimeCompatibility?: readonly string[];
  readonly platformCompatibility?: readonly string[];
}

export interface AddCompatibilityResult {
  readonly listing: KnowledgeMarketplaceRecord;
  readonly compatibility: MarketplaceCompatibility;
}

export interface UpdateMetadataInput {
  readonly token: string;
  readonly keywords?: readonly string[];
  readonly tags?: readonly string[];
  readonly category?: MarketplaceCategoryName;
}

export interface SearchMetadataInput {
  readonly keyword: string;
}

export interface SearchMetadataResult {
  readonly listings: readonly KnowledgeMarketplaceRecord[];
}

export interface BrowseCategoryInput {
  readonly category: MarketplaceCategoryName;
}

export interface BrowseCategoryResult {
  readonly listings: readonly KnowledgeMarketplaceRecord[];
}
