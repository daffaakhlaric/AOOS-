/** Payload for `aaos.creative-connector.image.generation-failed`, emitted when `TaskPoller` observes `successFlag=2|3`, or times out, on an image task. */
export interface ImageGenerationFailed {
  readonly taskId: string;
  readonly reason: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
