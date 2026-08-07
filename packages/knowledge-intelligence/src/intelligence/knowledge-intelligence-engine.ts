import { KnowledgeAnalysisEngine } from "../analysis/knowledge-analysis-engine.js";
import { KnowledgeFreshnessEngine } from "../analysis/knowledge-freshness-engine.js";
import { KnowledgeRelationshipAnalyzer } from "../analysis/knowledge-relationship-analyzer.js";
import { KnowledgeRiskAnalyzer } from "../analysis/knowledge-risk-analyzer.js";
import { KnowledgeIntelligenceReportBuilder } from "../builders/knowledge-intelligence-report-builder.js";
import { KnowledgeClassificationEngine } from "../classification/knowledge-classification-engine.js";
import { KnowledgeTagSuggestionEngine } from "../classification/knowledge-tag-suggestion-engine.js";
import type { IClock } from "../contracts/i-clock.js";
import type { IKnowledgeIntelligenceEventPublisher } from "../contracts/i-knowledge-intelligence-event-publisher.js";
import type { IKnowledgeIntelligenceModule } from "../contracts/i-knowledge-intelligence-module.js";
import type { KnowledgeIntelligenceReport } from "../entities/knowledge-intelligence-report.js";
import type { KnowledgeIntelligenceSnapshot } from "../entities/knowledge-intelligence-snapshot.js";
import { InMemoryEventPublisher } from "../events/in-memory-event-publisher.js";
import { KnowledgeIntelligenceEventType } from "../events/knowledge-intelligence-event-type.js";
import { KnowledgeGapReportFactory } from "../factories/knowledge-gap-report-factory.js";
import { KnowledgeHealthReportFactory } from "../factories/knowledge-health-report-factory.js";
import { KnowledgeIntelligenceSnapshotFactory } from "../factories/knowledge-intelligence-snapshot-factory.js";
import { KnowledgeIntelligenceStatisticsFactory } from "../factories/knowledge-intelligence-statistics-factory.js";
import { KnowledgeCoverageAnalyzer } from "../gap/knowledge-coverage-analyzer.js";
import { KnowledgeGapAnalyzer } from "../gap/knowledge-gap-analyzer.js";
import { KnowledgeIntelligencePipeline } from "../pipeline/knowledge-intelligence-pipeline.js";
import type { PipelineContext, PipelineServices } from "../pipeline/pipeline-stage.js";
import { KnowledgeInsightBuilder } from "../recommendation/knowledge-insight-builder.js";
import { KnowledgePriorityEngine } from "../recommendation/knowledge-priority-engine.js";
import { KnowledgeRecommendationBuilder } from "../recommendation/knowledge-recommendation-builder.js";
import { KnowledgeRecommendationEngine } from "../recommendation/knowledge-recommendation-engine.js";
import { KnowledgeIntelligenceRegistry } from "../registry/knowledge-intelligence-registry.js";
import { KnowledgeQualityScoringEngine } from "../scoring/knowledge-quality-scoring-engine.js";
import { KnowledgeDuplicateDetector } from "../similarity/knowledge-duplicate-detector.js";
import { KnowledgeSimilarityEngine } from "../similarity/knowledge-similarity-engine.js";
import type {
  AdjacencyList,
  KnowledgeItemSnapshot,
  TagCooccurrenceTable,
  TaxonomyCoverageEntry,
} from "../types/knowledge-item.js";
import { SystemClock } from "../utils/clock.js";
import { generateId } from "../utils/id-generator.js";
import type { KnowledgeClassification } from "../value-objects/knowledge-classification.js";
import { KnowledgeIntelligenceConfiguration } from "../value-objects/knowledge-intelligence-configuration.js";

import { KnowledgeHealthEngine } from "./knowledge-health-engine.js";
import { KnowledgeInsightEngine } from "./knowledge-insight-engine.js";
import { KnowledgeReadinessEngine } from "./knowledge-readiness-engine.js";

export interface KnowledgeIntelligenceEngineOptions {
  readonly clock?: IClock;
  readonly eventPublisher?: IKnowledgeIntelligenceEventPublisher;
  readonly config?: KnowledgeIntelligenceConfiguration;
}

