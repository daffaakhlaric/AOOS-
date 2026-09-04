import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";

/**
 * CSS Modules under this repo's Vitest config hash class names at transform time (confirmed via a
 * throwaway smoke test before writing this file — e.g. `styles.scale` resolves to something like
 * `_scale_16bbdb`, never the literal string `"scale"`), so assertions here use `data-verdict`
 * (rendered by the component alongside its CSS-module class) and `className` EQUALITY across
 * verdicts, never exact class-name string matches.
 */
describe("VerdictBadge (TOTAL UI REBUILD spec: exact per-verdict colors from docs/PROMPT-AAOS-DASHBOARD-TOTAL-REBUILD.md — see VerdictBadge.tsx's docstring for why REFRESH/CUT extend the spec's 5-verdict table)", () => {
  it.each([
    ["SCALE", "↑"],
    ["KEEP", "●"],
    ["REVIEW", "◐"],
    ["PAUSE", "⏸"],
    ["FIX", "⚠"],
    ["CUT", "✕"],
    ["REFRESH", "↻"],
  ])("shows the spec's icon for verdict %s and tags it with data-verdict", (verdict, icon) => {
    render(<VerdictBadge verdict={verdict} />);
    const badge = screen.getByTestId("verdict-badge");
    expect(badge).toHaveAttribute("data-verdict", verdict);
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
    const badge = screen.getByTestId("verdict-badge");
    expect(badge).toHaveAttribute("data-verdict", "UNKNOWN");
    render(<VerdictBadge verdict="SCALE" />);
    const scaleClass = screen.getAllByTestId("verdict-badge")[1]!.className;
    expect(badge.className).not.toBe(scaleClass);
  });
});
