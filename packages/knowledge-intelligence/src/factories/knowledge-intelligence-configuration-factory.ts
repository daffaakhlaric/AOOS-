import {
  KnowledgeIntelligenceConfiguration,
  type KnowledgeIntelligenceConfigurationProps,
} from "../value-objects/knowledge-intelligence-configuration.js";

/** Factory-pattern class constructing `KnowledgeIntelligenceConfiguration` with defaults. */
export class KnowledgeIntelligenceConfigurationFactory {
  create(
    overrides: Partial<KnowledgeIntelligenceConfigurationProps> = {},
  ): KnowledgeIntelligenceConfiguration {
    return KnowledgeIntelligenceConfiguration.default().with(overrides);
  }
}
