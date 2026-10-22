import { Injectable, NotFoundException } from "@nestjs/common";

import { ActionRepository, type ExecutionRow, type StepRow } from "./action.repository.js";

/** Deliberately omit claim tokens, arbitrary payloads and raw provider errors from public responses. */
export function actionSummary(row: ExecutionRow) {
  return {
    id: row.id,
    commandHash: row.command_hash,
    beforeStatus:
      typeof row.command.currentStateSnapshot?.status === "string"
        ? row.command.currentStateSnapshot.status
        : null,
    targetStatus:
      typeof row.command.targetState?.status === "string" ? row.command.targetState.status : null,
    evidenceSnapshotId: row.command.evidenceSnapshotId,
    reason: row.command.reason ?? null,
    revision: row.revision,
    pendingActionId: row.pending_action_id,
    state: row.state,
    actionType: row.command.actionType,
    entityType: row.command.entityType,
    entityId: row.command.entityId,
    adAccountId: row.command.adAccountId,
    credentialVersion: row.command.credentialVersion,
    policyVersion: row.command.policyVersion,
    correlationId: row.command.correlationId,
    createdAt: row.command.createdAt,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    verified: row.state === "VERIFIED",
  };
}
export function stepSummary(row: StepRow) {
  return {
    id: row.id,
    key: row.step_key,
    ordinal: row.ordinal,
    state: row.state,
    attempt: row.attempt,
    providerObjectId: row.provider_object_id,
    receiptRecorded: row.receipt !== null,
    verified: row.state === "VERIFIED",
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

@Injectable()
export class ActionQueryService {
  constructor(private readonly repository: ActionRepository) {}
  async list(tenant: string) {
    return (await this.repository.list(tenant)).map(actionSummary);
  }
  async detail(tenant: string, id: string) {
    const row = await this.repository.find(tenant, id);
    if (!row || row.tenant_id !== tenant || row.command.tenantId !== tenant)
      throw new NotFoundException("Action not found");
    const steps = await this.repository.steps(tenant, id);
    return { ...actionSummary(row), steps: steps.map(stepSummary) };
  }
}
