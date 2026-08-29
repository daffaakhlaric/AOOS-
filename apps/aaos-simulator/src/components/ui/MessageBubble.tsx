import type { SimulationMessageDto } from "@/types/simulator.types";

export interface MessageBubbleProps {
  readonly message: SimulationMessageDto;
}

/** Buyer vs Clara bubble style (spec "components/ui/MessageBubble.tsx"): buyer left-aligned/gray, Clara right-aligned/blue. */
export function MessageBubble({ message }: MessageBubbleProps): React.ReactElement {
  const isClara = message.speaker === "CLARA";

  return (
    <div
      data-testid="message-bubble"
      data-speaker={message.speaker}
      className={`flex w-full ${isClara ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-card px-3 py-2 text-sm shadow-card ${
          isClara ? "bg-brand-primary text-white" : "bg-surface-card text-ink"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
      </div>
    </div>
  );
}
