import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge, type BadgeType } from "@/components/ui/Badge";

/**
 * Real path deviation from the coordinator note's literal `src/components/ui/Badge.test.tsx`:
 * `vitest.config.ts`'s `test.include` is `tests/**\/*.test.{ts,tsx}` only — every other real test
 * in this app (including `StatusBadge.test.tsx`, this component's nearest real precedent) lives
 * under `tests/components/**`, not colocated in `src`. Putting this file at the coordinator's
 * literal path would mean Vitest never picks it up. Same `data-testid`/CSS-Modules-hash-safe
 * assertion convention as `tests/components/ui/StatusBadge.test.tsx`.
 */
describe("Badge", () => {
  it("renders the correct label text per type", () => {
    const cases: readonly [BadgeType, string][] = [
      ["HOT", "HOT"],
      ["WARM", "WARM"],
      ["COLD", "COLD"],
      ["LIVE", "Live"],
      ["PAUSED", "Paused"],
      ["LEARNING", "Learning"],
      ["EXECUTED", "Executed"],
      ["SIMULATED", "Simulated"],
      ["ERROR", "Error"],
      ["RUNNING", "Running"],
      ["HANDOFF", "Handoff"],
      ["PROSES", "Proses"],
      ["RECYCLING", "Recycle"],
      ["FINAL", "Final"],
      ["IMPROVING", "Improving"],
      ["STABLE", "Stable"],
      ["ALERT", "Alert"],
      ["APPLIED", "Applied"],
      ["REJECTED", "Rejected"],
      ["ROLLED_BACK", "Rolled Back"],
    ];

    for (const [type, label] of cases) {
      render(<Badge type={type} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("tags the badge with its type via data-type", () => {
    render(<Badge type="HOT" />);
    expect(screen.getByTestId("badge")).toHaveAttribute("data-type", "HOT");
  });

  it("defaults to size sm", () => {
    render(<Badge type="LIVE" />);
    expect(screen.getByTestId("badge")).toHaveAttribute("data-size", "sm");
  });

  it("applies the requested size via data-size", () => {
    render(<Badge type="LIVE" size="xs" />);
    expect(screen.getByTestId("badge")).toHaveAttribute("data-size", "xs");

    render(<Badge type="LIVE" size="md" />);
    expect(screen.getAllByTestId("badge").at(-1)).toHaveAttribute("data-size", "md");
  });

  it("distinct sizes produce distinct class names", () => {
    const sizes = ["xs", "sm", "md"] as const;
    const classes = sizes.map((size) => {
      render(<Badge type="LIVE" size={size} />);
      return screen.getAllByTestId("badge").at(-1)!.className;
    });
    expect(new Set(classes).size).toBe(sizes.length);
  });

  it("applies the configured solid background/color per type via inline style", () => {
    render(<Badge type="HOT" />);
    const el = screen.getByTestId("badge");
    expect(el.style.background).toBe("rgb(239, 68, 68)");
    expect(el.style.color).toBe("rgb(255, 255, 255)");
  });
});
