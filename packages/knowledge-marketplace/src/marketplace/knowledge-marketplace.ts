import type { IPublisher } from "@aos/event-bus";

import type {
  AddCompatibilityInput,
  AddCompatibilityResult,
  AddDependencyInput,
  AddDependencyResult,
  ArchiveListingInput,
  BrowseCategoryInput,
  BrowseCategoryResult,
  CertifyListingInput,
  CertifyListingResult,
  CreateListingInput,
  DeprecateListingInput,
  PublishListingInput,
  RemoveDependencyInput,
  RemoveListingInput,
  ReviewListingInput,
  SearchMetadataInput,
  SearchMetadataResult,
  SubmitListingInput,
  SuspendListingInput,
  UpdateListingInput,
  UpdateMetadataInput,
} from "../contracts/i-knowledge-marketplace-operations.js";
import type { KnowledgeMarketplaceExecution } from "../domain/knowledge-marketplace-execution.js";
import { KnowledgeMarketplaceRecord } from "../domain/knowledge-marketplace-record.js";
import type { MarketplaceCategoryName } from "../domain/marketplace-category-name.js";
import type { MarketplaceCategory } from "../domain/marketplace-category.js";
import { MarketplacePackageStatus } from "../domain/marketplace-package-status.js";
import type { MarketplacePublisher } from "../domain/marketplace-publisher.js";
import type { MarketplaceType } from "../domain/marketplace-type.js";
import { MarketplaceNotFoundException } from "../errors/marketplace-not-found-exception.js";
import { KnowledgeMarketplaceEventType } from "../events/knowledge-marketplace-event-type.js";
import { KnowledgeMarketplaceEvents } from "../events/knowledge-marketplace-events.js";
import { KnowledgeMarketplaceFactory } from "../factory/knowledge-marketplace-factory.js";
import { KnowledgeMarketplaceHealth } from "../health/knowledge-marketplace-health.js";
import { KnowledgeMarketplaceLifecycle } from "../lifecycle/knowledge-marketplace-lifecycle.js";
import { KnowledgeMarketplaceManager } from "../manager/knowledge-marketplace-manager.js";
import { KnowledgeMarketplaceMetrics } from "../metrics/knowledge-marketplace-metrics.js";
import {
  KnowledgeMarketplaceMiddleware,
  type MarketplaceMiddleware,
} from "../middleware/knowledge-marketplace-middleware.js";
import { KnowledgeMarketplaceMonitoring } from "../monitoring/knowledge-marketplace-monitoring.js";
import { KnowledgeMarketplacePipeline } from "../pipeline/knowledge-marketplace-pipeline.js";
import { KnowledgeMarketplaceRegistryBucket } from "../registry/knowledge-marketplace-registry-bucket.js";
import { KnowledgeMarketplaceRegistry } from "../registry/knowledge-marketplace-registry.js";
import type { MarketplaceRegistryEntry } from "../registry/marketplace-registry-entry.js";
import { KnowledgeMarketplaceResolver } from "../resolver/knowledge-marketplace-resolver.js";
import { KnowledgeMarketplaceSession } from "../session/knowledge-marketplace-session.js";
import { KnowledgeMarketplaceStateMachine } from "../state-machine/knowledge-marketplace-state-machine.js";
import type { KnowledgeMarketplaceStatistics } from "../statistics/knowledge-marketplace-statistics.js";
import { generateKnowledgeMarketplaceToken } from "../token/knowledge-marketplace-token.js";
import { generateId } from "../utils/id.js";
import { KnowledgeMarketplaceValidator } from "../validator/knowledge-marketplace-validator.js";

/**
 * "KnowledgeMarketplace" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Public API") —
 * the primary API façade for the package, analogous in role to `KnowledgePolicy` in
 * `@aos/knowledge-policy` and `KnowledgeVersioning` in `@aos/knowledge-versioning`.
 * Wires Manager + StateMachine + Pipeline + Middleware + Resolver + Validator + Events.
 * Implements all 16 Marketplace Operations as metadata/lifecycle methods: validate ->
 * drive the State Machine to the target state via one atomic 9-stage Pipeline call ->
 * record relevant domain metadata -> update statistics -> publish the matching event ->
 * return the updated `KnowledgeMarketplaceRecord`. "Search Metadata"/"Browse Category"
 * are read-only query operations that delegate to the Resolver instead. "No download.
 * No installer. No package deployment. Metadata only."
 */
