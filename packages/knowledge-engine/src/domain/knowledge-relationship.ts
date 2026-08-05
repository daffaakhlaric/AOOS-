import { z } from "zod";

import { KnowledgeRelationshipType } from "./knowledge-relationship-type.js";

/** "KNOWLEDGE RELATIONSHIPS" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — one directed edge between two `KnowledgeAsset` ids. */
export const knowledgeRelationshipSchema = z.object({
  id: z.string().min(1),
  fromAssetId: z.string().min(1),
  toAssetId: z.string().min(1),
  type: z.nativeEnum(KnowledgeRelationshipType),
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type KnowledgeRelationship = z.infer<typeof knowledgeRelationshipSchema>;

/** A `KnowledgeRelationship` narrowed to `REFERENCE` — "Reference" from the Core Domain list. */
export type KnowledgeReference = KnowledgeRelationship & {
  readonly type: KnowledgeRelationshipType.REFERENCE;
};

/** A `KnowledgeRelationship` narrowed to `DEPENDS_ON` — "Dependency" from the Core Domain list. */
export type KnowledgeDependency = KnowledgeRelationship & {
  readonly type: KnowledgeRelationshipType.DEPENDS_ON;
};
