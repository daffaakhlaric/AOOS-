import { z } from "zod";

/** Semantic Version for one Index Entry — bumped whenever the underlying Knowledge Asset changes and the Entry is rebuilt. */
export const knowledgeIndexVersionSchema = z.object({
  major: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
  patch: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export type KnowledgeIndexVersion = z.infer<typeof knowledgeIndexVersionSchema>;

export function formatKnowledgeIndexVersion(version: KnowledgeIndexVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export function createKnowledgeIndexVersion(): KnowledgeIndexVersion {
  return { major: 1, minor: 0, patch: 0, createdAt: new Date().toISOString() };
}

export function bumpKnowledgeIndexVersion(version: KnowledgeIndexVersion): KnowledgeIndexVersion {
  return { ...version, patch: version.patch + 1, createdAt: new Date().toISOString() };
}
