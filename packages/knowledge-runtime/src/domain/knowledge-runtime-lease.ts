import { z } from "zod";

/** A time-bound exclusive hold on one `KnowledgeRuntimeInstance` — the data shape a `KnowledgeRuntimeSession` renews/releases; actual distributed-lease acquisition is delegated to the interface-only `IKnowledgeRuntimeLeaseProvider` extension point. */
export const knowledgeRuntimeLeaseSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  holder: z.string().min(1),
  acquiredAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type KnowledgeRuntimeLease = z.infer<typeof knowledgeRuntimeLeaseSchema>;

export function isLeaseExpired(lease: KnowledgeRuntimeLease, now: Date = new Date()): boolean {
  return Date.parse(lease.expiresAt) <= now.getTime();
}
