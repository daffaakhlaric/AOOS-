import { MetaApiClient } from "@aos/meta-ads-connector";
import { ConflictException, Injectable } from "@nestjs/common";

import type { ActionCommand } from "./action.types.js";

/** Missing, paginated, or malformed data is not proof that the entire campaign is stable. */
export function validateCampaignLearning(command: ActionCommand, result: Record<string, unknown>) {
  const paging = result["paging"] as { next?: unknown } | undefined;
  const rows = result["data"];
  if (paging?.next || !Array.isArray(rows) || rows.length === 0)
    throw new ConflictException("LEARNING_COVERAGE_UNVERIFIED");
  const ids = new Set<string>();
  for (const value of rows) {
    if (!value || typeof value !== "object") throw new ConflictException("LEARNING_UNVERIFIED");
    const row = value as Record<string, unknown>;
    if (
      typeof row["id"] !== "string" ||
      ids.has(row["id"]) ||
      row["campaign_id"] !== command.entityId ||
      String(row["account_id"]) !== command.adAccountId.replace(/^act_/, "")
    )
      throw new ConflictException("LEARNING_SCOPE_MISMATCH");
    ids.add(row["id"]);
    if (row["status"] === "PAUSED" || row["status"] === "ARCHIVED" || row["status"] === "DELETED")
      continue;
    if (row["status"] !== "ACTIVE") throw new ConflictException("LEARNING_UNVERIFIED");
    const learning = row["learning_stage_info"] as { status?: unknown } | undefined;
    if (learning?.status === "LEARNING" || learning?.status === "LEARNING_LIMITED")
      throw new ConflictException("CAMPAIGN_LEARNING_PROTECTED");
    if (learning?.status !== "SUCCESS") throw new ConflictException("LEARNING_UNVERIFIED");
  }
}

@Injectable()
export class ActionLearningService {
  private readonly reader = new MetaApiClient({ timeoutMs: 15000 });
  async verify(command: ActionCommand, token: string) {
    const result = await this.reader.readGraph(
      `${command.entityId}/adsets`,
      token,
      "id,campaign_id,account_id,status,learning_stage_info",
    );
    if (!result.ok) throw new ConflictException("LEARNING_UNAVAILABLE");
    validateCampaignLearning(command, result.value);
  }
}
