import { formatRelativeTimeId } from "@/lib/formatters";
import type { MessageDto, ScoringEventDto } from "@/types/crm.types";

export interface ConversationHistoryProps {
  readonly messages: readonly MessageDto[];
  /**
   * AAOS-CHAT-ROOM-JESSY — real `scoring_events` rows for this lead, merged into the timeline as
   * inline system-event dividers. Optional (defaults to none) so every existing caller/test that
   * only has messages keeps working unchanged.
   */
  readonly scoringEvents?: readonly ScoringEventDto[];
}

/** Sender label for an OUTGOING message (coordinator note #2/#5). INCOMING is always "Lead" — handled separately by the caller. */
function senderLabel(message: MessageDto): string {
  if (message.senderType === "SALES_HUMAN") {
    return message.senderName ?? "Sales";
  }
  if (message.senderType === "MANAGER_INTERVENTION") {
    return "Jessy (intervensi manual)";
  }
  // Covers senderType === "JESSY" and the undefined/legacy case (pre-migration rows) — both are
  // Jessy's own automated reply.
  return "Jessy";
}

type TimelineItem =
  | { readonly kind: "message"; readonly at: number; readonly message: MessageDto }
  | { readonly kind: "scoring"; readonly at: number; readonly event: ScoringEventDto };

function buildTimeline(
  messages: readonly MessageDto[],
  scoringEvents: readonly ScoringEventDto[],
): readonly TimelineItem[] {
  const items: TimelineItem[] = [
    ...messages.map((message): TimelineItem => ({
      kind: "message",
      at: Date.parse(message.sentAt ?? message.createdAt),
      message,
    })),
    ...scoringEvents.map((event): TimelineItem => ({
      kind: "scoring",
      at: Date.parse(event.createdAt),
      event,
    })),
  ];
  return items.sort((a, b) => a.at - b.at);
}

/**
 * Riwayat Percakapan — the REAL per-message history (spec mockup "📱 Riwayat Percakapan"), read
 * from `@aos/lead-store`'s real `messages` table (coordinator note #2), not a synthesized summary.
 * AAOS-CHAT-ROOM-JESSY extends this with `senderType`-aware labels (Jessy vs. sales human vs.
 * manager intervention) and real `scoring_events` merged in as inline system-event dividers —
 * never a fabricated event not backed by a real row.
 */
export function ConversationHistory({
  messages,
  scoringEvents = [],
}: ConversationHistoryProps): React.ReactElement {
  if (messages.length === 0 && scoringEvents.length === 0) {
    return (
      <p data-testid="conversation-empty" className="text-sm text-ink-muted">
        Belum ada percakapan.
      </p>
    );
  }
  const timeline = buildTimeline(messages, scoringEvents);
  return (
    <ul data-testid="conversation-history" className="flex flex-col gap-2">
      {timeline.map((item) =>
        item.kind === "scoring" ? (
          <li
            key={`scoring-${item.event.id}`}
            className="self-center rounded-full bg-ink-muted/10 px-3 py-1 text-center text-xs italic text-ink-muted"
          >
            {item.event.reason} {item.event.delta >= 0 ? "+" : ""}
            {item.event.delta} pts → {item.event.scoreAfter}
          </li>
        ) : (
          <li
            key={item.message.id}
            className={`max-w-[85%] rounded-card px-3 py-2 text-sm ${
              item.message.direction === "INCOMING"
                ? "self-start bg-ink-muted/10 text-ink"
                : item.message.senderType === "SALES_HUMAN"
                  ? "self-end bg-emerald-500/10 text-ink"
                  : "self-end bg-brand-primary/10 text-ink"
            }`}
          >
            <p className="text-xs font-semibold text-ink-muted">
              {item.message.direction === "INCOMING" ? "Lead" : senderLabel(item.message)}
            </p>
            <p>{item.message.body ?? `[${item.message.messageType}]`}</p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {formatRelativeTimeId(item.message.sentAt ?? item.message.createdAt)}
            </p>
          </li>
        ),
      )}
    </ul>
  );
}
