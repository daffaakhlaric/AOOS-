import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QualificationBadges } from "@/components/leads/QualificationBadges";

describe("QualificationBadges", () => {
  it("renders a checkmark for each satisfied criterion", () => {
    render(
      <QualificationBadges
        qualification={{
          budget: true,
          unit: true,
          area: false,
          payment: false,
          timeline: true,
          name: true,
        }}
      />,
    );
    const list = screen.getByTestId("qualification-badges");
    expect(list).toHaveTextContent("Budget");
    expect(list).toHaveTextContent("Area");
  });

  it("renders all 6 criteria", () => {
    render(
      <QualificationBadges
        qualification={{
          budget: true,
          unit: true,
          area: true,
          payment: true,
          timeline: true,
          name: true,
        }}
      />,
    );
    expect(screen.getByTestId("qualification-badges").children).toHaveLength(6);
  });
});