export class KnowledgeMarketplace {
  readonly registry: KnowledgeMarketplaceRegistry;
  readonly manager: KnowledgeMarketplaceManager;
  readonly stateMachine: KnowledgeMarketplaceStateMachine;
  readonly validator: KnowledgeMarketplaceValidator;
  readonly pipeline: KnowledgeMarketplacePipeline;
  readonly middleware: KnowledgeMarketplaceMiddleware;
  readonly resolver: KnowledgeMarketplaceResolver;
  readonly events: KnowledgeMarketplaceEvents;
  readonly metrics: KnowledgeMarketplaceMetrics;
  readonly health: KnowledgeMarketplaceHealth;
  readonly monitoring: KnowledgeMarketplaceMonitoring;
  readonly statistics: KnowledgeMarketplaceStatistics;
  readonly lifecycle: KnowledgeMarketplaceLifecycle;
  readonly factory: KnowledgeMarketplaceFactory;
  readonly session: KnowledgeMarketplaceSession;

  constructor(publisher: IPublisher) {
    this.registry = new KnowledgeMarketplaceRegistry();
    this.session = new KnowledgeMarketplaceSession();
    this.manager = new KnowledgeMarketplaceManager(this.registry, this.session);
    this.stateMachine = new KnowledgeMarketplaceStateMachine();
    this.metrics = new KnowledgeMarketplaceMetrics();
    this.validator = new KnowledgeMarketplaceValidator();
    this.resolver = new KnowledgeMarketplaceResolver(this.registry);
    this.pipeline = new KnowledgeMarketplacePipeline(
      this.validator,
      this.metrics,
      this.registry,
      this.resolver,
    );
    this.middleware = new KnowledgeMarketplaceMiddleware();
    this.events = new KnowledgeMarketplaceEvents(publisher);
    this.health = new KnowledgeMarketplaceHealth(this.registry);
    this.monitoring = new KnowledgeMarketplaceMonitoring(this.metrics, this.registry);
    /* Share the Manager's Statistics instance rather than creating a second, unsynced
     * one — the Manager records "listed" on every registration; the façade records
     * "published" from the Publish operation. Both must land in the same instance. */
    this.statistics = this.manager.statistics;
    this.lifecycle = new KnowledgeMarketplaceLifecycle();
    this.factory = new KnowledgeMarketplaceFactory();
  }

  /** Registers a `marketplace.use(...)` Koa-style middleware onto the shared chain. */
  use(middleware: MarketplaceMiddleware): this {
    this.middleware.use(middleware);
    return this;
  }

  /* ---- Setup helpers (not one of the 16 Marketplace Operations, but required plumbing
   * a caller needs before it can reference a Publisher/Custom Category from a Listing) ---- */

  registerPublisher(input: {
    readonly publisherId: string;
    readonly name: string;
    readonly marketplaceType: MarketplaceType;
    readonly verified?: boolean;
    readonly contactEmail?: string;
  }): MarketplacePublisher {
    const publisher = this.factory.publisher.create(input);
    this.registry.register(KnowledgeMarketplaceRegistryBucket.PUBLISHER, publisher);
    this.metrics.recordPublisher();
    return publisher;
  }

  registerCategory(input: {
    readonly name: MarketplaceCategoryName;
    readonly label: string;
    readonly description?: string;
  }): MarketplaceCategory {
    const category = this.factory.category.create({ ...input, custom: true });
    this.registry.register(KnowledgeMarketplaceRegistryBucket.CATEGORY, category);
    this.metrics.recordCategory();
    return category;
  }

