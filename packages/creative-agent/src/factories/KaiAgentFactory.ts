import type { GetAssetsByUnit, SaveAiCreative } from "@aos/asset-library";
import { ok, type Result } from "@aos/common";
import type {
  DownloadMedia,
  GenerateImageSet,
  GenerateLongVideo,
  UploadSourceImage,
} from "@aos/creative-connector";
import type { IPublisher } from "@aos/event-bus";

import { CopyGenerationService } from "../application/services/CopyGenerationService.js";
import {
  CreativeOrchestratorService,
  type FetchSourcePhoto,
} from "../application/services/CreativeOrchestratorService.js";
import { FormatDecisionService } from "../application/services/FormatDecisionService.js";
import { KaiAgentService } from "../application/services/KaiAgentService.js";
import { PromptBuildingService } from "../application/services/PromptBuildingService.js";
import { GetGenerationStatus } from "../application/use-cases/GetGenerationStatus.js";
import { ProcessCreativeBrief } from "../application/use-cases/ProcessCreativeBrief.js";
import { RetryFailedGeneration } from "../application/use-cases/RetryFailedGeneration.js";
import {
  parseCreativeAgentConfig,
  type CreativeAgentConfig,
  type CreativeAgentConfigInput,
} from "../config/CreativeAgentConfig.js";
import { KaiAgent } from "../domain/entities/KaiAgent.js";
import type { CreativeAgentError } from "../domain/errors/CreativeAgentError.js";
import { CreativeAgentEvents } from "../domain/events/CreativeAgentEvents.js";
import { AutomotivePromptBuilder } from "../intelligence/AutomotivePromptBuilder.js";
import { CopyBuilder } from "../intelligence/CopyBuilder.js";
import { FormatDecider } from "../intelligence/FormatDecider.js";
import { GenerationJobRegistry } from "../registry/GenerationJobRegistry.js";

export interface KaiAgentFactoryOptions {
  readonly config: CreativeAgentConfigInput;
  /** Real `@aos/event-bus` `IPublisher` — always caller-supplied, the same composition-boundary discipline every prior AAOS package's factory establishes. */
  readonly publisher: IPublisher;
  /** Real `@aos/asset-library` `GetAssetsByUnit` — queried for real, never mocked, by `KaiAgentService`. */
  readonly getAssetsByUnit: GetAssetsByUnit;
  /** Real `@aos/asset-library` `SaveAiCreative` — called for real, never mocked, after generation. */
  readonly saveAiCreative: SaveAiCreative;
  /** Real `@aos/creative-connector` use cases — called for real by `CreativeOrchestratorService`. */
  readonly uploadSourceImage: UploadSourceImage;
  readonly generateLongVideo: GenerateLongVideo;
  readonly generateImageSet: GenerateImageSet;
  readonly downloadMedia: DownloadMedia;
  /** Injectable fetch for pulling a source photo's bytes back from its `@aos/asset-library` public URL — overridable for tests; defaults to the real global `fetch`. */
  readonly fetchSourcePhoto?: FetchSourcePhoto;
  /** Injectable clock — defaults to the real wall clock only here. */
  readonly now?: () => Date;
}

export interface KaiAgentRuntime {
  readonly agent: KaiAgent;
  readonly processCreativeBrief: ProcessCreativeBrief;
  readonly getGenerationStatus: GetGenerationStatus;
  readonly retryFailedGeneration: RetryFailedGeneration;
  readonly kaiAgentService: KaiAgentService;
  readonly jobRegistry: GenerationJobRegistry;
  readonly config: CreativeAgentConfig;
  /**
   * Additive (K1/K2, `docs/PROMPT-AAOS-PROPERTY-CAMPAIGN-AND-CREATIVE.md`): the SAME
   * `CreativeOrchestratorService` instance `kaiAgentService` composes above — real Kie AI
   * upload/generate calls. `KaiAgentService.processCreativeBrief` is hard-typed to the AUTOMOTIVE
   * `CreativeBrief` (unit-keyed source-photo lookup, `AutomotivePromptBuilder`/`CopyBuilder`), so
   * there is no way to drive it with a PROPERTY listing's already-resolved `sourcePhotoUrls`.
   * Exposing the orchestrator directly lets a PROPERTY-vertical caller (`aaos-api`'s
   * `CreativePackagesService`) reach the real Kie AI generation step without duplicating this
   * factory's `CreativeConnectorFactory` wiring into a second orchestrator instance.
   */
  readonly orchestratorService: CreativeOrchestratorService;
}

/**
 * The composition root (Factory Pattern, spec "factories/KaiAgentFactory.ts") — wires every real
 * `@aos/*` integration (`@aos/asset-library`'s `GetAssetsByUnit`/`SaveAiCreative`,
 * `@aos/creative-connector`'s generation use cases, `@aos/event-bus`'s `IPublisher`) into the use
 * cases this package's public API exposes. Mirrors `@aos/sales-agent`'s `ClaraAgentFactory` /
 * `@aos/asset-library`'s `AssetLibraryFactory` convention exactly.
 */
export class KaiAgentFactory {
  static create(options: KaiAgentFactoryOptions): Result<KaiAgentRuntime, CreativeAgentError> {
    const configResult = parseCreativeAgentConfig(options.config);
    if (!configResult.ok) {
      return configResult;
    }
    const config = configResult.value;
    const now = options.now ?? ((): Date => new Date());

    const agent = KaiAgent.create(config.tenantId);
    const events = new CreativeAgentEvents(options.publisher);
    const jobRegistry = new GenerationJobRegistry();

    const formatDecisionService = new FormatDecisionService(new FormatDecider());
    const promptBuildingService = new PromptBuildingService(new AutomotivePromptBuilder());
    const copyGenerationService = new CopyGenerationService(new CopyBuilder(), events, now);
    const orchestratorService = new CreativeOrchestratorService(
      options.uploadSourceImage,
      options.generateLongVideo,
      options.generateImageSet,
      options.downloadMedia,
      options.fetchSourcePhoto,
    );

    const kaiAgentService = new KaiAgentService(
      options.getAssetsByUnit,
      options.saveAiCreative,
      formatDecisionService,
      promptBuildingService,
      copyGenerationService,
      orchestratorService,
      events,
      jobRegistry,
      config,
      now,
    );

    return ok({
      agent,
      processCreativeBrief: new ProcessCreativeBrief(kaiAgentService),
      getGenerationStatus: new GetGenerationStatus(jobRegistry),
      retryFailedGeneration: new RetryFailedGeneration(jobRegistry, kaiAgentService),
      kaiAgentService,
      jobRegistry,
      config,
      orchestratorService,
    });
  }
}
