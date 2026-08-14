import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";

describe("VerdictBadge (real bug fix, MAAO2 redesign: 6 visually distinct colors — see VerdictBadge.tsx's docstring on why StatusBadge's 4-tone palette wasn't reused)", () => {
  it.each([
    ["SCALE", "text-green-700"],
    ["KEEP", "text-blue-700"],
    ["PAUSE", "text-red-700"],
    ["REVIEW", "text-orange-700"],
    ["FIX", "text-yellow-800"],
    ["REFRESH", "text-purple-700"],
  ])("shows a distinct color for verdict %s", (verdict, expectedClass) => {
    render(<VerdictBadge verdict={verdict} />);
    expect(screen.getByText(verdict)).toHaveClass(expectedClass);
  });

  it("every verdict maps to a different color class (no two collapse onto the same tone)", () => {
    const verdicts = ["SCALE", "KEEP", "PAUSE", "REVIEW", "FIX", "REFRESH"];
    const classes = verdicts.map((verdict) => {
      render(<VerdictBadge verdict={verdict} />);
      return screen.getByText(verdict).className;
    });
    expect(new Set(classes).size).toBe(verdicts.length);
  });

  it("falls back to neutral tone for an unrecognized verdict", () => {
    render(<VerdictBadge verdict="UNKNOWN" />);
    expect(screen.getByText("UNKNOWN")).toHaveClass("text-ink-muted");
  });
});
