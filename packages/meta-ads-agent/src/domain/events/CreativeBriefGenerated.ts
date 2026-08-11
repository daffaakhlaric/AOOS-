/** Payload for `aaos.tamara.creative.briefed`, emitted whenever Tamara generates a `CreativeBrief` for Kai. */
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
