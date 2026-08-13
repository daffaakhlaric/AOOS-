/** Payload for `aaos.creative-connector.image.generation-completed`, emitted once `TaskPoller` observes `successFlag=1` on an image task. */
export interface ImageGenerationCompleted {
  readonly taskId: string;
  readonly imageUrl: string;
  readonly model: string;
  readonly aspectRatio: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
