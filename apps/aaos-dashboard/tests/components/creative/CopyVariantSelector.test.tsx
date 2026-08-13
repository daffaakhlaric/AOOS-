import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CopyVariantSelector } from "@/components/creative/CopyVariantSelector";

const VARIANTS = [
  {
    id: "v-a",
    variantLabel: "A" as const,
    primaryText: "Text A",
    headline: "H",
    callToAction: "CTA",
  },
  {
    id: "v-b",
    variantLabel: "B" as const,
    primaryText: "Text B",
    headline: "H",
    callToAction: "CTA",
  },
  {
    id: "v-c",
    variantLabel: "C" as const,
    primaryText: "Text C",
    headline: "H",
    callToAction: "CTA",
  },
];

describe("CopyVariantSelector", () => {
  it("renders all 3 variants", () => {
    render(<CopyVariantSelector variants={VARIANTS} selectedId="v-a" onSelect={vi.fn()} />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("marks the selected variant's radio as checked", () => {
    render(<CopyVariantSelector variants={VARIANTS} selectedId="v-b" onSelect={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios[1]).toBeChecked();
  });

  it("calls onSelect when a different variant is clicked", async () => {
    const onSelect = vi.fn();
    render(<CopyVariantSelector variants={VARIANTS} selectedId="v-a" onSelect={onSelect} />);
    await userEvent.click(screen.getAllByRole("radio")[2] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith("v-c");
  });
});
