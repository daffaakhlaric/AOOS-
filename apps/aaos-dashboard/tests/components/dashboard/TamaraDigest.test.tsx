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

  it("renders PAUSE/SCALE/FIX tag pills when given", () => {
    render(
      <TamaraDigest
        text="Ringkasan hari ini."
        tags={[
          { label: "3 perlu PAUSE", tone: "pause" },
          { label: "1 perlu SCALE", tone: "scale" },
          { label: "8 perlu FIX", tone: "fix" },
        ]}
      />,
    );
    expect(screen.getByText(/3 perlu PAUSE/)).toBeInTheDocument();
    expect(screen.getByText(/1 perlu SCALE/)).toBeInTheDocument();
    expect(screen.getByText(/8 perlu FIX/)).toBeInTheDocument();
  });

  it("renders a link to Strategi & Approve when strategiHref is given", () => {
    render(<TamaraDigest text="Ringkasan hari ini." strategiHref="/meta-ads/strategi" />);
    const link = screen.getByRole("link", { name: /Strategi & Approve/ });
    expect(link).toHaveAttribute("href", "/meta-ads/strategi");
  });

  it("omits the tags/link footer entirely when neither is given", () => {
    render(<TamaraDigest text="Ringkasan hari ini." />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
