import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TopBar } from "@/components/layout/TopBar";

describe("TopBar", () => {
  it("renders the page title", () => {
    render(<TopBar title="Overview" />);
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
  });

  it("renders the user email when provided", () => {
    render(<TopBar title="Overview" userEmail="manager@dssmotor.id" />);
    expect(screen.getByText("manager@dssmotor.id")).toBeInTheDocument();
  });

  it("calls onSignOut when the sign-out button is clicked", async () => {
    const onSignOut = vi.fn();
    render(<TopBar title="Overview" onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole("button", { name: "Keluar" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("omits the sign-out button when onSignOut is not provided", () => {
    render(<TopBar title="Overview" />);
    expect(screen.queryByRole("button", { name: "Keluar" })).not.toBeInTheDocument();
  });
});
