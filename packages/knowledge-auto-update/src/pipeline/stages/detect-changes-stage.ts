import type { AssetMetadataSnapshot } from "../../services/knowledge-update-detector.js";
import type { Metadata } from "../../types/common.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

function toSnapshot(payload: Metadata): AssetMetadataSnapshot {
  return {
    version: typeof payload.version === "string" ? payload.version : undefined,
    checksum: typeof payload.checksum === "string" ? payload.checksum : undefined,
    lastModifiedAt: typeof payload.lastModifiedAt === "number" ? payload.lastModifiedAt : undefined,
    extra: payload,
  };
}

/** Stage 1: compares the job's previous and current payload snapshots for real changes. */
export class DetectChangesStage implements PipelineStage {
  readonly name = "detect-changes";

  execute(context: PipelineContext): PipelineContext {
    const previous = toSnapshot(context.job.previousPayload ?? {});
    const current = toSnapshot(context.job.payload);
    context.detection = context.detector.detect(previous, current);
    return context;
  }
}
