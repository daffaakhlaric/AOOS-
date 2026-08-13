import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TamaraDigest } from "@/components/dashboard/TamaraDigest";

describe("TamaraDigest", () => {
  it("renders the digest text", () => {
    render(<TamaraDigest text="Hari ini semua lancar." />);
    expect(screen.getByText("Hari ini semua lancar.")).toBeInTheDocument();
  });

  it('truncates long text with "Lihat selengkapnya"', () => {
    const longText = "A".repeat(120);
    render(<TamaraDigest text={longText} />);
    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lihat selengkapnya" })).toBeInTheDocument();
  });

  it("expands to the full text when the button is clicked", async () => {
    const longText = "B".repeat(120);
    render(<TamaraDigest text={longText} />);
    await userEvent.click(screen.getByRole("button", { name: "Lihat selengkapnya" }));
    expect(screen.getByText(longText)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sembunyikan" })).toBeInTheDocument();
  });

  it("does not show the expand button for short text", () => {
    render(<TamaraDigest text="Singkat." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
