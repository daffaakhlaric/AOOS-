import type { Branch } from "@aos/meta-ads-connector";

/** Published once a `CreativePackage` reaches `READY` — DSS dashboard + Samantha both listen (spec Mission step 7: "Emit `CreativePackageReady` event for DSS dashboard approval"). */
export interface CreativePackageReady {
  readonly packageId: string;
  readonly briefId: string;
  readonly branch: Branch;
  readonly unit: string;
  readonly videoUrl?: string;
  readonly imageUrls: ReadonlyArray<string>;
  readonly copyVariantCount: number;
  readonly confidenceScore: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: string;
}
