import { ok, type Result } from "@aos/common";
import type { IPublisher } from "@aos/event-bus";

import { GoldenDatasetService } from "../application/services/GoldenDatasetService.js";
import { JudgementService } from "../application/services/JudgementService.js";
import { ObservablePublisher } from "../application/services/ObservablePublisher.js";
import { CompareVersions } from "../application/use-cases/CompareVersions.js";
import { GetGoldenDataset } from "../application/use-cases/GetGoldenDataset.js";
import { JudgeAllScenarios } from "../application/use-cases/JudgeAllScenarios.js";
import { JudgeConversation } from "../application/use-cases/JudgeConversation.js";
import { SaveGoldenConversation } from "../application/use-cases/SaveGoldenConversation.js";
import {
  DEFAULT_AI_JUDGE_CONFIG,
  parseAiJudgeConfig,
  type AiJudgeConfig,
  type AiJudgeConfigInput,
} from "../config/AiJudgeConfig.js";
import type { JudgeError } from "../domain/errors/JudgeError.js";
import { AiJudgeEvents } from "../domain/events/AiJudgeEvents.js";
import { GoldenDatasetRegistry } from "../registry/GoldenDatasetRegistry.js";
import { ClosingAttemptScorer } from "../scorers/ClosingAttemptScorer.js";
import { HandoffQualityScorer } from "../scorers/HandoffQualityScorer.js";
import { NaturalLanguageScorer } from "../scorers/NaturalLanguageScorer.js";
import { ObjectionHandlingScorer } from "../scorers/ObjectionHandlingScorer.js";
import { QualificationScorer } from "../scorers/QualificationScorer.js";
import { ResponseLengthScorer } from "../scorers/ResponseLengthScorer.js";

export interface AiJudge {
  readonly judgeConversation: JudgeConversation;
  readonly judgeAllScenarios: JudgeAllScenarios;
  readonly saveGoldenConversation: SaveGoldenConversation;
  readonly compareVersions: CompareVersions;
  readonly getGoldenDataset: GetGoldenDataset;
  readonly judgementService: JudgementService;
  readonly goldenDatasetRegistry: GoldenDatasetRegistry;
  readonly config: AiJudgeConfig;
}

export interface AiJudgeFactoryOptions {
  /** Real `@aos/event-bus` `IPublisher` for this package's own 3 named events — defaults to a fresh `ObservablePublisher` (never a real broker) when omitted, the same composition-boundary discipline every prior AAOS package's factory establishes. */
  readonly publisher?: IPublisher;
  /** Raw config input (spec "Grading" weights + thresholds) — defaults to `DEFAULT_AI_JUDGE_CONFIG` when omitted. */
  readonly config?: AiJudgeConfigInput;
  /** Injectable clock — defaults to `() => new Date()`. Overridable for deterministic tests. */
  readonly clock?: () => Date;
}

/**
 * The composition root (Factory Pattern) — wires the 6 dimension scorers (Strategy Pattern),
 * `JudgementService`, `GoldenDatasetRegistry`/`GoldenDatasetService` into the 5 public use cases
 * (spec "Public API"). Each `create()` call is fully isolated — its own registry, its own
 * publisher — so tests never leak state across each other.
 */
export class AiJudgeFactory {
  static create(options: AiJudgeFactoryOptions = {}): Result<AiJudge, JudgeError> {
    const configResult = parseAiJudgeConfig(options.config ?? DEFAULT_AI_JUDGE_CONFIG);
    if (!configResult.ok) {
      return configResult;
    }
    const config = configResult.value;
    const clock = options.clock ?? (() => new Date());

    const publisher = options.publisher ?? new ObservablePublisher();
    const events = new AiJudgeEvents(publisher);

    const scorers = {
      naturalLanguage: new NaturalLanguageScorer(),
      qualification: new QualificationScorer(),
      objectionHandling: new ObjectionHandlingScorer(),
      closingAttempt: new ClosingAttemptScorer(),
      handoffQuality: new HandoffQualityScorer(),
      responseLength: new ResponseLengthScorer(),
    };

    const judgementService = new JudgementService(scorers, config, clock);
    const judgeConversation = new JudgeConversation(judgementService, events, config);
    const judgeAllScenarios = new JudgeAllScenarios(judgeConversation);

    const goldenDatasetRegistry = new GoldenDatasetRegistry();
    const goldenDatasetService = new GoldenDatasetService(goldenDatasetRegistry, clock);
    const saveGoldenConversation = new SaveGoldenConversation(goldenDatasetService, events, config);
    const getGoldenDataset = new GetGoldenDataset(goldenDatasetService);
    const compareVersions = new CompareVersions(events, config, clock);

    return ok({
      judgeConversation,
      judgeAllScenarios,
      saveGoldenConversation,
      compareVersions,
      getGoldenDataset,
      judgementService,
      goldenDatasetRegistry,
      config,
    });
  }
}
