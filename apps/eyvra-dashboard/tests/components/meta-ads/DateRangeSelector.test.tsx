import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DateRangeSelector } from "@/components/meta-ads/DateRangeSelector";

describe("DateRangeSelector", () => {
  it("calls onChange with the selected preset", async () => {
    const onChange = vi.fn();
    render(<DateRangeSelector value="last_7d" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Periode"), "last_30d");
    expect(onChange).toHaveBeenCalledWith("last_30d");
  });
});
