export interface KnowledgeIntelligenceStatisticsProps {
  readonly itemsAnalyzed: number;
  readonly findingsCount: number;
  readonly insightsCount: number;
  readonly recommendationsCount: number;
  readonly duplicatesCount: number;
  readonly nearDuplicatesCount: number;
  readonly relationshipsCount: number;
  readonly gapsCount: number;
  readonly orphansCount: number;
  readonly averageHealthScore: number;
  readonly averageQualityScore: number;
  readonly averageFreshnessScore: number;
  readonly averageRiskScore: number;
}

/** Immutable computed statistics snapshot for one intelligence run. */
export class KnowledgeIntelligenceStatistics {
  readonly itemsAnalyzed: number;
  readonly findingsCount: number;
  readonly insightsCount: number;
  readonly recommendationsCount: number;
  readonly duplicatesCount: number;
  readonly nearDuplicatesCount: number;
  readonly relationshipsCount: number;
  readonly gapsCount: number;
  readonly orphansCount: number;
  readonly averageHealthScore: number;
  readonly averageQualityScore: number;
  readonly averageFreshnessScore: number;
  readonly averageRiskScore: number;

  constructor(props: KnowledgeIntelligenceStatisticsProps) {
    for (const [key, value] of Object.entries(props)) {
      if (value < 0) {
        throw new RangeError(`KnowledgeIntelligenceStatistics: ${key} must be >= 0`);
      }
    }
    this.itemsAnalyzed = props.itemsAnalyzed;
    this.findingsCount = props.findingsCount;
    this.insightsCount = props.insightsCount;
    this.recommendationsCount = props.recommendationsCount;
    this.duplicatesCount = props.duplicatesCount;
    this.nearDuplicatesCount = props.nearDuplicatesCount;
    this.relationshipsCount = props.relationshipsCount;
    this.gapsCount = props.gapsCount;
    this.orphansCount = props.orphansCount;
    this.averageHealthScore = props.averageHealthScore;
    this.averageQualityScore = props.averageQualityScore;
    this.averageFreshnessScore = props.averageFreshnessScore;
    this.averageRiskScore = props.averageRiskScore;
    Object.freeze(this);
  }

  static empty(): KnowledgeIntelligenceStatistics {
    return new KnowledgeIntelligenceStatistics({
      itemsAnalyzed: 0,
      findingsCount: 0,
      insightsCount: 0,
      recommendationsCount: 0,
      duplicatesCount: 0,
      nearDuplicatesCount: 0,
      relationshipsCount: 0,
      gapsCount: 0,
      orphansCount: 0,
      averageHealthScore: 0,
      averageQualityScore: 0,
      averageFreshnessScore: 0,
      averageRiskScore: 0,
    });
  }
}
