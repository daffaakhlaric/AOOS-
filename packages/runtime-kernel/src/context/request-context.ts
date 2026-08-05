import type { IsoDateTime } from "@aos/types";

/** Identifies a single inbound unit of work (an API call, an Agent invocation, a scheduled tick). */
export interface RequestContext {
  readonly requestId: string;
  readonly receivedAt: IsoDateTime;
}
