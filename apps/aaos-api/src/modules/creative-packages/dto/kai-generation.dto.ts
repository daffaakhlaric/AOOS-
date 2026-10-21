import { z } from "zod";

export const EnqueueKaiJobsSchema = z
  .object({
    reviewedRevisions: z.record(z.string().uuid(), z.number().int().positive()).optional(),
    renderMode: z.enum(["FULL", "SAMPLE"]).optional(),
    conceptIds: z
      .array(z.string().uuid())
      .min(1)
      .max(10)
      .refine((ids) => new Set(ids).size === ids.length, "Concept IDs harus unik."),
  })
  .strict();
export type EnqueueKaiJobs = z.infer<typeof EnqueueKaiJobsSchema>;

/** Public projection: provider URLs, lease ownership and raw prompts stay server-side. */
export interface KaiJobStatus {
  renderMode?: "FULL" | "SAMPLE";
  id: string;
  concept_id: string;
  brief_id: string;
  storyboard_id: string;
  status: string;
  format: string;
  model: string;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  assets?: {
    id: string;
    url: string;
    mimeType: string;
    previewUrl?: string;
    ratio: string;
    durationSeconds?: number;
  }[];
  qa?: {
    passed: boolean;
    checkedAt: string;
    checks: { check: string; passed: boolean; detail: string }[];
  };
}
