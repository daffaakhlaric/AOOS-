import type { Branch } from "@aos/meta-ads-connector";

/** Payload for `aaos.whatsapp.waba.registered`, emitted once per `WabaRegistry.register` call at composition time. */
export interface WabaRegistered {
  readonly wabaId: string;
  readonly phoneNumberId: string;
  readonly branch: Branch;
  readonly displayName: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
