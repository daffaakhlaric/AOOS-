import type { LearningBridgeStatusDto } from "@/types/simulator.types";

export interface LearningBridgeStatusProps {
  readonly status: LearningBridgeStatusDto;
}

/**
 * Self-Learning AI bridge phase — an honest, real status card for whether THIS run's report was
 * forwarded into `apps/aaos-api`'s Self-Improving pipeline (`POST /api/simulate-all`'s
 * `learningBridge` field, `src/lib/learning-bridge.ts`). Never fabricates a "terkirim" status —
 * renders exactly the real 3-way outcome the bridge call produced.
 */
export function LearningBridgeStatus({ status }: LearningBridgeStatusProps): React.ReactElement {
  if (status.status === "SENT") {
    return (
      <div
        data-testid="learning-bridge-status"
        data-status="SENT"
        className="flex flex-col gap-1 rounded-card border border-hairline bg-surface-card p-4 shadow-card"
      >
        <p className="text-sm font-semibold text-ink">
          ✅ Terkirim ke Self-Improving System — proposal baru sedang diproses
        </p>
        <p className="text-xs text-ink-muted">
          agent_run: <code>{status.agentRunId}</code> · judge_result:{" "}
          <code>{status.judgeResultId}</code>
        </p>
      </div>
    );
  }

  if (status.status === "SKIPPED") {
    return (
      <div
        data-testid="learning-bridge-status"
        data-status="SKIPPED"
        className="flex flex-col gap-1 rounded-card border border-hairline bg-surface-card p-4 shadow-card"
      >
        <p className="text-sm font-semibold text-ink-muted">
          ⏭️ Belum terhubung ke Self-Improving System
        </p>
        <p className="text-xs text-ink-muted">{status.reason}</p>
      </div>
    );
  }

  return (
    <div
      data-testid="learning-bridge-status"
      data-status="FAILED"
      className="flex flex-col gap-1 rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <p className="text-sm font-semibold text-ink">
        ⚠️ Gagal terkirim ke Self-Improving System — cek log
      </p>
      <p className="text-xs text-ink-muted">{status.reason}</p>
    </div>
  );
}
