import {
  KnowledgeIntelligenceStatistics,
  type KnowledgeIntelligenceStatisticsProps,
} from "../value-objects/knowledge-intelligence-statistics.js";

/** Factory-pattern class constructing `KnowledgeIntelligenceStatistics` from raw counters. */
export class KnowledgeIntelligenceStatisticsFactory {
  create(props: KnowledgeIntelligenceStatisticsProps): KnowledgeIntelligenceStatistics {
    return new KnowledgeIntelligenceStatistics(props);
  }
}
