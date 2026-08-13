import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AssignmentModeSelector } from "@/components/branches/AssignmentModeSelector";

describe("AssignmentModeSelector", () => {
  it("marks the current mode as checked", () => {
    render(<AssignmentModeSelector value="ROUND_ROBIN" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Round Robin")).toBeChecked();
  });

  it("calls onChange when a different mode is selected", async () => {
    const onChange = vi.fn();
    render(<AssignmentModeSelector value="SMART_ASSIGN" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Manual"));
    expect(onChange).toHaveBeenCalledWith("MANUAL");
  });
});
