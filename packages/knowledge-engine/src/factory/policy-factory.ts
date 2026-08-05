import type { KnowledgePolicyType } from "../domain/knowledge-policy-type.js";
import type { KnowledgePolicy } from "../domain/knowledge-policy.js";
import type { KnowledgeScope } from "../domain/knowledge-scope.js";
import { generateId } from "../utils/id.js";

export interface CreatePolicyInput {
  readonly name: string;
  readonly type: KnowledgePolicyType;
  readonly scope: KnowledgeScope;
  readonly rule?: Readonly<Record<string, unknown>>;
  readonly enabled?: boolean;
}

/** Builds a fresh `KnowledgePolicy` — `enabled` defaults to `true`. */
export class PolicyFactory {
  create(input: CreatePolicyInput): KnowledgePolicy {
    return {
      id: generateId(),
      name: input.name,
      type: input.type,
      scope: input.scope,
      rule: { ...input.rule },
      enabled: input.enabled ?? true,
      createdAt: new Date().toISOString(),
    };
  }
}
