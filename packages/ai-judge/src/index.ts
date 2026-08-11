export { AiJudgeFactory } from "./factories/AiJudgeFactory.js";
export type { AiJudge, AiJudgeFactoryOptions } from "./factories/AiJudgeFactory.js";

export { JudgeConversation } from "./application/use-cases/JudgeConversation.js";
export { JudgeAllScenarios } from "./application/use-cases/JudgeAllScenarios.js";
export { SaveGoldenConversation } from "./application/use-cases/SaveGoldenConversation.js";
export { CompareVersions } from "./application/use-cases/CompareVersions.js";
export { GetGoldenDataset } from "./application/use-cases/GetGoldenDataset.js";
export { JudgementService } from "./application/services/JudgementService.js";

export type {
  JudgementResult,
  DimensionScore,
  GoldenConversation,
  ComparisonReport,
  AllScenariosReport,
} from "./domain/entities/index.js";

export { Grade } from "./domain/value-objects/Grade.js";
export { Verdict } from "./domain/value-objects/Verdict.js";
export type { OverallScore } from "./domain/value-objects/OverallScore.js";
export type { Feedback } from "./domain/value-objects/Feedback.js";

export { JudgeError, InvalidSimulationError } from "./domain/errors/index.js";

export type { AiJudgeConfig } from "./config/AiJudgeConfig.js";
