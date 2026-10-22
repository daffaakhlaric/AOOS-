export const ACTION_TYPES = [
  "CREATE_CAMPAIGN",
  "CREATE_ADSET",
  "CREATE_CREATIVE",
  "CREATE_AD",
  "PUBLISH_CAMPAIGN",
  "PAUSE_CAMPAIGN",
  "RESUME_CAMPAIGN",
  "PAUSE_ADSET",
  "RESUME_ADSET",
  "PAUSE_AD",
  "RESUME_AD",
  "UPDATE_BUDGET",
  "REPLACE_CREATIVE",
  "ACTIVATE_CREATIVE",
  "PAUSE_CREATIVE",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
export const ACTION_STATES = [
  "PROPOSED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "CLAIMED",
  "EXECUTING",
  "PARTIAL",
  "VERIFYING",
  "VERIFIED",
  "FAILED",
  "UNCERTAIN",
  "RECONCILING",
  "ROLLED_BACK",
  "CANCELLED",
  "SUPERSEDED",
] as const;
export type ActionState = (typeof ACTION_STATES)[number];
export type EntityType = "CAMPAIGN" | "ADSET" | "AD" | "CREATIVE";

/** Server-created snapshot. Never accept tenant, approval or integration identity from UI payloads. */
export interface ActionCommand {
  readonly actionId: string;
  readonly revision: number;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly integrationId: string;
  readonly credentialVersion: number;
  readonly adAccountId: string;
  readonly actor: { readonly type: "HUMAN" | "SAMANTHA" | "SYSTEM"; readonly userId?: string };
  readonly actionType: ActionType;
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly targetState: Readonly<Record<string, unknown>>;
  readonly currentStateSnapshot: Readonly<Record<string, unknown>>;
  readonly policyVersion: number;
  readonly evidenceSnapshotId: string;
  readonly reason?: string;
  readonly correlationId: string;
  readonly createdAt: string;
  readonly steps: readonly {
    readonly key: string;
    readonly intent: Readonly<Record<string, unknown>>;
  }[];
}
