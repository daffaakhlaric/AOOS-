import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";

describe("VerdictBadge", () => {
  it.each([
    ["SCALE", "text-brand-success"],
    ["KEEP", "text-brand-success"],
    ["REVIEW", "text-brand-warning"],
    ["PAUSE", "text-brand-danger"],
    ["REFRESH", "text-brand-warning"],
    ["FIX", "text-brand-danger"],
  ])("shows the correct color for verdict %s", (verdict, expectedClass) => {
    render(<VerdictBadge verdict={verdict} />);
    expect(screen.getByText(verdict)).toHaveClass(expectedClass);
  });

  it("falls back to neutral tone for an unrecognized verdict", () => {
    render(<VerdictBadge verdict="UNKNOWN" />);
    expect(screen.getByText("UNKNOWN")).toHaveClass("text-ink-muted");
  });
});
