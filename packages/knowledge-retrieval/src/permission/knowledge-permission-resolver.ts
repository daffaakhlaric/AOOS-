import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { KnowledgeResult } from "../domain/knowledge-result.js";

import type { IResultPermissionChecker } from "./i-result-permission-checker.js";

/**
 * "PERMISSION RESOLVER: Permission filtering happens BEFORE results are returned. Never
 * expose unauthorized knowledge." (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — filters
 * out every `KnowledgeResult` an optional injected `IResultPermissionChecker` rejects.
 * Permissive by default when no checker is configured, matching the pattern established
 * by `@aos/knowledge-runtime`'s `PermissionMiddleware`.
 */
export class KnowledgePermissionResolver {
  constructor(private readonly checker?: IResultPermissionChecker) {}

  async resolve(
    results: readonly KnowledgeResult[],
    context: KnowledgeQueryContext,
  ): Promise<{ readonly allowed: readonly KnowledgeResult[]; readonly rejectedCount: number }> {
    const checker = this.checker;
    if (!checker) {
      return { allowed: results, rejectedCount: 0 };
    }
    const checks = await Promise.all(
      results.map((result) => Promise.resolve(checker.check(result, context))),
    );
    const allowed = results.filter((_, index) => checks[index]);
    const rejectedCount = results.length - allowed.length;
    return { allowed, rejectedCount };
  }
}
