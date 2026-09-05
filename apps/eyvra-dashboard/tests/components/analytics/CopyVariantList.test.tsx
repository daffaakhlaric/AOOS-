import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CopyVariantList, type CopyVariant } from "@/components/analytics/CopyVariantList";

function buildVariant(overrides: Partial<CopyVariant> = {}): CopyVariant {
  return {
    id: "ad1",
    name: "#C001 · Xpander Creative 1",
    copyPreview: "Xpander Creative 1",
    metrics: [
      { label: "SPEND", value: 1_000_000, format: "idr" },
      { label: "LEAD", value: 12, format: "number" },
    ],
    rankValue: 50_000,
    rankDirection: "lowerIsBetter",
    ...overrides,
  };
}

describe("CopyVariantList", () => {
  it("renders an empty message when there are no variants", () => {
    render(<CopyVariantList variants={[]} />);
    expect(screen.getByText(/Belum ada variant copy/)).toBeInTheDocument();
  });

  it("marks exactly one variant as WINNING — the best by rankValue/rankDirection", () => {
    render(
      <CopyVariantList
        variants={[
          buildVariant({ id: "a", rankValue: 80_000 }),
          buildVariant({ id: "b", rankValue: 40_000 }),
          buildVariant({ id: "c", rankValue: 60_000 }),
        ]}
      />,
    );
    const badges = screen.getAllByTestId("winning-badge");
    expect(badges).toHaveLength(1);
    const list = screen.getByTestId("copy-variant-list");
    const rows = within(list).getAllByRole("button");
    expect(rows[1]).toHaveTextContent("WINNING");
  });

  it("expands a row on click to show the full copy text", async () => {
    const user = userEvent.setup();
    render(<CopyVariantList variants={[buildVariant({ copyPreview: "Full copy text here" })]} />);
    const row = screen.getByRole("button");
    expect(row).toHaveAttribute("aria-expanded", "false");
    await user.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Full copy text here")).toBeInTheDocument();
  });

  it("never fabricates CTR/ROAS — renders exactly the metrics the caller supplies", () => {
    render(
      <CopyVariantList
        variants={[
          buildVariant({
            metrics: [
              { label: "SPEND", value: 1_000_000, format: "idr" },
              { label: "LEAD", value: 12, format: "number" },
              { label: "CPL", value: 83_333, format: "idr" },
            ],
          }),
        ]}
      />,
    );
    expect(screen.getByText("SPEND")).toBeInTheDocument();
    expect(screen.getByText("LEAD")).toBeInTheDocument();
    expect(screen.getByText("CPL")).toBeInTheDocument();
    expect(screen.queryByText("CTR")).not.toBeInTheDocument();
    expect(screen.queryByText("ROAS")).not.toBeInTheDocument();
  });
});
