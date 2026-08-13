import type { Branch } from "@aos/meta-ads-connector";

/** Published when `ProcessCreativeBrief` fails the whole package — total image generation failure, or a failed `@aos/asset-library` query/persist (spec's error-handling rules; NOT raised for a graceful video-to-images-only fallback or a partial 1-of-N image failure). */
export interface CreativeGenerationFailed {
  readonly briefId: string;
  readonly jobId?: string;
  readonly branch: Branch;
  readonly unit: string;
  readonly reason: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: string;
}
