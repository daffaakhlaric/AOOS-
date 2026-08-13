import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdAccountSelector } from "@/components/meta-ads/AdAccountSelector";

describe("AdAccountSelector", () => {
  it("renders every option", () => {
    render(
      <AdAccountSelector
        value="act_1"
        options={[
          { id: "act_1", name: "Mobix Main" },
          { id: "act_2", name: "Mobix Boost" },
        ]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Mobix Main")).toBeInTheDocument();
    expect(screen.getByText("Mobix Boost")).toBeInTheDocument();
  });

  it("calls onChange with the selected ad account id", async () => {
    const onChange = vi.fn();
    render(
      <AdAccountSelector
        value="act_1"
        options={[
          { id: "act_1", name: "Mobix Main" },
          { id: "act_2", name: "Mobix Boost" },
        ]}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Ad Account"), "act_2");
    expect(onChange).toHaveBeenCalledWith("act_2");
  });
});
