/** Payload for `aaos.creative-connector.video.generation-started`, emitted right after Kie AI accepts a `/api/v1/veo/generate` (or extend) call and returns a `taskId`. */
export interface VideoGenerationStarted {
  readonly taskId: string;
  readonly generationType: string;
  readonly model: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
