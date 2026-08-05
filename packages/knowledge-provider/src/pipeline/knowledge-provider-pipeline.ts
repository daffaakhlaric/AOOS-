import { KnowledgeProviderCapabilities } from "../capabilities/knowledge-provider-capabilities.js";
import { KnowledgeProviderConfiguration } from "../configuration/knowledge-provider-configuration.js";
import type { KnowledgeProviderContext } from "../context/knowledge-provider-context.js";
import type { IKnowledgeProvider } from "../contracts/i-knowledge-provider.js";
import type { ProviderMetadataRecord } from "../domain/provider-metadata-record.js";
import { ProviderPermissionDeniedException } from "../errors/provider-permission-denied-exception.js";
import { ProviderPolicyViolationException } from "../errors/provider-policy-violation-exception.js";
import { ProviderValidationException } from "../errors/provider-validation-exception.js";
import { KnowledgeProviderEventType } from "../events/knowledge-provider-event-type.js";
import type { KnowledgeProviderEvents } from "../events/knowledge-provider-events.js";
import { KnowledgeProviderMetadata } from "../metadata/knowledge-provider-metadata.js";
import type { IKnowledgeProviderMetricsCollector } from "../metrics/i-knowledge-provider-metrics.js";
import type { IProviderPermissionChecker } from "../permission/i-provider-permission-checker.js";
import type { KnowledgeProviderPolicy } from "../policy/knowledge-provider-policy.js";
import type { KnowledgeProviderRegistry } from "../registry/knowledge-provider-registry.js";
import type { KnowledgeProviderResolver } from "../resolver/knowledge-provider-resolver.js";
import type { KnowledgeProviderValidator } from "../validator/knowledge-provider-validator.js";

export interface KnowledgeProviderPipelineOptions {
  readonly permissionChecker?: IProviderPermissionChecker;
}

export interface RunProviderPipelineInput {
  readonly metadata: ProviderMetadataRecord;
  readonly context: KnowledgeProviderContext;
}

export interface RunProviderPipelineOutput {
  readonly provider: IKnowledgeProvider;
  readonly capabilities: KnowledgeProviderCapabilities;
}

/**
 * "PROVIDER PIPELINE: Validation → Capability Resolution → Configuration → Policy →
 * Permission → Provider Resolution → Metadata → Metrics → Events."
 * (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — runs all 9 stages, in this fixed order,
 * for one Provider registration/use. Only the two stages this Pipeline can fully
 * attribute publish events themselves (`UPDATED` after the Metadata stage,
 * `FAILED` on any stage exception) — the rest of the Provider Lifecycle's events are
 * published by the outer `KnowledgeProvider` façade, which owns the State Machine
 * transitions they describe, mirroring `@aos/knowledge-synchronization`'s Pipeline/
 * Synchronizer event-publishing split.
 */
export class KnowledgeProviderPipeline {
  private readonly configuration = new KnowledgeProviderConfiguration();
  private readonly metadataRegistry: KnowledgeProviderMetadata;

  constructor(
    private readonly validator: KnowledgeProviderValidator,
    private readonly policy: KnowledgeProviderPolicy,
    private readonly resolver: KnowledgeProviderResolver,
    registry: KnowledgeProviderRegistry,
    private readonly metrics: IKnowledgeProviderMetricsCollector,
    private readonly events: KnowledgeProviderEvents,
    private readonly options: KnowledgeProviderPipelineOptions = {},
  ) {
    this.metadataRegistry = new KnowledgeProviderMetadata(registry);
  }

  async run(input: RunProviderPipelineInput): Promise<RunProviderPipelineOutput> {
    try {
      return await this.runStages(input);
    } catch (error) {
      this.metrics.recordFailure();
      await this.events.publishProviderEvent(KnowledgeProviderEventType.FAILED, input.context, {
        providerId: input.metadata.providerId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async runStages(input: RunProviderPipelineInput): Promise<RunProviderPipelineOutput> {
    const { metadata, context } = input;

    // 1. Validation
    const validation = this.validator.validate({ metadata, context });
    if (!validation.valid) {
      throw new ProviderValidationException(
        `Provider "${metadata.providerId}" failed provider validation: ${validation.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    // 2. Capability Resolution
    const capabilities = new KnowledgeProviderCapabilities(metadata.providerCapabilities);
    for (const flag of capabilities.list()) {
      this.metrics.recordCapabilityUsage(flag);
    }

    // 3. Configuration
    this.configuration.assertValid(metadata.providerConfiguration);

    // 4. Policy
    const violations = this.policy.evaluate(metadata, context);
    if (violations.length > 0) {
      throw new ProviderPolicyViolationException(
        `Policy denied Provider "${metadata.providerId}": ${violations
          .map((violation) => violation.reason)
          .join("; ")}`,
      );
    }

    // 5. Permission
    if (
      this.options.permissionChecker &&
      !(await this.options.permissionChecker.check(metadata, context))
    ) {
      throw new ProviderPermissionDeniedException(
        `Permission denied for Provider "${metadata.providerId}" in Context "${context.correlationId}"`,
      );
    }

    // 6. Provider Resolution
    const provider = this.resolver.resolveById(context.providerId);

    // 7. Metadata
    this.metadataRegistry.register(metadata);
    await this.events.publishProviderEvent(KnowledgeProviderEventType.UPDATED, context, {
      providerId: metadata.providerId,
    });

    // 8. Metrics
    this.metrics.recordProviderCategory(metadata.providerCategory);
    this.metrics.recordProviderUsage(metadata.providerId);
    this.metrics.recordTenantUsage(context.tenantId);
    if (context.workspaceId) {
      this.metrics.recordWorkspaceUsage(context.workspaceId);
    }

    // 9. Events — Provider Lifecycle events (Registered/Enabled/Disabled/Connected/
    // Disconnected) are published by the outer KnowledgeProvider façade.
    return { provider, capabilities };
  }
}
