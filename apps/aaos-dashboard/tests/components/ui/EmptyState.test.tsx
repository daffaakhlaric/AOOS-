import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="Belum ada data" />);
    expect(screen.getByText("Belum ada data")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<EmptyState title="Kosong" description="Coba lagi nanti." />);
    expect(screen.getByText("Coba lagi nanti.")).toBeInTheDocument();
  });

  it("omits the description paragraph when not provided", () => {
    render(<EmptyState title="Kosong" />);
    expect(screen.queryByText("Coba lagi nanti.")).not.toBeInTheDocument();
  });
});
