import { KnowledgeAnalysisEngine } from "../../src/analysis/knowledge-analysis-engine.js";
import { KnowledgeFreshnessEngine } from "../../src/analysis/knowledge-freshness-engine.js";
import { KnowledgeRelationshipAnalyzer } from "../../src/analysis/knowledge-relationship-analyzer.js";
import { KnowledgeRiskAnalyzer } from "../../src/analysis/knowledge-risk-analyzer.js";
import { KnowledgeIntelligenceReportBuilder } from "../../src/builders/knowledge-intelligence-report-builder.js";
import { KnowledgeClassificationEngine } from "../../src/classification/knowledge-classification-engine.js";
import type { IClock } from "../../src/contracts/i-clock.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeGapReportFactory } from "../../src/factories/knowledge-gap-report-factory.js";
import { KnowledgeHealthReportFactory } from "../../src/factories/knowledge-health-report-factory.js";
import { KnowledgeIntelligenceSnapshotFactory } from "../../src/factories/knowledge-intelligence-snapshot-factory.js";
import { KnowledgeIntelligenceStatisticsFactory } from "../../src/factories/knowledge-intelligence-statistics-factory.js";
import { KnowledgeCoverageAnalyzer } from "../../src/gap/knowledge-coverage-analyzer.js";
import { KnowledgeGapAnalyzer } from "../../src/gap/knowledge-gap-analyzer.js";
import { KnowledgeHealthEngine } from "../../src/intelligence/knowledge-health-engine.js";
import { KnowledgeInsightEngine } from "../../src/intelligence/knowledge-insight-engine.js";
import { KnowledgeReadinessEngine } from "../../src/intelligence/knowledge-readiness-engine.js";
import type { PipelineServices } from "../../src/pipeline/pipeline-stage.js";
import { KnowledgeInsightBuilder } from "../../src/recommendation/knowledge-insight-builder.js";
import { KnowledgePriorityEngine } from "../../src/recommendation/knowledge-priority-engine.js";
import { KnowledgeRecommendationBuilder } from "../../src/recommendation/knowledge-recommendation-builder.js";
import { KnowledgeRecommendationEngine } from "../../src/recommendation/knowledge-recommendation-engine.js";
import { KnowledgeIntelligenceRegistry } from "../../src/registry/knowledge-intelligence-registry.js";
import { KnowledgeQualityScoringEngine } from "../../src/scoring/knowledge-quality-scoring-engine.js";
import { KnowledgeDuplicateDetector } from "../../src/similarity/knowledge-duplicate-detector.js";
import { KnowledgeSimilarityEngine } from "../../src/similarity/knowledge-similarity-engine.js";
import type { KnowledgeIntelligenceConfiguration } from "../../src/value-objects/knowledge-intelligence-configuration.js";

export function makeServices(
  clock: IClock,
  config: KnowledgeIntelligenceConfiguration,
): PipelineServices {
  const similarityEngine = new KnowledgeSimilarityEngine(config);
  const freshnessEngine = new KnowledgeFreshnessEngine(clock, config);
  const riskAnalyzer = new KnowledgeRiskAnalyzer(freshnessEngine, config);
  const qualityEngine = new KnowledgeQualityScoringEngine();
  const healthEngine = new KnowledgeHealthEngine(
    qualityEngine,
    freshnessEngine,
    riskAnalyzer,
    config,
  );
  const readinessEngine = new KnowledgeReadinessEngine(qualityEngine, freshnessEngine, config);
  const priorityEngine = new KnowledgePriorityEngine(riskAnalyzer, freshnessEngine);
  const recommendationBuilder = new KnowledgeRecommendationBuilder(clock);
  const recommendationEngine = new KnowledgeRecommendationEngine(
    similarityEngine,
    freshnessEngine,
    qualityEngine,
    recommendationBuilder,
  );
  const insightBuilder = new KnowledgeInsightBuilder(clock);

  return {
    clock,
    config,
    registry: new KnowledgeIntelligenceRegistry(),
    analysisEngine: new KnowledgeAnalysisEngine(),
    relationshipAnalyzer: new KnowledgeRelationshipAnalyzer(similarityEngine),
    similarityEngine,
    duplicateDetector: new KnowledgeDuplicateDetector(similarityEngine),
    coverageAnalyzer: new KnowledgeCoverageAnalyzer(),
    gapAnalyzer: new KnowledgeGapAnalyzer(),
    qualityEngine,
    freshnessEngine,
    riskAnalyzer,
    healthEngine,
    readinessEngine,
    priorityEngine,
    recommendationEngine,
    insightEngine: new KnowledgeInsightEngine(insightBuilder),
    insightBuilder,
    reportBuilder: new KnowledgeIntelligenceReportBuilder(clock),
    gapReportFactory: new KnowledgeGapReportFactory(clock),
    healthReportFactory: new KnowledgeHealthReportFactory(clock),
    snapshotFactory: new KnowledgeIntelligenceSnapshotFactory(clock),
    statisticsFactory: new KnowledgeIntelligenceStatisticsFactory(),
    eventPublisher: new InMemoryEventPublisher(clock),
  };
}

export function makeClassificationEngine(): KnowledgeClassificationEngine {
  return new KnowledgeClassificationEngine();
}
