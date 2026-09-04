import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KnowledgeBaseList } from "@/components/knowledge/KnowledgeBaseList";

describe("KnowledgeBaseList", () => {
  it("renders each document with its item count and date", () => {
    render(
      <KnowledgeBaseList
        docs={[
          { name: "SOP-Penjualan-v2.xlsx", itemCount: 48, uploadedAt: "2026-08-01T00:00:00.000Z" },
        ]}
      />,
    );
    expect(screen.getByText(/SOP-Penjualan-v2\.xlsx/)).toBeInTheDocument();
    expect(screen.getByText(/48 items/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no documents", () => {
    render(<KnowledgeBaseList docs={[]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
});
