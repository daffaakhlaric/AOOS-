import { z } from "zod";

import { knowledgeVersionStateSchema } from "./knowledge-version-state-schema.js";

/**
 * "KnowledgeSnapshot" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Domain Model") —
 * one point-in-time snapshot record of a version: which lifecycle state it was captured
 * in, when, and why. Metadata only — capturing the actual asset content behind a
 * snapshot is delegated to the `IKnowledgeSnapshotProvider` Extension Point.
 */
export const knowledgeSnapshotSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
  name: z.string().optional(),
  capturedState: knowledgeVersionStateSchema,
  reason: z.string().optional(),
  capturedBy: z.string().optional(),
  capturedAt: z.string().datetime(),
});

export type KnowledgeSnapshot = z.infer<typeof knowledgeSnapshotSchema>;
