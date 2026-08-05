import {
  KNOWLEDGE_CLASSIFICATION_RANK,
  parseKnowledgeNamespace,
  type KnowledgeAsset,
  type KnowledgeRelationship,
} from "@aos/knowledge-engine";

import { KnowledgeIndexBuilder } from "../builder/knowledge-index-builder.js";
import type { KnowledgeIndexContext } from "../context/knowledge-index-context.js";
import type { KnowledgeIndexEntry } from "../domain/knowledge-index-entry.js";
import type { KnowledgeIndexType } from "../domain/knowledge-index-type.js";
import { IndexValidationException } from "../errors/index-validation-exception.js";
import type { IKnowledgeIndexMetrics } from "../metrics/i-knowledge-index-metrics.js";
import { KnowledgeIndexRegistryBucket } from "../registry/knowledge-index-registry-bucket.js";
import type { KnowledgeIndexRegistry } from "../registry/knowledge-index-registry.js";
import type { KnowledgeIndexValidator } from "../validator/knowledge-index-validator.js";

import type { IKnowledgeIndexChecker } from "./i-index-checker.js";

export interface KnowledgeIndexPipelineOptions {
  readonly permissionChecker?: IKnowledgeIndexChecker;
  readonly policyChecker?: IKnowledgeIndexChecker;
}

export interface RunPipelineInput {
  readonly asset: KnowledgeAsset;
  readonly indexTypes: readonly KnowledgeIndexType[];
  readonly context: KnowledgeIndexContext;
  readonly relationships?: readonly KnowledgeRelationship[];
}

/**
 * "PIPELINE: Validation → Metadata → Classification → Namespace → Policy → Permission →
 * Relationship → Builder → Registry → Metrics." (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md)
 * — runs all 10 stages, in this fixed order, for one `KnowledgeAsset` across every
 * requested `KnowledgeIndexType`. Permission/Policy stay permissive by default when no
 * checker is configured, matching the pattern established by `@aos/knowledge-runtime`.
 */
export class KnowledgeIndexPipeline {
  private readonly builder = new KnowledgeIndexBuilder();

  constructor(
    private readonly validator: KnowledgeIndexValidator,
    private readonly registry: KnowledgeIndexRegistry,
    private readonly metrics: IKnowledgeIndexMetrics,
    private readonly options: KnowledgeIndexPipelineOptions = {},
  ) {}

  async run(input: RunPipelineInput): Promise<readonly KnowledgeIndexEntry[]> {
    const startedAt = performance.now();
    const { asset, indexTypes, context } = input;

    // 1. Validation
    const result = this.validator.validate({ asset, context, registry: this.registry, indexTypes });
    if (!result.valid) {
      this.metrics.recordBuildFailed();
      throw new IndexValidationException(
        `KnowledgeAsset "${asset.id}" failed index validation: ${result.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    // 2. Metadata — normalize language onto the Context if the Asset declares one and the Context does not.
    const enrichedContext: KnowledgeIndexContext = {
      ...context,
      language: context.language ?? asset.metadata.language,
    };

    // 3. Classification — annotate the Context with the Classification's sensitivity rank.
    enrichedContext.variables["classificationRank"] =
      KNOWLEDGE_CLASSIFICATION_RANK[asset.classification];

    // 4. Namespace — annotate the Context with the parsed namespace components.
    enrichedContext.variables["namespace"] = parseKnowledgeNamespace(asset.namespace);

    // 5. Policy
    if (
      this.options.policyChecker &&
      !(await this.options.policyChecker.check(asset, enrichedContext))
    ) {
      this.metrics.recordBuildFailed();
      throw new IndexValidationException(`Policy denied indexing KnowledgeAsset "${asset.id}"`);
    }

    // 6. Permission
    if (
      this.options.permissionChecker &&
      !(await this.options.permissionChecker.check(asset, enrichedContext))
    ) {
      this.metrics.recordBuildFailed();
      throw new IndexValidationException(`Permission denied indexing KnowledgeAsset "${asset.id}"`);
    }

    // 7. Relationship
    if (input.relationships) {
      enrichedContext.variables["relationships"] = input.relationships;
    }

    // 8. Builder
    const entries = indexTypes.flatMap((indexType) =>
      this.builder.build(asset, indexType, enrichedContext),
    );

    // 9. Registry
    for (const entry of entries) {
      this.registry.replace(KnowledgeIndexRegistryBucket.INDEX, entry);
    }

    // 10. Metrics
    for (const entry of entries) {
      this.metrics.recordEntryBuilt(entry.indexType);
    }
    this.metrics.recordTenantUsage(asset.scope.tenantId);
    if (asset.scope.workspaceId) {
      this.metrics.recordWorkspaceUsage(asset.scope.workspaceId);
    }
    this.metrics.recordBuildCompleted(performance.now() - startedAt);

    return entries;
  }
}
