import type { AdAngle } from "@aos/meta-ads-agent";

/** Published once per `CopyVariant` `CopyBuilder` produces (spec "Domain — events/CopyVariantGenerated.ts") — lets downstream listeners (e.g. an analytics sink) observe copy generation independently of whether the whole package eventually reaches `READY`. */
export interface CopyVariantGenerated {
  readonly briefId: string;
  readonly variantLabel: "A" | "B" | "C";
  readonly angle: AdAngle;
  readonly headline: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: string;
}
