// Public API — matches docs/PROMPT-AAOS-W3G-CREATIVE-CONNECTOR.md's "Public API" section exactly,
// plus a small number of additive exports (marked below) useful to W3H's "Kai" orchestrator.

export { CreativeConnectorFactory } from "./factories/CreativeConnectorFactory.js";
export type {
  CreativeConnectorFactoryOptions,
  CreativeConnectorBundle,
} from "./factories/CreativeConnectorFactory.js";

export { UploadSourceImage } from "./application/use-cases/UploadSourceImage.js";
export { GenerateVideoFromImage } from "./application/use-cases/GenerateVideoFromImage.js";
export type {
  GenerateVideoFromImageInput,
  GenerateVideoFromImageError,
} from "./application/use-cases/GenerateVideoFromImage.js";
export { GenerateVideoFromText } from "./application/use-cases/GenerateVideoFromText.js";
export type {
  GenerateVideoFromTextInput,
  GenerateVideoFromTextError,
} from "./application/use-cases/GenerateVideoFromText.js";
export { GenerateLongVideo } from "./application/use-cases/GenerateLongVideo.js";
export type {
  GenerateLongVideoInput,
  GenerateLongVideoError,
} from "./application/use-cases/GenerateLongVideo.js";
export { GenerateImage } from "./application/use-cases/GenerateImage.js";
export type {
  GenerateImageInput,
  GenerateImageError,
} from "./application/use-cases/GenerateImage.js";
export { GenerateImageSet } from "./application/use-cases/GenerateImageSet.js";
export type {
  GenerateImageSetInput,
  GenerateImageSetResult,
} from "./application/use-cases/GenerateImageSet.js";
export { DownloadMedia } from "./application/use-cases/DownloadMedia.js";
// Additive: a one-shot status lookup, distinct from the poll-to-completion use cases above.
export { GetTaskStatus } from "./application/use-cases/GetTaskStatus.js";

export { VideoGenerationService } from "./application/services/VideoGenerationService.js";
export { ImageGenerationService } from "./application/services/ImageGenerationService.js";
export { FileUploadService } from "./application/services/FileUploadService.js";
// Additive: the application-layer poll wrapper every "GenerateX" use case is composed with.
export { TaskPollingService } from "./application/services/TaskPollingService.js";
// Additive: PROMPT 53 (Phase 41) — lets a real inbound Kie AI webhook callback wake an in-flight
// TaskPoller early. See TaskWakeRegistry.ts's own doc for the full design.
export { TaskWakeRegistry } from "./infrastructure/polling/TaskWakeRegistry.js";
export type { ITaskWakeRegistry } from "./infrastructure/polling/TaskWakeRegistry.js";

export type {
  GenerationTask,
  GeneratedVideo,
  GeneratedImage,
  UploadedFile,
} from "./domain/entities/index.js";

export { TaskStatus } from "./domain/value-objects/TaskStatus.js";
export { VideoModel } from "./domain/value-objects/VideoModel.js";
export { ImageModel } from "./domain/value-objects/ImageModel.js";
// Additive: PROMPT 48's minimal, honest static model registry + its video-model routing helper.
// PROMPT 50 (Phase 36) adds `GenerationQualityTier`, an opt-in tier-to-model mapping over the
// same registry — see GenerationModel.ts's own docstrings for the honest scope (video-only, not
// tenant-plan-gated: no real tenant-plan concept exists in this codebase).
export {
  GENERATION_MODEL_REGISTRY,
  GenerationQualityTier,
  resolveVideoModel,
} from "./domain/value-objects/GenerationModel.js";
export type {
  GenerationModelKind,
  GenerationModelEntry,
  SpeedTier,
  VideoUrgencyTier,
} from "./domain/value-objects/GenerationModel.js";
export { AspectRatio } from "./domain/value-objects/AspectRatio.js";
export { GenerationType } from "./domain/value-objects/GenerationType.js";
export { TaskId } from "./domain/value-objects/TaskId.js";
export type { FileUrl, MediaUrl } from "./domain/value-objects/index.js";
// Additive: the raw Kie AI successFlag VO and its smart constructor.
export { SuccessFlag, parseSuccessFlag } from "./domain/value-objects/SuccessFlag.js";
// Additive: see design resolution #3 — DurationSeconds (5|8) vs. ExtendDurationSeconds (1-8).
export { DurationSeconds } from "./domain/value-objects/DurationSeconds.js";
export { ExtendDurationSeconds } from "./domain/value-objects/ExtendDurationSeconds.js";

export type {
  FileUploaded,
  VideoGenerationCompleted,
  VideoGenerationFailed,
  ImageGenerationCompleted,
} from "./domain/events/index.js";
// Additive: also expose the started/failed-image event payload types and the publisher wrapper.
export type {
  VideoGenerationStarted,
  ImageGenerationStarted,
  ImageGenerationFailed,
} from "./domain/events/index.js";
export { CreativeConnectorEvents } from "./domain/events/index.js";

export {
  CreativeConnectorError,
  KieApiError,
  FileUploadError,
  TaskTimeoutError,
  GenerationFailedError,
  RateLimitError,
} from "./domain/errors/index.js";

export type { CreativeConnectorConfig } from "./config/CreativeConnectorConfig.js";
// Additive: the Zod-backed parser real callers need to actually produce a validated config.
export {
  parseCreativeConnectorConfig,
  CreativeConnectorConfigSchema,
} from "./config/CreativeConnectorConfig.js";
export type { CreativeConnectorConfigInput } from "./config/CreativeConnectorConfig.js";
