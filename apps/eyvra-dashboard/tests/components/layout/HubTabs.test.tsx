import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

import { HubTabs } from "@/components/layout/HubTabs";

const TABS = [
  { key: "aktif", label: "Aktif" },
  { key: "verdict", label: "Verdict" },
];

describe("HubTabs (EYVRA MENU RESTRUCTURE Sprint 2 shared hub tab bar)", () => {
  it("renders every tab label and marks the active one selected", () => {
    render(
      <HubTabs
        tabs={TABS}
        activeKey="aktif"
        basePath="/campaigns"
        defaultKey="aktif"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("hub-tab-aktif")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("hub-tab-verdict")).toHaveAttribute("aria-selected", "false");
  });

  it("clicking a non-default tab calls onChange and replaces the URL with ?tab=", async () => {
    const onChange = vi.fn();
    render(
      <HubTabs
        tabs={TABS}
        activeKey="aktif"
        basePath="/campaigns"
        defaultKey="aktif"
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByTestId("hub-tab-verdict"));
    expect(onChange).toHaveBeenCalledWith("verdict");
    expect(replace).toHaveBeenCalledWith("/campaigns?tab=verdict", { scroll: false });
  });

  it("clicking the default tab replaces the URL with the bare base path (no query)", async () => {
    const onChange = vi.fn();
    render(
      <HubTabs
        tabs={TABS}
        activeKey="verdict"
        basePath="/campaigns"
        defaultKey="aktif"
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByTestId("hub-tab-aktif"));
    expect(onChange).toHaveBeenCalledWith("aktif");
    expect(replace).toHaveBeenCalledWith("/campaigns", { scroll: false });
  });
});
