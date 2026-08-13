/** Payload for `aaos.creative-connector.video.generation-completed`, emitted once `TaskPoller` observes `successFlag=1` on a video task. */
export interface VideoGenerationCompleted {
  readonly taskId: string;
  readonly videoUrl: string;
  readonly model: string;
  readonly aspectRatio: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
