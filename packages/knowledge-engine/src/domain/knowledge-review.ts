import { z } from "zod";

/** "KnowledgeApproval" — a single approve/reject decision, produced by an `IKnowledgeApprover` (interface only). */
export const knowledgeApprovalSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  approverId: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected"]),
  decidedAt: z.string().datetime().optional(),
  comment: z.string().optional(),
});

export type KnowledgeApproval = z.infer<typeof knowledgeApprovalSchema>;

/** "KnowledgeReview" — a single review pass, produced by an `IKnowledgeReviewer` (interface only). */
export const knowledgeReviewSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  reviewerId: z.string().min(1),
  status: z.enum(["pending", "completed"]),
  completedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export type KnowledgeReview = z.infer<typeof knowledgeReviewSchema>;
