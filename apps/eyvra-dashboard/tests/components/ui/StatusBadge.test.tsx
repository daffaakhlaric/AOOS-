import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/ui/StatusBadge";

/**
 * CSS Modules hash class names under this repo's Vitest transform (confirmed via a throwaway
 * smoke test), so tone assertions use `data-tone` (rendered by the component) plus cross-tone
 * className inequality, never exact class-name string matches.
 */
describe("StatusBadge", () => {
  it("renders the label", () => {
    render(<StatusBadge label="ON" tone="success" />);
    expect(screen.getByText("ON")).toBeInTheDocument();
  });

  it("tags the badge with its tone via data-tone", () => {
    render(<StatusBadge label="ON" tone="success" />);
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-tone", "success");
  });

  it("distinct tones produce distinct class names", () => {
    const tones = ["success", "danger", "warning", "neutral"] as const;
    const classes = tones.map((tone) => {
      render(<StatusBadge label={tone} tone={tone} />);
      return screen.getAllByTestId("status-badge").at(-1)!.className;
    });
    expect(new Set(classes).size).toBe(tones.length);
  });
});
