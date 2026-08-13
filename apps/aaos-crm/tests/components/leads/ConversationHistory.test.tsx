import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConversationHistory } from "@/components/leads/ConversationHistory";

describe("ConversationHistory", () => {
  it("shows an empty-conversation message when there are no messages", () => {
    render(<ConversationHistory messages={[]} />);
    expect(screen.getByTestId("conversation-empty")).toBeInTheDocument();
  });

  it("renders messages in the given (chronological) order", () => {
    render(
      <ConversationHistory
        messages={[
          {
            id: "m1",
            direction: "INCOMING",
            messageType: "TEXT",
            body: "halo kak ada Xpander gak?",
            createdAt: "2026-08-13T09:00:00.000Z",
          },
          {
            id: "m2",
            direction: "OUTGOING",
            messageType: "TEXT",
            body: "Ada kak! Xpander Cross 2019...",
            createdAt: "2026-08-13T09:01:00.000Z",
          },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("halo kak ada Xpander gak?");
    expect(items[1]).toHaveTextContent("Ada kak! Xpander Cross 2019...");
  });

  it("labels an INCOMING message as 'Lead' and OUTGOING as 'Jessy'", () => {
    render(
      <ConversationHistory
        messages={[
          {
            id: "m1",
            direction: "INCOMING",
            messageType: "TEXT",
            body: "hi",
            createdAt: "2026-08-13T09:00:00.000Z",
          },
          {
            id: "m2",
            direction: "OUTGOING",
            messageType: "TEXT",
            body: "hello",
            createdAt: "2026-08-13T09:01:00.000Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("Jessy")).toBeInTheDocument();
  });
});
