import type { KnowledgeMarketplaceContext } from "../context/knowledge-marketplace-context.js";

import type { MarketplaceAuditEntry } from "./marketplace-audit.js";
import type { MarketplaceCertification } from "./marketplace-certification.js";
import type { MarketplaceCompatibility } from "./marketplace-compatibility.js";
import type { MarketplaceDependency } from "./marketplace-dependency.js";
import type { MarketplaceInstallationMetadata } from "./marketplace-installation-metadata.js";
import type { MarketplaceListing } from "./marketplace-listing.js";
import type { MarketplaceLogEntry } from "./marketplace-log.js";
import type { MarketplaceMetadata } from "./marketplace-metadata.js";
import type { MarketplacePackage } from "./marketplace-package.js";
import type { MarketplaceTrace } from "./marketplace-trace.js";

/**
 * The unit every State Machine transition / Pipeline stage reads and returns —
 * `instance` (the `MarketplaceListing`) + `context` + `metadata` + `package` + the
 * ordered `history` of every transition so far, plus dependency/compatibility/
 * certification/installation metadata and the Tracing/Audit/Logging metadata the
 * Pipeline stages stamp onto it. Immutable — every stage returns an updated copy.
 */
export interface KnowledgeMarketplaceExecution {
  readonly instance: MarketplaceListing;
  readonly context: KnowledgeMarketplaceContext;
  readonly metadata: MarketplaceMetadata;
  readonly package: MarketplacePackage;
  readonly dependencies: readonly MarketplaceDependency[];
  readonly compatibility?: MarketplaceCompatibility;
  readonly certification?: MarketplaceCertification;
  readonly installation?: MarketplaceInstallationMetadata;
  readonly history: readonly MarketplaceHistoryEntry[];
  readonly trace?: MarketplaceTrace;
  readonly auditTrail: readonly MarketplaceAuditEntry[];
  readonly logs: readonly MarketplaceLogEntry[];
}

/** One immutable entry in a Listing's transition history. */
export interface MarketplaceHistoryEntry {
  readonly id: string;
  readonly sequence: number;
  readonly listingId: string;
  readonly operation: string;
  readonly fromState?: string;
  readonly toState?: string;
  readonly reason?: string;
  readonly occurredAt: string;
}
