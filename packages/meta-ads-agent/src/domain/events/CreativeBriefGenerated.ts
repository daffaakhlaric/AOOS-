/** Payload for `aaos.samantha.creative.briefed`, emitted whenever Samantha generates a `CreativeBrief` for Kai. */
export interface CreativeBriefGenerated {
  readonly tenantId: string;
  readonly creativeBriefId: string;
  readonly adId: string;
  readonly angle: string;
  readonly urgency: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
