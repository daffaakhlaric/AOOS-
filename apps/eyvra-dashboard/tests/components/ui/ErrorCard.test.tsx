import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErrorCard } from "@/components/ui/ErrorCard";

describe("ErrorCard", () => {
  it("renders the provided error message", () => {
    render(<ErrorCard message="Gagal terhubung ke server." />);
    expect(screen.getByText("Gagal terhubung ke server.")).toBeInTheDocument();
  });

  it('has role="alert" for accessibility', () => {
    render(<ErrorCard message="Terjadi kesalahan" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
