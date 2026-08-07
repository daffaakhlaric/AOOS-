import type { KnowledgeAnalysisEngine } from "../analysis/knowledge-analysis-engine.js";
import type { KnowledgeFreshnessEngine } from "../analysis/knowledge-freshness-engine.js";
import type {
  KnowledgeRelationshipAnalyzer,
  DiscoveredRelationship,
} from "../analysis/knowledge-relationship-analyzer.js";
import type {
  KnowledgeRiskAnalyzer,
  KnowledgeRiskAssessment,
} from "../analysis/knowledge-risk-analyzer.js";
import type { KnowledgeIntelligenceReportBuilder } from "../builders/knowledge-intelligence-report-builder.js";
import type { IClock } from "../contracts/i-clock.js";
import type { IKnowledgeIntelligenceEventPublisher } from "../contracts/i-knowledge-intelligence-event-publisher.js";
import type { KnowledgeGapReport } from "../entities/knowledge-gap-report.js";
import type { KnowledgeHealthReport } from "../entities/knowledge-health-report.js";
import type { KnowledgeIntelligenceReport } from "../entities/knowledge-intelligence-report.js";
import type { KnowledgeGapReportFactory } from "../factories/knowledge-gap-report-factory.js";
import type { KnowledgeHealthReportFactory } from "../factories/knowledge-health-report-factory.js";
import type { KnowledgeIntelligenceSnapshotFactory } from "../factories/knowledge-intelligence-snapshot-factory.js";
import type { KnowledgeIntelligenceStatisticsFactory } from "../factories/knowledge-intelligence-statistics-factory.js";
import type { KnowledgeCoverageAnalyzer } from "../gap/knowledge-coverage-analyzer.js";
import type { KnowledgeGapAnalyzer } from "../gap/knowledge-gap-analyzer.js";
import type { KnowledgeHealthEngine } from "../intelligence/knowledge-health-engine.js";
import type { KnowledgeInsightEngine } from "../intelligence/knowledge-insight-engine.js";
import type { KnowledgeReadinessEngine } from "../intelligence/knowledge-readiness-engine.js";
import type { KnowledgeInsightBuilder } from "../recommendation/knowledge-insight-builder.js";
import type { KnowledgePriorityEngine } from "../recommendation/knowledge-priority-engine.js";
import type { KnowledgeRecommendationEngine } from "../recommendation/knowledge-recommendation-engine.js";
import type { KnowledgeIntelligenceRegistry } from "../registry/knowledge-intelligence-registry.js";
import type { KnowledgeQualityScoringEngine } from "../scoring/knowledge-quality-scoring-engine.js";
import type { KnowledgeDuplicateDetector } from "../similarity/knowledge-duplicate-detector.js";
import type { KnowledgeSimilarityEngine } from "../similarity/knowledge-similarity-engine.js";
import type {
  AdjacencyList,
  KnowledgeItemSnapshot,
  TaxonomyCoverageEntry,
} from "../types/knowledge-item.js";
import type { KnowledgeFinding } from "../value-objects/knowledge-finding.js";
import type { KnowledgeInsight } from "../value-objects/knowledge-insight.js";
import type { KnowledgeIntelligenceConfiguration } from "../value-objects/knowledge-intelligence-configuration.js";
import type { KnowledgeIntelligenceStatistics } from "../value-objects/knowledge-intelligence-statistics.js";
import type { KnowledgePriorityScore } from "../value-objects/knowledge-priority-score.js";
import type { KnowledgeRecommendation } from "../value-objects/knowledge-recommendation.js";
import type { KnowledgeScore } from "../value-objects/knowledge-score.js";
import type { KnowledgeSimilarityMatrix } from "../value-objects/knowledge-similarity-matrix.js";

/** Services shared by every pipeline stage, injected once at pipeline construction. */
export interface PipelineServices {
  readonly clock: IClock;
  readonly config: KnowledgeIntelligenceConfiguration;
  readonly registry: KnowledgeIntelligenceRegistry;
  readonly analysisEngine: KnowledgeAnalysisEngine;
  readonly relationshipAnalyzer: KnowledgeRelationshipAnalyzer;
  readonly similarityEngine: KnowledgeSimilarityEngine;
  readonly duplicateDetector: KnowledgeDuplicateDetector;
  readonly coverageAnalyzer: KnowledgeCoverageAnalyzer;
  readonly gapAnalyzer: KnowledgeGapAnalyzer;
  readonly qualityEngine: KnowledgeQualityScoringEngine;
  readonly freshnessEngine: KnowledgeFreshnessEngine;
  readonly riskAnalyzer: KnowledgeRiskAnalyzer;
  readonly healthEngine: KnowledgeHealthEngine;
  readonly readinessEngine: KnowledgeReadinessEngine;
  readonly priorityEngine: KnowledgePriorityEngine;
  readonly recommendationEngine: KnowledgeRecommendationEngine;
  readonly insightEngine: KnowledgeInsightEngine;
  readonly insightBuilder: KnowledgeInsightBuilder;
  readonly reportBuilder: KnowledgeIntelligenceReportBuilder;
  readonly gapReportFactory: KnowledgeGapReportFactory;
  readonly healthReportFactory: KnowledgeHealthReportFactory;
  readonly snapshotFactory: KnowledgeIntelligenceSnapshotFactory;
  readonly statisticsFactory: KnowledgeIntelligenceStatisticsFactory;
  readonly eventPublisher: IKnowledgeIntelligenceEventPublisher;
}

/** Everything one `KnowledgeIntelligencePipeline.run()` call needs. */
export interface PipelineRunInput {
  readonly items: readonly KnowledgeItemSnapshot[];
  readonly taxonomy?: readonly TaxonomyCoverageEntry[];
  readonly adjacency?: AdjacencyList;
}

/** The mutable working state threaded through the 11 pipeline stages. */
export interface PipelineContext extends PipelineRunInput, PipelineServices {
  readonly runId: string;
  findings?: readonly KnowledgeFinding[];
  relationships?: readonly DiscoveredRelationship[];
  similarityMatrix?: KnowledgeSimilarityMatrix;
  duplicates?: KnowledgeSimilarityMatrix["entries"];
  nearDuplicates?: KnowledgeSimilarityMatrix["entries"];
  coverageScore?: KnowledgeScore;
  gapReport?: KnowledgeGapReport;
  qualityScores?: ReadonlyMap<string, KnowledgeScore>;
  freshnessScores?: ReadonlyMap<string, KnowledgeScore>;
  riskAssessments?: ReadonlyMap<string, KnowledgeRiskAssessment>;
  priorityScores?: ReadonlyMap<string, KnowledgePriorityScore>;
  healthReport?: KnowledgeHealthReport;
  recommendations?: readonly KnowledgeRecommendation[];
  insights?: readonly KnowledgeInsight[];
  report?: KnowledgeIntelligenceReport;
  statistics?: KnowledgeIntelligenceStatistics;
}

/** One stage of the `KnowledgeIntelligencePipeline`. Mutates `context` in place and returns it. */
export interface PipelineStage {
  readonly name: string;
  execute(context: PipelineContext): PipelineContext;
}
