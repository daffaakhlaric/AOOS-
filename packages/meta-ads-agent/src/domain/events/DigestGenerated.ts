/** Payload for `aaos.samantha.digest.generated`, emitted once `GenerateDailyDigest` produces a `DailyDigest`. */
export interface DigestGenerated {
  readonly tenantId: string;
  readonly date: Date;
  readonly currentHotLeads: number;
  readonly targetHotLeads: number;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