export interface RunIntelligenceInput {
  readonly items: readonly KnowledgeItemSnapshot[];
  readonly taxonomy?: readonly TaxonomyCoverageEntry[];
  readonly adjacency?: AdjacencyList;
}

/**
 * Top-level facade composing every engine/analyzer/pipeline/registry in this package into one
 * public API. This is the package's single intended integration surface for hosts.
 */
export class KnowledgeIntelligenceEngine implements IKnowledgeIntelligenceModule {
  readonly id: string;

  private readonly clock: IClock;
  private readonly eventPublisher: IKnowledgeIntelligenceEventPublisher;
  private readonly config: KnowledgeIntelligenceConfiguration;

  private readonly registry = new KnowledgeIntelligenceRegistry();
  private readonly similarityEngine: KnowledgeSimilarityEngine;
  private readonly duplicateDetector: KnowledgeDuplicateDetector;
  private readonly qualityEngine = new KnowledgeQualityScoringEngine();
  private readonly freshnessEngine: KnowledgeFreshnessEngine;
  private readonly riskAnalyzer: KnowledgeRiskAnalyzer;
  private readonly healthEngine: KnowledgeHealthEngine;
  private readonly readinessEngine: KnowledgeReadinessEngine;
  private readonly priorityEngine: KnowledgePriorityEngine;
  private readonly classificationEngine = new KnowledgeClassificationEngine();
  private readonly tagSuggestionEngine: KnowledgeTagSuggestionEngine;
  private readonly analysisEngine = new KnowledgeAnalysisEngine();
  private readonly relationshipAnalyzer: KnowledgeRelationshipAnalyzer;
  private readonly coverageAnalyzer = new KnowledgeCoverageAnalyzer();
  private readonly gapAnalyzer = new KnowledgeGapAnalyzer();
  private readonly recommendationEngine: KnowledgeRecommendationEngine;
  private readonly insightEngine: KnowledgeInsightEngine;
  private readonly pipeline = new KnowledgeIntelligencePipeline();
  private readonly services: PipelineServices;

  constructor(options: KnowledgeIntelligenceEngineOptions = {}) {
    this.id = generateId("knowledge-intelligence-engine");
    this.clock = options.clock ?? new SystemClock();
    this.eventPublisher = options.eventPublisher ?? new InMemoryEventPublisher(this.clock);
    this.config = options.config ?? KnowledgeIntelligenceConfiguration.default();

    this.similarityEngine = new KnowledgeSimilarityEngine(this.config);
    this.duplicateDetector = new KnowledgeDuplicateDetector(this.similarityEngine);
    this.freshnessEngine = new KnowledgeFreshnessEngine(this.clock, this.config);
    this.riskAnalyzer = new KnowledgeRiskAnalyzer(this.freshnessEngine, this.config);
    this.healthEngine = new KnowledgeHealthEngine(
      this.qualityEngine,
      this.freshnessEngine,
      this.riskAnalyzer,
      this.config,
    );
    this.readinessEngine = new KnowledgeReadinessEngine(
      this.qualityEngine,
      this.freshnessEngine,
      this.config,
    );
    this.priorityEngine = new KnowledgePriorityEngine(this.riskAnalyzer, this.freshnessEngine);
    this.tagSuggestionEngine = new KnowledgeTagSuggestionEngine(this.similarityEngine);
    this.relationshipAnalyzer = new KnowledgeRelationshipAnalyzer(this.similarityEngine);

    const recommendationBuilder = new KnowledgeRecommendationBuilder(this.clock);
    this.recommendationEngine = new KnowledgeRecommendationEngine(
      this.similarityEngine,
      this.freshnessEngine,
      this.qualityEngine,
      recommendationBuilder,
    );

    const insightBuilder = new KnowledgeInsightBuilder(this.clock);
    this.insightEngine = new KnowledgeInsightEngine(insightBuilder);

    this.services = {
      clock: this.clock,
      config: this.config,
      registry: this.registry,
      analysisEngine: this.analysisEngine,
      relationshipAnalyzer: this.relationshipAnalyzer,
      similarityEngine: this.similarityEngine,
      duplicateDetector: this.duplicateDetector,
      coverageAnalyzer: this.coverageAnalyzer,
      gapAnalyzer: this.gapAnalyzer,
      qualityEngine: this.qualityEngine,
      freshnessEngine: this.freshnessEngine,
      riskAnalyzer: this.riskAnalyzer,
      healthEngine: this.healthEngine,
      readinessEngine: this.readinessEngine,
      priorityEngine: this.priorityEngine,
      recommendationEngine: this.recommendationEngine,
      insightEngine: this.insightEngine,
      insightBuilder,
      reportBuilder: new KnowledgeIntelligenceReportBuilder(this.clock),
      gapReportFactory: new KnowledgeGapReportFactory(this.clock),
      healthReportFactory: new KnowledgeHealthReportFactory(this.clock),
      snapshotFactory: new KnowledgeIntelligenceSnapshotFactory(this.clock),
      statisticsFactory: new KnowledgeIntelligenceStatisticsFactory(),
      eventPublisher: this.eventPublisher,
    };
  }

