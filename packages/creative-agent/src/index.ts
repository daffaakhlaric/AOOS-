// Public API — matches docs/PROMPT-AAOS-W3H-CREATIVE-AGENT.md's "Public API" section, plus a
// small number of additive exports (marked below) real composition/tests need, mirroring
// @aos/creative-connector's own index.ts convention.

export { KaiAgentFactory } from "./factories/KaiAgentFactory.js";
// Additive: the options/runtime bundle shapes `KaiAgentFactory.create` accepts/returns.
export type { KaiAgentFactoryOptions, KaiAgentRuntime } from "./factories/KaiAgentFactory.js";

export { ProcessCreativeBrief } from "./application/use-cases/ProcessCreativeBrief.js";
export { GetGenerationStatus } from "./application/use-cases/GetGenerationStatus.js";
// Additive: re-drives a FAILED job's original brief (spec folder structure lists this use case).
export { RetryFailedGeneration } from "./application/use-cases/RetryFailedGeneration.js";

export { KaiAgentService } from "./application/services/KaiAgentService.js";
// Additive: the 4 supporting services `KaiAgentService` composes (spec "application/services/").
export { FormatDecisionService } from "./application/services/FormatDecisionService.js";
export type { FormatDecision } from "./application/services/FormatDecisionService.js";
export { PromptBuildingService } from "./application/services/PromptBuildingService.js";
export type { BuiltPrompts } from "./application/services/PromptBuildingService.js";
export { CopyGenerationService } from "./application/services/CopyGenerationService.js";
export { CreativeOrchestratorService } from "./application/services/CreativeOrchestratorService.js";
export type { FetchSourcePhoto } from "./application/services/CreativeOrchestratorService.js";

export type { CreativePackage, CopyVariant, GenerationJob } from "./domain/entities/index.js";
// Additive: the KaiAgent identity entity itself, and CopyVariant's pinned Meta limits.
export { KaiAgent, PRIMARY_TEXT_MAX_LENGTH, HEADLINE_MAX_LENGTH } from "./domain/entities/index.js";

export { CreativeFormat } from "./domain/value-objects/CreativeFormat.js";
export { GenerationStatus } from "./domain/value-objects/GenerationStatus.js";
export type { PackageId } from "./domain/value-objects/PackageId.js";
// Additive: the remaining value objects real callers/tests need to construct or read.
export type { JobId } from "./domain/value-objects/JobId.js";
export { VideoSpec } from "./domain/value-objects/VideoSpec.js";
export { ImageSpec } from "./domain/value-objects/ImageSpec.js";
export { ConfidenceScore } from "./domain/value-objects/ConfidenceScore.js";

export type {
  CreativeGenerationStarted,
  CreativePackageReady,
  CreativeGenerationFailed,
} from "./domain/events/index.js";
// Additive: the 4th named event + the IPublisher wrapper that emits all 4.
export type { CopyVariantGenerated } from "./domain/events/index.js";
export { CreativeAgentEvents } from "./domain/events/index.js";

export {
  CreativeAgentError,
  BriefValidationError,
  GenerationError,
  NoSourcePhotosError,
} from "./domain/errors/index.js";

export type {
  CreativeAgentConfig,
  CreativeAgentConfigInput,
} from "./config/CreativeAgentConfig.js";
// Additive: the Zod-backed parser + defaults real callers need to actually produce a validated config.
export {
  parseCreativeAgentConfig,
  CreativeAgentConfigSchema,
  DEFAULT_CREATIVE_AGENT_CONFIG,
} from "./config/CreativeAgentConfig.js";

export { AutomotivePromptBuilder } from "./intelligence/AutomotivePromptBuilder.js";
export { CopyBuilder } from "./intelligence/CopyBuilder.js";
// Additive: the 2 remaining intelligence-layer strategies (spec "intelligence/").
export { FormatDecider } from "./intelligence/FormatDecider.js";
export { AngleToPromptMapper } from "./intelligence/AngleToPromptMapper.js";
// AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 — Kai's PROPERTY-vertical prompt builder (spec Part 5).
export { PropertyPromptBuilder } from "./intelligence/PropertyPromptBuilder.js";
export { PropertyAngleToPromptMapper } from "./intelligence/PropertyAngleToPromptMapper.js";
export { PropertyAdAngle, ALL_PROPERTY_AD_ANGLES } from "./domain/value-objects/PropertyAdAngle.js";
// AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — the PROPERTY-vertical `FormatDecider`/`CopyBuilder`
// siblings, unblocking a real PROPERTY Kai-prompt preview (Simulasi Step 3).
export { PropertyFormatDecider } from "./intelligence/PropertyFormatDecider.js";
export type { IPropertyFormatDecider } from "./contracts/IPropertyFormatDecider.js";
export { PropertyCopyBuilder } from "./intelligence/PropertyCopyBuilder.js";
export type { PropertyCopyVariant } from "./intelligence/PropertyCopyBuilder.js";

// Additive: the contracts (ports) every intelligence/service class above implements.
export type { ICreativeAgent } from "./contracts/ICreativeAgent.js";
export type { IFormatDecider } from "./contracts/IFormatDecider.js";
export type { IPromptBuilder } from "./contracts/IPromptBuilder.js";
export type {
  IPropertyPromptBuilder,
  PropertyCreativeBrief,
} from "./contracts/IPropertyPromptBuilder.js";
export type {
  ICreativeOrchestrator,
  OrchestrateGenerationInput,
  OrchestrateGenerationOutput,
} from "./contracts/ICreativeOrchestrator.js";
// Additive: the 6 narrow ports `KaiAgentService`/`CreativeOrchestratorService` depend on instead
// of the concrete `@aos/asset-library`/`@aos/creative-connector` classes directly (Dependency
// Inversion) — this is what lets tests supply lightweight fakes without constructing real
// Supabase/Kie-AI-backed dependency graphs.
export type { IPhotoSource } from "./contracts/IPhotoSource.js";
export type {
  ICreativeAssetSaver,
  CreativeAssetSaveInput,
} from "./contracts/ICreativeAssetSaver.js";
export type {
  ISourceImageUploader,
  SupportedImageMimeType,
} from "./contracts/ISourceImageUploader.js";
export type { IVideoGenerator } from "./contracts/IVideoGenerator.js";
export type { IImageSetGenerator } from "./contracts/IImageSetGenerator.js";
export type { IMediaDownloader } from "./contracts/IMediaDownloader.js";

// Additive: the builders (Builder Pattern, spec "builders/").
export { CreativePackageBuilder } from "./builders/CreativePackageBuilder.js";
export { GenerationJobBuilder } from "./builders/GenerationJobBuilder.js";
export { CopyVariantBuilder } from "./builders/CopyVariantBuilder.js";

// Additive: the in-memory job registry `GetGenerationStatus`/`RetryFailedGeneration` read from.
export { GenerationJobRegistry } from "./registry/GenerationJobRegistry.js";
