import { z } from "zod";

/** "KNOWLEDGE VERSIONING: Semantic Version. Major, Minor, Patch." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md). */
export const knowledgeVersionSchema = z.object({
  major: z.number().int().min(0),
  minor: z.number().int().min(0),
  patch: z.number().int().min(0),
  label: z.string().min(1),
  createdAt: z.string().datetime(),
  createdBy: z.string().optional(),
});

export type KnowledgeVersion = z.infer<typeof knowledgeVersionSchema>;

export function formatKnowledgeVersion(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}

export function createKnowledgeVersion(
  input: {
    readonly major?: number;
    readonly minor?: number;
    readonly patch?: number;
    readonly createdBy?: string;
  } = {},
): KnowledgeVersion {
  const major = input.major ?? 1;
  const minor = input.minor ?? 0;
  const patch = input.patch ?? 0;
  return {
    major,
    minor,
    patch,
    label: formatKnowledgeVersion(major, minor, patch),
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };
}

/**
 * "History. Rollback. Compare. Snapshot. Diff. Branch. Merge. No storage implementation.
 * Only contracts." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — `KnowledgeSnapshot` is the
 * data shape a `version/knowledge-version-engine.ts` History entry captures; the History
 * itself lives in-memory inside the Engine (see Known Limitations for the "no storage"
 * caveat), not behind a persistence contract.
 */
export const knowledgeSnapshotSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  version: knowledgeVersionSchema,
  capturedAt: z.string().datetime(),
  data: z.record(z.unknown()),
});

export type KnowledgeSnapshot = z.infer<typeof knowledgeSnapshotSchema>;
