import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { KnowledgeClient } from "@/components/knowledge/KnowledgeClient";

describe("KnowledgeClient", () => {
  it("renders the seeded documents", () => {
    render(<KnowledgeClient />);
    expect(screen.getByText(/SOP-Penjualan-v2\.xlsx/)).toBeInTheDocument();
    expect(screen.getByText(/FAQ-Kredit-Agustus\.xlsx/)).toBeInTheDocument();
  });

  it("adds a newly-uploaded file to the top of the list", async () => {
    render(<KnowledgeClient />);
    const input = screen.getByLabelText("Pilih file Excel") as HTMLInputElement;
    const file = new File(["x"], "New-Promo.xlsx", { type: "application/vnd.ms-excel" });
    await userEvent.upload(input, file);
    expect(screen.getByText(/New-Promo\.xlsx/)).toBeInTheDocument();
  });
});
