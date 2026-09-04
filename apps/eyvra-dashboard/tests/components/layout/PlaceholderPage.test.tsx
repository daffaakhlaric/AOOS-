import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

describe("PlaceholderPage", () => {
  it("renders the given title and description", () => {
    render(<PlaceholderPage title="Campaign" description="Kelola campaign di sini." />);
    expect(screen.getByText("Campaign")).toBeInTheDocument();
    expect(screen.getByText("Kelola campaign di sini.")).toBeInTheDocument();
  });
});
