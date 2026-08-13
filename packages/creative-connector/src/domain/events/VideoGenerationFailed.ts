/** Payload for `aaos.creative-connector.video.generation-failed`, emitted when `TaskPoller` observes `successFlag=2|3`, or times out, on a video task. */
export interface VideoGenerationFailed {
  readonly taskId: string;
  readonly reason: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
