import { z } from "zod";

/** "KnowledgeOwner" — the accountable owner of one `KnowledgeAsset`. */
export const knowledgeOwnerSchema = z.object({
  userId: z.string().min(1),
  assignedAt: z.string().datetime(),
});

export type KnowledgeOwner = z.infer<typeof knowledgeOwnerSchema>;

/** "KnowledgePublisher" — who published (moved to `PUBLISHED`) one `KnowledgeAsset`. */
export const knowledgePublisherSchema = z.object({
  userId: z.string().min(1),
  publishedAt: z.string().datetime(),
});

export type KnowledgePublisher = z.infer<typeof knowledgePublisherSchema>;

/** "KnowledgeConsumer" — one recorded consumption of a `KnowledgeAsset` by another AOS module/user. */
export const knowledgeConsumerSchema = z.object({
  consumerId: z.string().min(1),
  consumedAt: z.string().datetime(),
});

export type KnowledgeConsumer = z.infer<typeof knowledgeConsumerSchema>;
