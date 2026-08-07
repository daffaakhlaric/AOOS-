import type {
  IKnowledgeVersionValidator,
  KnowledgeVersionValidationInput,
  KnowledgeVersionValidationResult,
} from "../contracts/i-knowledge-version-validator.js";
import { KnowledgeVersionPolicy } from "../policy/knowledge-version-policy.js";

/**
 * Stage 6 — Policy: runs the real `KnowledgeVersionPolicy` evaluator against the
 * version's `versionType` (and its branch's `branchType` when resolved), mapping every
 * violation to a validation issue. A standalone `KnowledgeVersionValidator` constructed
 * without a shared Policy instance evaluates against an empty policy set (no
 * violations) — the Pipeline always passes `KnowledgeVersioning`'s shared instance.
 */
export class PolicyValidator implements IKnowledgeVersionValidator {
  readonly name = "policy";

  constructor(private readonly policy: KnowledgeVersionPolicy = new KnowledgeVersionPolicy()) {}

  validate(input: KnowledgeVersionValidationInput): KnowledgeVersionValidationResult {
    const issues = this.policy
      .evaluate(input.metadata, input.context, input.branch?.branchType)
      .map((violation) => ({
        path: `policy.${violation.policyId}`,
        message: violation.reason,
      }));
    return { valid: issues.length === 0, issues };
  }
}
