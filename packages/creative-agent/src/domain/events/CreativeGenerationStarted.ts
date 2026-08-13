import type { Branch } from "@aos/meta-ads-connector";

import type { CreativeFormat } from "../value-objects/CreativeFormat.js";

/** Published the moment `KaiAgentService` commits to a format decision and begins orchestrating Kie AI generation for a `CreativeBrief` (spec "Domain — events/CreativeGenerationStarted.ts"). */
export interface CreativeGenerationStarted {
  readonly jobId: string;
  readonly briefId: string;
  readonly branch: Branch;
  readonly unit: string;
  readonly format: CreativeFormat;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: string;
}
