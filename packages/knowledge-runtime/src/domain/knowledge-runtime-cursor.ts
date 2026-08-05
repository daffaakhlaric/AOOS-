import { z } from "zod";

/** A position marker into a `KnowledgeRuntimeInstance`'s History — used by `KnowledgeRuntimeManager` to track "how far" a caller has read, never to re-derive state (that is the State Machine's job alone). */
export const knowledgeRuntimeCursorSchema = z.object({
  token: z.string().min(1),
  position: z.number().int().nonnegative(),
});

export type KnowledgeRuntimeCursor = z.infer<typeof knowledgeRuntimeCursorSchema>;

export function advanceCursor(cursor: KnowledgeRuntimeCursor, by = 1): KnowledgeRuntimeCursor {
  return { ...cursor, position: cursor.position + by };
}

export function resetCursor(token: string): KnowledgeRuntimeCursor {
  return { token, position: 0 };
}
