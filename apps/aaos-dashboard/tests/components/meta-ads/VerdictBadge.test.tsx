import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";

describe("VerdictBadge (UI-overhaul pass: exact per-verdict hex/icon values from docs/PROMPT-AAOS-DASHBOARD-UI-OVERHAUL.md — see VerdictBadge.tsx's docstring for why REVIEW/FIX and PAUSE/CUT are INTENTIONALLY the same color pair per the spec's own hex table)", () => {
  it.each([
    ["SCALE", "text-[#1A9E5C]", "↑"],
    ["KEEP", "text-[#2563EB]", "●"],
    ["REVIEW", "text-[#D97706]", "◐"],
    ["PAUSE", "text-[#DC2626]", "⏸"],
    ["FIX", "text-[#D97706]", "⚠"],
    ["CUT", "text-[#DC2626]", "✕"],
    ["REFRESH", "text-purple-700", "↻"],
  ])("shows the spec's exact color + icon for verdict %s", (verdict, expectedClass, icon) => {
    render(<VerdictBadge verdict={verdict} />);
    const badge = screen.getByTestId("verdict-badge");
    expect(badge).toHaveClass(expectedClass);
    expect(badge.textContent).toBe(`${icon}${verdict}`);
  });

  it("REVIEW and FIX intentionally render the identical color (spec's own hex table gives them the same bg/text/border) — distinguished only by icon + label", () => {
    render(<VerdictBadge verdict="REVIEW" />);
    const review = screen.getByTestId("verdict-badge").className;
    render(<VerdictBadge verdict="FIX" />);
    const fix = screen.getAllByTestId("verdict-badge")[1]!.className;
    expect(review).toBe(fix);
  });

  it("PAUSE and CUT intentionally render the identical color — distinguished only by icon + label", () => {
    render(<VerdictBadge verdict="PAUSE" />);
    const pause = screen.getByTestId("verdict-badge").className;
    render(<VerdictBadge verdict="CUT" />);
    const cut = screen.getAllByTestId("verdict-badge")[1]!.className;
    expect(pause).toBe(cut);
  });

  it("every verdict maps to a visually distinct color EXCEPT the two spec-intended pairs (REVIEW/FIX, PAUSE/CUT)", () => {
    const verdicts = ["SCALE", "KEEP", "REVIEW", "PAUSE", "FIX", "CUT", "REFRESH"];
    const classes = verdicts.map((verdict) => {
      render(<VerdictBadge verdict={verdict} />);
      return screen.getAllByTestId("verdict-badge").at(-1)!.className;
    });
    // 7 verdicts, but REVIEW===FIX and PAUSE===CUT collapse two pairs → 5 distinct classes.
    expect(new Set(classes).size).toBe(5);
  });

  it("falls back to neutral tone for an unrecognized verdict", () => {
    render(<VerdictBadge verdict="UNKNOWN" />);
    expect(screen.getByTestId("verdict-badge")).toHaveClass("text-ink-muted");
  });
});
