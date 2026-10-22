import { ConflictException } from "@nestjs/common";

import { commandHash } from "./action.repository.js";
import type { ActionCommand } from "./action.types.js";

/** Status execution has exactly one absolute mutation. Arbitrary provider payloads are forbidden. */
export function statusTarget(command: ActionCommand): "PAUSED" | "ACTIVE" {
  if (command.actionType === "UPDATE_BUDGET")
    throw new ConflictException("BUDGET_WRITE_UNVERIFIED");
  if (
    !["PAUSE_CAMPAIGN", "RESUME_CAMPAIGN"].includes(command.actionType) ||
    command.entityType !== "CAMPAIGN"
  )
    throw new ConflictException("ACTION_EXECUTION_NOT_SUPPORTED");
  const status = command.actionType === "PAUSE_CAMPAIGN" ? "PAUSED" : "ACTIVE";
  if (
    !/^\d+$/.test(command.entityId) ||
    !/^act_\d+$/.test(command.adAccountId) ||
    commandHash(command.targetState) !== commandHash({ status }) ||
    command.steps.length !== 1 ||
    commandHash(command.steps[0]?.intent) !== commandHash({ status }) ||
    typeof command.currentStateSnapshot.status !== "string"
  )
    throw new ConflictException("INVALID_STATUS_COMMAND");
  return status;
}
