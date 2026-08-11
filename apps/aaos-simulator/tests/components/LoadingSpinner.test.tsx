import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders a default label", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText("Memuat...")).toBeInTheDocument();
  });

  it("renders a custom label", () => {
    render(<LoadingSpinner label="Menjalankan 10 skenario..." />);
    expect(screen.getByText("Menjalankan 10 skenario...")).toBeInTheDocument();
  });

  it('has role="status" for accessibility', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
