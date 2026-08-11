import { Verdict } from "@aos/ai-judge";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerdictBadge } from "@/components/simulator/VerdictBadge";

describe("VerdictBadge", () => {
  it("renders a green badge with ✅ for APPROVE", () => {
    render(<VerdictBadge verdict={Verdict.APPROVE} />);
    const badge = screen.getByTestId("verdict-badge");
    expect(badge).toHaveTextContent("✅");
    expect(badge).toHaveTextContent("APPROVE");
    expect(badge.className).toContain("text-brand-success");
  });

  it("renders an amber badge with ⚠️ for NEEDS_IMPROVEMENT", () => {
    render(<VerdictBadge verdict={Verdict.NEEDS_IMPROVEMENT} />);
    const badge = screen.getByTestId("verdict-badge");
    expect(badge).toHaveTextContent("⚠️");
    expect(badge).toHaveTextContent("NEEDS_IMPROVEMENT");
    expect(badge.className).toContain("text-brand-warning");
  });

  it("renders a red badge with ❌ for FAIL", () => {
    render(<VerdictBadge verdict={Verdict.FAIL} />);
    const badge = screen.getByTestId("verdict-badge");
    expect(badge).toHaveTextContent("❌");
    expect(badge).toHaveTextContent("FAIL");
    expect(badge.className).toContain("text-brand-danger");
  });

  it("exposes the raw verdict via data-verdict for other tests/queries", () => {
    render(<VerdictBadge verdict={Verdict.APPROVE} />);
    expect(screen.getByTestId("verdict-badge")).toHaveAttribute("data-verdict", "APPROVE");
  });
});
