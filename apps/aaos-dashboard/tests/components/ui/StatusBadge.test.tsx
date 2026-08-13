import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/ui/StatusBadge";

describe("StatusBadge", () => {
  it("renders the label", () => {
    render(<StatusBadge label="ON" tone="success" />);
    expect(screen.getByText("ON")).toBeInTheDocument();
  });

  it("applies the success tone's color class", () => {
    render(<StatusBadge label="ON" tone="success" />);
    expect(screen.getByText("ON")).toHaveClass("text-brand-success");
  });

  it("applies the danger tone's color class", () => {
    render(<StatusBadge label="OFF" tone="danger" />);
    expect(screen.getByText("OFF")).toHaveClass("text-brand-danger");
  });

  it("applies the warning tone's color class", () => {
    render(<StatusBadge label="BUSY" tone="warning" />);
    expect(screen.getByText("BUSY")).toHaveClass("text-brand-warning");
  });

  it("applies the neutral tone's color class", () => {
    render(<StatusBadge label="N/A" tone="neutral" />);
    expect(screen.getByText("N/A")).toHaveClass("text-ink-muted");
  });
});
