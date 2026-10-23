import { Injectable, Logger } from "@nestjs/common";

import { ActivityLogger } from "../activity-log/activity-logger.service.js";
import { ModeGuardService } from "../mode-guard/mode-guard.service.js";

import type { ExecutionRow } from "./action.repository.js";

/** Activity is a projection of the durable ledger, not a second execution authority. */
@Injectable()
export class ActionActivityService {
  private readonly logger = new Logger(ActionActivityService.name);
  constructor(
    private readonly activity: ActivityLogger,
    private readonly mode: ModeGuardService,
  ) {}
  async record(
    row: ExecutionRow,
    userId: string,
    phase: "APPROVAL" | "EXECUTION" | "EXECUTION_REJECTED" | "RECONCILIATION",
  ) {
    try {
      const activityId = await this.activity.start({
        tenantId: row.tenant_id,
        agent: "SAMANTHA",
        actionType: `ACTION_${phase}`,
        mode: await this.mode.resolveMode(row.tenant_id),
        input: {
          actionId: row.id,
          actionType: row.command.actionType,
          campaignId: row.command.entityId,
          correlationId: row.command.correlationId,
          revision: row.revision,
          userId,
        },
      });
      const output = {
        actionId: row.id,
        state: row.state,
        phase,
        metaVerified: row.state === "VERIFIED",
        message:
          phase === "EXECUTION_REJECTED"
            ? "Permintaan eksekusi ditolak. Status ledger di bawah bukan bukti eksekusi baru."
            : phase === "APPROVAL"
              ? "Approval tersimpan; belum menjalankan perubahan Meta."
              : row.state === "VERIFIED"
                ? "Hasil diperiksa kembali melalui Meta."
                : "Hasil belum terverifikasi. Periksa ledger sebelum mengambil tindakan berikutnya.",
      };
      if (
        (phase === "APPROVAL" && row.state === "APPROVED") ||
        (["EXECUTION", "RECONCILIATION"].includes(phase) && row.state === "VERIFIED")
      )
        await this.activity.complete(activityId, { status: "SUCCESS", output });
      else await this.activity.escalate(activityId, { output });
    } catch {
      // Never turn a completed provider write into a retriable failure because logging failed.
      this.logger.warn("ACTION_ACTIVITY_PROJECTION_FAILED");
    }
  }
}
