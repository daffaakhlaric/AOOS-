export interface KnowledgeAnalyticsReport {
  readonly metric: string;
  readonly value: number;
  readonly dimensions?: Readonly<Record<string, string>>;
}

/** "IKnowledgeAnalytics — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "AI READY: Knowledge Analytics"). Implementation belongs to a future Engineering Task. */
export interface IKnowledgeAnalytics {
  report(metric: string): Promise<readonly KnowledgeAnalyticsReport[]>;
}
