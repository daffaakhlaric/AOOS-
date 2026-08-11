import { formatDurationSeconds } from "@/lib/formatters";
import type { SimulationResultDto } from "@/types/simulator.types";

import { MessageBubble } from "../ui/MessageBubble";

export interface ConversationViewProps {
  readonly simulationResult: SimulationResultDto | undefined;
}

/** Message bubbles for buyer + Jessy, plus handoff badge and turn/duration summary (spec "components/simulator/ConversationView.tsx"). */
export function ConversationView({ simulationResult }: ConversationViewProps): React.ReactElement {
  if (!simulationResult) {
    return (
      <div
        data-testid="conversation-empty-state"
        className="flex h-full min-h-[240px] items-center justify-center rounded-card border border-dashed border-hairline p-6 text-center text-sm text-ink-muted"
      >
        Pilih skenario untuk mulai
      </div>
    );
  }

  return (
    <div data-testid="conversation-view" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {simulationResult.messages.map((message) => (
          <MessageBubble key={`${message.turn}-${message.speaker}`} message={message} />
        ))}
      </div>

      {simulationResult.handoffTriggered && (
        <div
          data-testid="handoff-badge"
          className="self-center rounded-button bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary"
        >
          [HANDOFF TRIGGERED]
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <span>✅ Selesai</span>
        <span>
          {simulationResult.totalTurns} turns, {formatDurationSeconds(simulationResult.durationMs)}
        </span>
      </div>
    </div>
  );
}
