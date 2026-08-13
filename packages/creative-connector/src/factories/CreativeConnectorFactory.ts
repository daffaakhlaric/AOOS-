import type { IPublisher } from "@aos/event-bus";

import { FileUploadService } from "../application/services/FileUploadService.js";
import { ImageGenerationService } from "../application/services/ImageGenerationService.js";
import { TaskPollingService } from "../application/services/TaskPollingService.js";
import { VideoGenerationService } from "../application/services/VideoGenerationService.js";
import { DownloadMedia } from "../application/use-cases/DownloadMedia.js";
import { GenerateImage } from "../application/use-cases/GenerateImage.js";
import { GenerateImageSet } from "../application/use-cases/GenerateImageSet.js";
import { GenerateLongVideo } from "../application/use-cases/GenerateLongVideo.js";
import { GenerateVideoFromImage } from "../application/use-cases/GenerateVideoFromImage.js";
import { GenerateVideoFromText } from "../application/use-cases/GenerateVideoFromText.js";
import { GetTaskStatus } from "../application/use-cases/GetTaskStatus.js";
import { UploadSourceImage } from "../application/use-cases/UploadSourceImage.js";
import type { CreativeConnectorConfig } from "../config/CreativeConnectorConfig.js";
import { CreativeConnectorEvents } from "../domain/events/CreativeConnectorEvents.js";
import { KieAiFileUploadClient } from "../infrastructure/kie-api/KieAiFileUploadClient.js";
import { KieAiGenerationClient } from "../infrastructure/kie-api/KieAiGenerationClient.js";
import { TaskPoller } from "../infrastructure/polling/TaskPoller.js";
import { TokenBucketRateLimiter } from "../infrastructure/rate-limiter/TokenBucketRateLimiter.js";

export interface CreativeConnectorFactoryOptions {
  readonly config: CreativeConnectorConfig;
  readonly publisher: IPublisher;
  /** Injectable native `fetch` — overridable for tests (MSW normally suffices). */
  readonly fetchImpl?: typeof fetch;
  /** Injected sleep, shared by `KieAiGenerationClient`'s 429 backoff and `TaskPoller`'s poll backoff — defaults to a real `setTimeout`-based wait. */
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => Date;
}

export interface CreativeConnectorBundle {
  readonly uploadSourceImage: UploadSourceImage;
  readonly generateVideoFromImage: GenerateVideoFromImage;
  readonly generateVideoFromText: GenerateVideoFromText;
  readonly generateLongVideo: GenerateLongVideo;
  readonly generateImage: GenerateImage;
  readonly generateImageSet: GenerateImageSet;
  readonly getTaskStatus: GetTaskStatus;
  readonly downloadMedia: DownloadMedia;
  readonly fileUploadService: FileUploadService;
  readonly videoGenerationService: VideoGenerationService;
  readonly imageGenerationService: ImageGenerationService;
}

/**
 * Composition root — the single place this package's real integrations (`@aos/event-bus`
 * `IPublisher`, native `fetch`, the two Kie AI hosts) get wired together, mirroring
 * `@aos/mobix-web-scraper`'s `MobixScraperFactory` / `@aos/meta-ads-connector`'s equivalent
 * factory. Returns every use case and service the Public API exposes so a caller (W3H's "Kai")
 * can depend on exactly the entry points it needs without reaching into this package's internals.
 */
export class CreativeConnectorFactory {
  static create(options: CreativeConnectorFactoryOptions): CreativeConnectorBundle {
    const now = options.now ?? ((): Date => new Date());
    const events = new CreativeConnectorEvents(options.publisher);

    const rateLimiter = new TokenBucketRateLimiter({
      capacity: options.config.rateLimitPerTenSeconds,
    });

    const uploadClient = new KieAiFileUploadClient({
      apiKey: options.config.apiKey,
      baseUrl: options.config.uploadBaseUrl,
      fetchImpl: options.fetchImpl,
      now,
    });

    const generationClient = new KieAiGenerationClient({
      apiKey: options.config.apiKey,
      baseUrl: options.config.generationBaseUrl,
      fetchImpl: options.fetchImpl,
      rateLimiter,
      sleep: options.sleep,
    });

    const poller = new TaskPoller(generationClient, {
      sleep: options.sleep,
      now,
      defaultTimeoutMs: options.config.maxPollDurationMs,
    });
    const pollingService = new TaskPollingService(poller);

    const fileUploadService = new FileUploadService(uploadClient, events, now);
    const videoGenerationService = new VideoGenerationService(
      generationClient,
      events,
      now,
      options.config.callbackUrl,
    );
    const imageGenerationService = new ImageGenerationService(
      generationClient,
      events,
      now,
      options.config.callbackUrl,
    );

    const generateImage = new GenerateImage(imageGenerationService, pollingService, events, now);

    return {
      uploadSourceImage: new UploadSourceImage(fileUploadService),
      generateVideoFromImage: new GenerateVideoFromImage(
        videoGenerationService,
        pollingService,
        events,
        now,
      ),
      generateVideoFromText: new GenerateVideoFromText(
        videoGenerationService,
        pollingService,
        events,
        now,
      ),
      generateLongVideo: new GenerateLongVideo(videoGenerationService, pollingService, events, now),
      generateImage,
      generateImageSet: new GenerateImageSet(generateImage),
      getTaskStatus: new GetTaskStatus(generationClient),
      downloadMedia: new DownloadMedia(options.fetchImpl ?? fetch),
      fileUploadService,
      videoGenerationService,
      imageGenerationService,
    };
  }
}
