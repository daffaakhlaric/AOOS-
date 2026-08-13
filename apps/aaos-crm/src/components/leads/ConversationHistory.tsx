import { formatRelativeTimeId } from "@/lib/formatters";
import type { MessageDto } from "@/types/crm.types";

export interface ConversationHistoryProps {
  readonly messages: readonly MessageDto[];
}

/** Riwayat Percakapan — the REAL per-message history (spec mockup "📱 Riwayat Percakapan"), read from `@aos/lead-store`'s real `messages` table via `MessageRepository.findByConversationId` (coordinator note #2), not a synthesized summary. */
export function ConversationHistory({ messages }: ConversationHistoryProps): React.ReactElement {
  if (messages.length === 0) {
    return (
      <p data-testid="conversation-empty" className="text-sm text-ink-muted">
        Belum ada percakapan.
      </p>
    );
  }
  return (
    <ul data-testid="conversation-history" className="flex flex-col gap-2">
      {messages.map((message) => (
        <li
          key={message.id}
          className={`max-w-[85%] rounded-card px-3 py-2 text-sm ${
            message.direction === "INCOMING"
              ? "self-start bg-ink-muted/10 text-ink"
              : "self-end bg-brand-primary/10 text-ink"
          }`}
        >
          <p className="text-xs font-semibold text-ink-muted">
            {message.direction === "INCOMING" ? "Lead" : "Jessy"}
          </p>
          <p>{message.body ?? `[${message.messageType}]`}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            {formatRelativeTimeId(message.sentAt ?? message.createdAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}
