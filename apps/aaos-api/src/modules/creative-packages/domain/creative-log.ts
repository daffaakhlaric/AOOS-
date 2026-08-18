/**
 * One row of the append-only `creative_logs` audit trail (AAOS-CREATIVE-REVIEW) — the
 * "Log Tamara × Kai" tab's data.
 *
 * Every entry corresponds to something that ACTUALLY happened in the real pipeline: a brief really
 * being handed to `@aos/creative-agent`, a real Kie AI generation really starting or finishing, a
 * real error, a real human approve/reject. There is no synthetic per-line narration and no
 * fabricated event — if the pipeline didn't do it, no row exists.
 *
 * Kept strictly distinct from `creative_packages`' own row-level `status`/`reviewedAt`: package
 * state is never mirrored here, and nothing reconstructs package state by replaying this table.
 */
export type CreativeLogAgent = "TAMARA" | "KAI" | "KIE_AI" | "MANAGER" | "SYSTEM";

export type CreativeLogTarget = "KAI" | "KIE_AI" | "SISTEM";

export type CreativeLogEventType =
  "BRIEF_SENT" | "GENERATE" | "COMPLETE" | "ERROR" | "APPROVED" | "REJECTED";

/** JSON-safe value — the `brief`/`result`/`metadata` JSONB columns. Deliberately not `any`. */
export type CreativeLogJson =
  | string
  | number
  | boolean
  | null
  | readonly CreativeLogJson[]
  | { readonly [key: string]: CreativeLogJson };

export interface CreativeLogEntry {
  readonly id: string;
  readonly tenantId: string;
  readonly packageId?: string;
  readonly fromAgent: CreativeLogAgent;
  readonly toAgent?: CreativeLogTarget;
  readonly eventType: CreativeLogEventType;
  readonly message: string;
  readonly brief?: CreativeLogJson;
  readonly result?: CreativeLogJson;
  readonly error?: string;
  readonly metadata?: CreativeLogJson;
  readonly adId?: string;
  readonly stableId?: string;
  readonly createdAt: string;
}

/** Write shape — `id`/`createdAt` are assigned by the repository. */
export interface AppendCreativeLogInput {
  readonly tenantId: string;
  readonly packageId?: string;
  readonly fromAgent: CreativeLogAgent;
  readonly toAgent?: CreativeLogTarget;
  readonly eventType: CreativeLogEventType;
  readonly message: string;
  readonly brief?: CreativeLogJson;
  readonly result?: CreativeLogJson;
  readonly error?: string;
  readonly metadata?: CreativeLogJson;
  readonly adId?: string;
  readonly stableId?: string;
}

export interface ListCreativeLogsFilter {
  readonly tenantId: string;
  readonly packageId?: string;
  readonly eventType?: CreativeLogEventType;
  /** ISO timestamp lower bound — the tab's "Hari ini / 7 hari / 30 hari" period selector. */
  readonly since?: string;
  readonly limit: number;
}
