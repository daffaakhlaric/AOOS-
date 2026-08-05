import { z } from "zod";

import { KnowledgePolicyType } from "./knowledge-policy-type.js";
import { knowledgeScopeSchema } from "./knowledge-scope.js";

/** "POLICY ENGINE" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — one governance rule evaluated by `policy/knowledge-policy-engine.ts`. `rule` is a generic, engine-interpreted config bag (e.g. `{ maxAgeDays: 90 }` for a Retention Policy) — this package defines no policy expression language. */
export const knowledgePolicySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.nativeEnum(KnowledgePolicyType),
  scope: knowledgeScopeSchema,
  rule: z.record(z.unknown()),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
});

export type KnowledgePolicy = z.infer<typeof knowledgePolicySchema>;
