/** Payload for `aaos.creative-connector.image.generation-started`, emitted right after Kie AI accepts a `/api/v1/jobs/createTask` call and returns a `taskId`. */
export interface ImageGenerationStarted {
  readonly taskId: string;
  readonly model: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