  /* ---- Operation 1: Create Listing ---- */
  async createListing(input: CreateListingInput): Promise<KnowledgeMarketplaceRecord> {
    const token = generateKnowledgeMarketplaceToken();
    const context = input.context;

    const pkg = this.factory.package.create({
      packageId: input.metadata.packageId,
      name: input.packageName,
      publisherId: input.metadata.publisherId,
      marketplaceType: input.metadata.marketplaceType,
      category: input.metadata.category,
      currentVersion: input.currentVersion,
      description: input.packageDescription,
    });
    this.registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, pkg);

    const instance = this.factory.listing.create({
      token,
      listingId: input.metadata.listingId,
      packageId: pkg.packageId,
      tenantId: input.metadata.tenantId,
      workspaceId: input.metadata.workspaceId,
    });

    const draft: KnowledgeMarketplaceExecution = {
      instance,
      context,
      metadata: input.metadata,
      package: pkg,
      dependencies: [],
      history: [],
      auditTrail: [],
      logs: [],
    };

    const pipelined = this.pipeline.run({
      execution: draft,
      operation: "create_listing",
      targetState: MarketplacePackageStatus.DRAFT,
    });
    await this.middleware.run(pipelined);

    const entry: MarketplaceRegistryEntry = {
      id: pipelined.metadata.listingId,
      token,
      metadata: pipelined.metadata,
    };
    this.manager.register(token, pipelined, entry);

    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.MARKETPLACE_CREATED,
      context,
    );
    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_CREATED,
      context,
    );

    return new KnowledgeMarketplaceRecord(pipelined);
  }

  /* ---- Operation 2: Update Listing ---- */
  async updateListing(input: UpdateListingInput): Promise<KnowledgeMarketplaceRecord> {
    const execution = this.requireExecution(input.token);
    const updated: KnowledgeMarketplaceExecution = {
      ...execution,
      metadata: {
        ...execution.metadata,
        title: input.title ?? execution.metadata.title,
        summary: input.summary ?? execution.metadata.summary,
        description: input.description ?? execution.metadata.description,
      },
    };

    const pipelined = await this.runPipeline(updated, "update_listing", undefined, input.reason);
    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_UPDATED,
      execution.context,
    );

    return new KnowledgeMarketplaceRecord(pipelined);
  }

  /* ---- Operation 3: Submit ---- */
  async submit(input: SubmitListingInput): Promise<KnowledgeMarketplaceRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "submit_listing",
      MarketplacePackageStatus.SUBMITTED,
      input.reason,
    );
    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_SUBMITTED,
      execution.context,
    );
    return new KnowledgeMarketplaceRecord(pipelined);
  }

  /* ---- Operation 4: Review ---- */
  async review(input: ReviewListingInput): Promise<KnowledgeMarketplaceRecord> {
    const execution = this.requireExecution(input.token);
    const reason = `Reviewed by "${input.reviewedBy}" — ${input.approved ? "approved" : "rejected"}${
      input.notes ? `: ${input.notes}` : ""
    }`;
    const pipelined = await this.runPipeline(
      execution,
      "review_listing",
      MarketplacePackageStatus.REVIEWING,
      reason,
    );
    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_REVIEWED,
      execution.context,
      {
        approved: input.approved,
        reviewedBy: input.reviewedBy,
      },
    );
    return new KnowledgeMarketplaceRecord(pipelined);
  }

  /* ---- Operation 5: Certify ---- */
  async certify(input: CertifyListingInput): Promise<CertifyListingResult> {
    const execution = this.requireExecution(input.token);
    const certification = {
      id: generateId(),
      listingId: execution.metadata.listingId,
      level: input.level,
      certifiedBy: input.certifiedBy,
      notes: input.notes,
      certifiedAt: new Date().toISOString(),
    };
    this.registry.register(KnowledgeMarketplaceRegistryBucket.CERTIFICATION, certification);

    const updated: KnowledgeMarketplaceExecution = { ...execution, certification };
    const pipelined = await this.runPipeline(
      updated,
      "certify_listing",
      MarketplacePackageStatus.CERTIFIED,
    );
    this.metrics.recordCertified();

    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_CERTIFIED,
      execution.context,
    );

    return { listing: new KnowledgeMarketplaceRecord(pipelined), certification };
  }

  /* ---- Operation 6: Publish ---- */
  async publish(input: PublishListingInput): Promise<KnowledgeMarketplaceRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "publish_listing",
      MarketplacePackageStatus.PUBLISHED,
      input.reason,
    );
    this.metrics.recordPublished();
    this.statistics.recordPublished(pipelined.metadata.category);

    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_PUBLISHED,
      execution.context,
    );
    return new KnowledgeMarketplaceRecord(pipelined);
  }

  /* ---- Operation 7: Deprecate ---- */
  async deprecate(input: DeprecateListingInput): Promise<KnowledgeMarketplaceRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "deprecate_listing",
      MarketplacePackageStatus.DEPRECATED,
      input.reason,
    );
    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_DEPRECATED,
      execution.context,
    );
    return new KnowledgeMarketplaceRecord(pipelined);
  }

  /* ---- Operation 8: Suspend ---- */
  async suspend(input: SuspendListingInput): Promise<KnowledgeMarketplaceRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "suspend_listing",
      MarketplacePackageStatus.SUSPENDED,
      input.reason,
    );
    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_SUSPENDED,
      execution.context,
    );
    return new KnowledgeMarketplaceRecord(pipelined);
  }

  /* ---- Operation 9: Archive ---- */
  async archive(input: ArchiveListingInput): Promise<KnowledgeMarketplaceRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "archive_listing",
      MarketplacePackageStatus.ARCHIVED,
      input.reason,
    );
    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_ARCHIVED,
      execution.context,
    );
    return new KnowledgeMarketplaceRecord(pipelined);
  }

  /* ---- Operation 10: Remove ---- */
  async remove(input: RemoveListingInput): Promise<KnowledgeMarketplaceRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "remove_listing",
      MarketplacePackageStatus.REMOVED,
      input.reason,
    );
    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_REMOVED,
      execution.context,
    );
    return new KnowledgeMarketplaceRecord(pipelined);
  }

  /* ---- Operation 11: Add Dependency ---- */
  async addDependency(input: AddDependencyInput): Promise<AddDependencyResult> {
    const execution = this.requireExecution(input.token);
    const dependency = {
      id: generateId(),
      listingId: execution.metadata.listingId,
      dependencyPackageId: input.dependencyPackageId,
      kind: input.kind,
      versionRange: input.versionRange,
      createdAt: new Date().toISOString(),
    };
    this.registry.register(KnowledgeMarketplaceRegistryBucket.DEPENDENCY, dependency);

    const updated: KnowledgeMarketplaceExecution = {
      ...execution,
      dependencies: [...execution.dependencies, dependency],
    };
    const pipelined = await this.runPipeline(updated, "add_dependency");
    this.metrics.recordDependency();

    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_UPDATED,
      execution.context,
    );

    return { listing: new KnowledgeMarketplaceRecord(pipelined), dependency };
  }

  /* ---- Operation 12: Remove Dependency ---- */
  async removeDependency(input: RemoveDependencyInput): Promise<KnowledgeMarketplaceRecord> {
    const execution = this.requireExecution(input.token);
    this.registry.remove(KnowledgeMarketplaceRegistryBucket.DEPENDENCY, input.dependencyId);

    const updated: KnowledgeMarketplaceExecution = {
      ...execution,
      dependencies: execution.dependencies.filter(
        (dependency) => dependency.id !== input.dependencyId,
      ),
    };
    const pipelined = await this.runPipeline(updated, "remove_dependency");

    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_UPDATED,
      execution.context,
    );

    return new KnowledgeMarketplaceRecord(pipelined);
  }

  /* ---- Operation 13: Add Compatibility ---- */
  async addCompatibility(input: AddCompatibilityInput): Promise<AddCompatibilityResult> {
    const execution = this.requireExecution(input.token);
    const compatibility = {
      ...this.factory.compatibility.create({
        listingId: execution.metadata.listingId,
        aosVersion: input.aosVersion,
        requiredKnowledgeVersion: input.requiredKnowledgeVersion,
        requiredPackages: input.requiredPackages,
        optionalPackages: input.optionalPackages,
        runtimeCompatibility: input.runtimeCompatibility,
        platformCompatibility: input.platformCompatibility,
      }),
      id: execution.metadata.listingId,
    };
    this.registry.replace(KnowledgeMarketplaceRegistryBucket.COMPATIBILITY, compatibility);

    const updated: KnowledgeMarketplaceExecution = { ...execution, compatibility };
    const pipelined = await this.runPipeline(updated, "add_compatibility");
    this.metrics.recordCompatibility();

    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_UPDATED,
      execution.context,
    );

    return { listing: new KnowledgeMarketplaceRecord(pipelined), compatibility };
  }

  /* ---- Operation 14: Update Metadata ---- */
  async updateMetadata(input: UpdateMetadataInput): Promise<KnowledgeMarketplaceRecord> {
    const execution = this.requireExecution(input.token);
    const updated: KnowledgeMarketplaceExecution = {
      ...execution,
      metadata: {
        ...execution.metadata,
        keywords: input.keywords ? [...input.keywords] : execution.metadata.keywords,
        tags: input.tags ? [...input.tags] : execution.metadata.tags,
        category: input.category ?? execution.metadata.category,
      },
      /* The Package is the authoritative source of category/marketplaceType — keep it in
       * sync with the Listing's metadata so the Integrity Validator (Stage 10) still holds. */
      package: input.category
        ? { ...execution.package, category: input.category }
        : execution.package,
    };
    const pipelined = await this.runPipeline(updated, "update_metadata");

    await this.events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.LISTING_UPDATED,
      execution.context,
    );

    return new KnowledgeMarketplaceRecord(pipelined);
  }

  /* ---- Operation 15: Search Metadata (read-only) ---- */
  searchMetadata(input: SearchMetadataInput): SearchMetadataResult {
    const entries = this.resolver.searchListings(input.keyword);
    this.metrics.recordSearch();
    return {
      listings: entries.map(
        (entry) => new KnowledgeMarketplaceRecord(this.manager.require(entry.token)),
      ),
    };
  }

  /* ---- Operation 16: Browse Category (read-only) ---- */
  browseCategory(input: BrowseCategoryInput): BrowseCategoryResult {
    const entries = this.resolver.browseCategory(input.category);
    this.metrics.recordBrowse();
    return {
      listings: entries.map(
        (entry) => new KnowledgeMarketplaceRecord(this.manager.require(entry.token)),
      ),
    };
  }

  get(token: string): KnowledgeMarketplaceRecord | undefined {
    const execution = this.manager.get(token);
    return execution ? new KnowledgeMarketplaceRecord(execution) : undefined;
  }

  require(token: string): KnowledgeMarketplaceRecord {
    return new KnowledgeMarketplaceRecord(this.requireExecution(token));
  }

  list(): readonly KnowledgeMarketplaceRecord[] {
    return this.manager.list().map((execution) => new KnowledgeMarketplaceRecord(execution));
  }

  count(): number {
    return this.manager.count();
  }

  /* ---- Private helpers ---- */

  /** Runs the 9-stage Pipeline, the Middleware chain, and persists the result via the Manager. */
  private async runPipeline(
    execution: KnowledgeMarketplaceExecution,
    operation: string,
    targetState?: MarketplacePackageStatus,
    reason?: string,
  ): Promise<KnowledgeMarketplaceExecution> {
    const result = this.pipeline.run({ execution, operation, targetState, reason });
    await this.middleware.run(result);
    this.manager.update(execution.instance.token, result);
    /* Keep the LISTING Registry bucket entry's metadata snapshot in sync so the
     * Resolver's "Search Metadata"/"Browse Category" queries never read stale metadata. */
    this.registry.replace(KnowledgeMarketplaceRegistryBucket.LISTING, {
      id: result.metadata.listingId,
      token: result.instance.token,
      metadata: result.metadata,
    });
    return result;
  }

  private requireExecution(token: string): KnowledgeMarketplaceExecution {
    const execution = this.manager.get(token);
    if (!execution) {
      throw new MarketplaceNotFoundException(`No Listing is registered for Token "${token}"`);
    }
    return execution;
  }
}
