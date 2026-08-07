import { KnowledgeIntelligenceException } from "./knowledge-intelligence-exception.js";

export class InvalidWeightConfigurationException extends KnowledgeIntelligenceException {
  constructor(reason: string) {
    super(`Invalid knowledge intelligence weight configuration: ${reason}`, {
      code: "INVALID_WEIGHT_CONFIGURATION",
      context: { reason },
    });
  }
}
