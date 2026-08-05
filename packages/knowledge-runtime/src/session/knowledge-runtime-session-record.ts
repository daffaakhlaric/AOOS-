import { z } from "zod";

import { knowledgeRuntimeLeaseSchema } from "../domain/knowledge-runtime-lease.js";

import { KnowledgeRuntimeSessionState } from "./knowledge-runtime-session-state.js";

/** One open Session over a `KnowledgeRuntimeInstance` — "No persistence": `KnowledgeRuntimeSession` only ever holds these in memory. */
export const knowledgeRuntimeSessionRecordSchema = z.object({
  id: z.string().min(1),
  instanceToken: z.string().min(1),
  state: z.nativeEnum(KnowledgeRuntimeSessionState),
  lease: knowledgeRuntimeLeaseSchema,
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  renewedAt: z.string().datetime().optional(),
});

export type KnowledgeRuntimeSessionRecord = z.infer<typeof knowledgeRuntimeSessionRecordSchema>;
