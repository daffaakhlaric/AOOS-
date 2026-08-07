import type { KnowledgeMarketplaceContext } from "../context/knowledge-marketplace-context.js";
import type { IKnowledgeMarketplace } from "../contracts/i-knowledge-marketplace.js";

import type {
  KnowledgeMarketplaceExecution,
  MarketplaceHistoryEntry,
} from "./knowledge-marketplace-execution.js";
import type { MarketplaceAuditEntry } from "./marketplace-audit.js";
import type { MarketplaceCertification } from "./marketplace-certification.js";
import type { MarketplaceCompatibility } from "./marketplace-compatibility.js";
import type { MarketplaceDependency } from "./marketplace-dependency.js";
import type { MarketplaceInstallationMetadata } from "./marketplace-installation-metadata.js";
import type { MarketplaceLogEntry } from "./marketplace-log.js";
import type { MarketplaceMetadata } from "./marketplace-metadata.js";
import type { MarketplacePackageStatus } from "./marketplace-package-status.js";
import type { MarketplacePackage } from "./marketplace-package.js";

/**
 * "KnowledgeMarketplaceRecord" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Domain
 * Model") — the concrete, read-only view over one Listing's `KnowledgeMarketplaceExecution`.
 * Every operation that hands a Listing back to a caller returns one of these rather than
 * the raw execution envelope.
 *
 * Named distinctly from the `KnowledgeMarketplace` façade (`marketplace/knowledge-
 * marketplace.ts`, the "Public API" name) to avoid a same-name collision at the package
 * barrel — matching the convention established by `@aos/knowledge-policy`
 * (`KnowledgePolicy` façade vs. `KnowledgePolicyRecord` read-model).
 */
export class KnowledgeMarketplaceRecord implements IKnowledgeMarketplace {
  constructor(private readonly execution: KnowledgeMarketplaceExecution) {}

  get id(): string {
    return this.execution.instance.id;
  }

  get token(): string {
    return this.execution.instance.token;
  }

  get listingId(): string {
    return this.execution.metadata.listingId;
  }

  get packageId(): string {
    return this.execution.metadata.packageId;
  }

  get state(): MarketplacePackageStatus {
    return this.execution.instance.state;
  }

  get metadata(): MarketplaceMetadata {
    return this.execution.metadata;
  }

  get package(): MarketplacePackage {
    return this.execution.package;
  }

  get context(): KnowledgeMarketplaceContext {
    return this.execution.context;
  }

  get dependencies(): readonly MarketplaceDependency[] {
    return this.execution.dependencies;
  }

  get compatibility(): MarketplaceCompatibility | undefined {
    return this.execution.compatibility;
  }

  get certification(): MarketplaceCertification | undefined {
    return this.execution.certification;
  }

  get installation(): MarketplaceInstallationMetadata | undefined {
    return this.execution.installation;
  }

  get history(): readonly MarketplaceHistoryEntry[] {
    return this.execution.history;
  }

  get auditTrail(): readonly MarketplaceAuditEntry[] {
    return this.execution.auditTrail;
  }

  get logs(): readonly MarketplaceLogEntry[] {
    return this.execution.logs;
  }

  toExecution(): KnowledgeMarketplaceExecution {
    return this.execution;
  }
}
