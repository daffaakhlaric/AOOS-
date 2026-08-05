import type { KnowledgePolicyEngine } from "@aos/knowledge-engine";

import type { KnowledgeResult } from "../domain/knowledge-result.js";
import type { KnowledgeResolver } from "../resolver/knowledge-resolver.js";

/**
 * "POLICY RESOLVER: Apply Retention, Compliance, Sharing, Classification, Access,
 * Approval, Workspace Policy, Tenant Policy." (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md)
 * — filters out every `KnowledgeResult` whose underlying `KnowledgeAsset` violates a
 * registered Policy, reusing `@aos/knowledge-engine`'s real `KnowledgePolicyEngine`
 * rather than duplicating Policy evaluation logic. `KnowledgePolicyEngine.evaluate()`
 * only understands Retention/Classification/Compliance/Review rule fields (see
 * `@aos/knowledge-engine`'s own documented limitation) — Sharing/Access/Approval/
 * Workspace/Tenant Policy are recognized and scope-matched by that engine but never
 * yield violations, so they never reject a Result here either. A Result whose Asset can
 * no longer be resolved (an orphaned Index Entry) passes through — there is nothing to
 * evaluate a Policy against.
 */
export class KnowledgePolicyResolver {
  constructor(
    private readonly policyEngine: KnowledgePolicyEngine,
    private readonly resolver: KnowledgeResolver,
  ) {}

  resolve(results: readonly KnowledgeResult[]): {
    readonly allowed: readonly KnowledgeResult[];
    readonly rejectedCount: number;
  } {
    const allowed = results.filter((result) => {
      const asset = this.resolver.tryResolveAsset(result.assetId);
      if (!asset) {
        return true;
      }
      return this.policyEngine.evaluate(asset).length === 0;
    });
    return { allowed, rejectedCount: results.length - allowed.length };
  }
}
