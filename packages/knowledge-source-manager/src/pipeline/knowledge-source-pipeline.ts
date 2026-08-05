import type { KnowledgeSourceCatalog } from "../catalog/knowledge-source-catalog.js";
import type { KnowledgeSourceConfigurationRecord } from "../configuration/knowledge-source-configuration-record.js";
import { KnowledgeSourceConfiguration } from "../configuration/knowledge-source-configuration.js";
import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";
import type { IKnowledgeSourceProviderResolver } from "../contracts/i-knowledge-source-provider-resolver.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";
import { SourcePermissionDeniedException } from "../errors/source-permission-denied-exception.js";
import { SourcePolicyViolationException } from "../errors/source-policy-violation-exception.js";
import { SourceValidationException } from "../errors/source-validation-exception.js";
import { KnowledgeSourceEventType } from "../events/knowledge-source-event-type.js";
import type { KnowledgeSourceEvents } from "../events/knowledge-source-events.js";
import type { IKnowledgeSourceMetricsCollector } from "../metrics/i-knowledge-source-metrics-collector.js";
import type { KnowledgeSourcePermission } from "../permission/knowledge-source-permission.js";
import type { KnowledgeSourcePolicy } from "../policy/knowledge-source-policy.js";
import { KnowledgeSourceRegistryBucket } from "../registry/knowledge-source-registry-bucket.js";
import type { KnowledgeSourceRegistry } from "../registry/knowledge-source-registry.js";
import type { SourceRegistryEntry } from "../registry/source-registry-entry.js";
import type { KnowledgeSourceValidator } from "../validator/knowledge-source-validator.js";

export interface KnowledgeSourcePipelineOptions {
  readonly providerResolver?: IKnowledgeSourceProviderResolver;
}

export interface RunSourcePipelineInput {
  readonly metadata: KnowledgeSourceMetadataRecord;
  readonly configuration: KnowledgeSourceConfigurationRecord;
  readonly context: KnowledgeSourceContext;
}

export interface RunSourcePipelineOutput {
  readonly metadata: KnowledgeSourceMetadataRecord;
  readonly configuration: KnowledgeSourceConfigurationRecord;
}

/**
 * "SOURCE PIPELINE: Validation -> Configuration -> Policy -> Permission -> Provider
 * Resolution -> Registration -> Catalog -> Metrics -> Events."
 * (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — runs all 9 stages, in this fixed
 * order, for one Source registration. Provider Resolution (stage 5) is optional and
 * interface-only — "Only interface references." — this Pipeline never imports
 * `@aos/knowledge-provider`; when no `providerResolver` is supplied the stage is a
 * no-op pass-through. Judgment call: unlike `@aos/knowledge-provider`'s Pipeline, this
 * one publishes no "failed" event on error — the Source Lifecycle has no Failed state
 * and the Events list has no matching event type, so a stage exception simply
 * propagates without a state transition or a publish.
 */
export class KnowledgeSourcePipeline {
  private readonly configuration = new KnowledgeSourceConfiguration();

  constructor(
    private readonly validator: KnowledgeSourceValidator,
    private readonly policy: KnowledgeSourcePolicy,
    private readonly permission: KnowledgeSourcePermission,
    private readonly registry: KnowledgeSourceRegistry,
    private readonly catalog: KnowledgeSourceCatalog,
    private readonly metrics: IKnowledgeSourceMetricsCollector,
    private readonly events: KnowledgeSourceEvents,
    private readonly options: KnowledgeSourcePipelineOptions = {},
  ) {}

  async run(input: RunSourcePipelineInput): Promise<RunSourcePipelineOutput> {
    const { metadata, configuration, context } = input;

    // 1. Validation
    const validation = this.validator.validate({ metadata, context, configuration });
    if (!validation.valid) {
      throw new SourceValidationException(
        `Source "${metadata.sourceId}" failed source validation: ${validation.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    // 2. Configuration
    this.configuration.assertValid(configuration);

    // 3. Policy
    const violations = this.policy.evaluate(metadata, context);
    if (violations.length > 0) {
      throw new SourcePolicyViolationException(
        `Policy denied Source "${metadata.sourceId}": ${violations
          .map((violation) => violation.reason)
          .join("; ")}`,
      );
    }

    // 4. Permission
    if (!this.permission.check(context, metadata)) {
      throw new SourcePermissionDeniedException(
        `Permission denied for Source "${metadata.sourceId}" in Context "${context.correlationId}"`,
      );
    }

    // 5. Provider Resolution — interface-only, optional
    if (this.options.providerResolver) {
      await this.options.providerResolver.resolveProvider(metadata.providerId);
    }

    // 6. Registration
    const entry: SourceRegistryEntry = { id: metadata.sourceId, metadata, configuration };
    this.registry.replace(KnowledgeSourceRegistryBucket.SOURCE, entry);

    // 7. Catalog
    this.catalog.register(metadata);

    // 8. Metrics
    this.recordMetrics();

    // 9. Events
    await this.events.publishSourceEvent(KnowledgeSourceEventType.REGISTERED, context, {
      sourceId: metadata.sourceId,
    });

    return { metadata, configuration };
  }

  private recordMetrics(): void {
    const entries = this.registry.list<SourceRegistryEntry>(KnowledgeSourceRegistryBucket.SOURCE);
    this.metrics.setSourceCount(this.catalog.count());
    this.metrics.setProviderCount(this.catalog.providerCount());
    this.metrics.setWorkspaceCount(this.catalog.workspaceCount());
    this.metrics.setTenantCount(this.catalog.tenantCount());
    this.metrics.setNamespaceCount(this.catalog.namespaceCount());
    this.metrics.setCollectionCount(this.catalog.collectionCount());
    this.metrics.setSyncEnabledCount(
      entries.filter((entry) => entry.configuration.autoSync).length,
    );
    this.metrics.setScheduleCount(entries.filter((entry) => entry.configuration.schedule).length);
    this.metrics.setPolicyCount(this.registry.count(KnowledgeSourceRegistryBucket.POLICY));
    this.metrics.setPermissionCount(this.registry.count(KnowledgeSourceRegistryBucket.PERMISSION));
  }
}
