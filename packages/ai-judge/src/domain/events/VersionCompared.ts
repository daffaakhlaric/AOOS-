/** Published once `CompareVersions` produces a `ComparisonReport` (topic `aaos.judge.version.compared`). */
export interface VersionCompared {
  readonly personaId: string;
  readonly beforeJudgementId: string;
  readonly afterJudgementId: string;
  readonly overallScoreDelta: number;
  readonly verdictImproved: boolean;
  readonly verdictRegressed: boolean;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
