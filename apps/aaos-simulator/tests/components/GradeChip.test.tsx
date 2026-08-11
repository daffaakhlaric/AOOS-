import { Grade } from "@aos/ai-judge";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GradeChip } from "@/components/ui/GradeChip";

describe("GradeChip", () => {
  it.each([
    [Grade.A, "A"],
    [Grade.B_PLUS, "B+"],
    [Grade.B, "B"],
    [Grade.C, "C"],
    [Grade.F, "F"],
  ])("renders the %s grade as text %s", (grade, expected) => {
    render(<GradeChip grade={grade} />);
    expect(screen.getByTestId("grade-chip")).toHaveTextContent(expected);
  });

  it("uses a success color class for grade A", () => {
    render(<GradeChip grade={Grade.A} />);
    expect(screen.getByTestId("grade-chip").className).toContain("text-brand-success");
  });

  it("uses a danger color class for grade F", () => {
    render(<GradeChip grade={Grade.F} />);
    expect(screen.getByTestId("grade-chip").className).toContain("text-brand-danger");
  });
});
