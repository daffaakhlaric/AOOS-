import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageBubble } from "@/components/ui/MessageBubble";

import { buildMessage } from "../fixtures";

describe("MessageBubble", () => {
  it("renders the message text", () => {
    render(<MessageBubble message={buildMessage({ text: "mau beli Xpander budget 200 juta" })} />);
    expect(screen.getByText("mau beli Xpander budget 200 juta")).toBeInTheDocument();
  });

  it("left-aligns and does not blue-fill a BUYER message", () => {
    render(<MessageBubble message={buildMessage({ speaker: "BUYER" })} />);
    const bubble = screen.getByTestId("message-bubble");
    expect(bubble.className).toContain("justify-start");
    expect(bubble.querySelector("div")?.className).not.toContain("bg-brand-primary");
  });

  it("right-aligns and blue-fills a JESSY message", () => {
    render(<MessageBubble message={buildMessage({ speaker: "JESSY" })} />);
    const bubble = screen.getByTestId("message-bubble");
    expect(bubble.className).toContain("justify-end");
    expect(bubble.querySelector("div")?.className).toContain("bg-brand-primary");
  });
});