  start(): void {
    // No real resources to acquire — everything is in-memory and constructed eagerly.
  }

  stop(): void {
    // No real resources to release.
  }

  runIntelligence(input: RunIntelligenceInput): PipelineContext {
    this.eventPublisher.publish(KnowledgeIntelligenceEventType.IntelligenceStarted, {
      itemCount: input.items.length,
    });
    try {
      const context = this.pipeline.run(input, this.services);
      this.eventPublisher.publish(KnowledgeIntelligenceEventType.IntelligenceCompleted, {
        runId: context.runId,
        reportId: context.report?.id,
      });
      return context;
    } catch (error) {
      // The pipeline always wraps stage failures in `PipelineStageFailureException` (an Error
      // subclass — see `KnowledgeIntelligencePipeline.run`), so `error` is always an `Error` here
      // in practice; the `instanceof` check remains as defense-in-depth for any future caller
      // that constructs `PipelineServices` with a component that throws a non-Error value.
      /* v8 ignore next */
      const message = error instanceof Error ? error.message : String(error);
      this.eventPublisher.publish(KnowledgeIntelligenceEventType.IntelligenceFailed, {
        error: message,
      });
      throw error;
    }
  }

  classify(item: KnowledgeItemSnapshot): KnowledgeClassification {
    const classification = this.classificationEngine.classify(item);
    this.eventPublisher.publish(KnowledgeIntelligenceEventType.ClassificationCompleted, {
      itemId: item.id,
      category: classification.category,
    });
    return classification;
  }

  classifyAll(items: readonly KnowledgeItemSnapshot[]): readonly KnowledgeClassification[] {
    return items.map((item) => this.classify(item));
  }

  suggestTags(item: KnowledgeItemSnapshot, table: TagCooccurrenceTable): readonly string[] {
    return this.tagSuggestionEngine.suggestFromCooccurrence(item, table);
  }

  suggestTagsFromSimilarItems(
    item: KnowledgeItemSnapshot,
    corpus: readonly KnowledgeItemSnapshot[],
  ): readonly string[] {
    return this.tagSuggestionEngine.suggestFromSimilarItems(item, corpus);
  }

  getReport(id: string): KnowledgeIntelligenceReport {
    return this.registry.getReport(id);
  }

  get configuration(): KnowledgeIntelligenceConfiguration {
    return this.config;
  }

  get registrySnapshot(): KnowledgeIntelligenceRegistry {
    return this.registry;
  }

  takeSnapshot(input: RunIntelligenceInput): KnowledgeIntelligenceSnapshot {
    // A successful `runIntelligence` call always runs the full 11-stage pipeline, which always
    // populates these fields (see `GenerateRecommendationsStage`/`GenerateIntelligenceReportStage`
    // /`AnalyzeSimilarityStage`), so direct (non-optional) access is safe here.
    const context = this.runIntelligence(input);
    const snapshot = this.services.snapshotFactory.create({
      itemCount: input.items.length,
      averageHealthScore: context.healthReport!.overallScore.overall,
      duplicateCount: context.duplicates!.length,
      gapCount: context.gapReport!.gaps.length,
      recommendationCount: context.recommendations!.length,
    });
    this.registry.putSnapshot(snapshot);
    return snapshot;
  }
}
