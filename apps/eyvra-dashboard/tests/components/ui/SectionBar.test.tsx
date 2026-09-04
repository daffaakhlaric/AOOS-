import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionBar } from "@/components/ui/SectionBar";

describe("SectionBar", () => {
  it("renders the accent bar element", () => {
    render(<SectionBar color="#6366F1" />);
    expect(screen.getByTestId("section-bar")).toBeInTheDocument();
  });

  it("applies the given color as its background via inline style", () => {
    render(<SectionBar color="#6366F1" />);
    const el = screen.getByTestId("section-bar");
    expect(el.style.background).toBe("rgb(99, 102, 241)");
  });

  it("is hidden from assistive tech (purely decorative)", () => {
    render(<SectionBar color="#EF4444" />);
    expect(screen.getByTestId("section-bar")).toHaveAttribute("aria-hidden", "true");
  });

  it("accepts any real CSS color value, not just hex", () => {
    render(<SectionBar color="var(--v2-menu-campaigns)" />);
    const el = screen.getByTestId("section-bar");
    expect(el.style.background).toBe("var(--v2-menu-campaigns)");
  });
});
