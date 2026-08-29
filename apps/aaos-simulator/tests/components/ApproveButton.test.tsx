import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApproveButton } from "@/components/simulator/ApproveButton";

describe("ApproveButton", () => {
  it("renders the default label when not approved", () => {
    render(<ApproveButton approved={false} onApprove={vi.fn()} />);
    expect(screen.getByTestId("approve-button")).toHaveTextContent("Approve Clara");
  });

  it("calls onApprove when clicked — a purely local, in-session UI action (no network call)", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(<ApproveButton approved={false} onApprove={onApprove} />);
    await user.click(screen.getByTestId("approve-button"));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("shows a confirmation message once approved", () => {
    render(<ApproveButton approved onApprove={vi.fn()} />);
    expect(screen.getByTestId("approve-confirmation")).toBeInTheDocument();
    expect(screen.getByTestId("approve-button")).toHaveTextContent("Disetujui");
  });

  it("is disabled once approved (no double-approve)", () => {
    render(<ApproveButton approved onApprove={vi.fn()} />);
    expect(screen.getByTestId("approve-button")).toBeDisabled();
  });

  it("is disabled when disabled=true is passed explicitly", () => {
    render(<ApproveButton approved={false} onApprove={vi.fn()} disabled />);
    expect(screen.getByTestId("approve-button")).toBeDisabled();
  });

  it("supports a custom label (report page's 'Approve Clara untuk Deploy')", () => {
    render(
      <ApproveButton approved={false} onApprove={vi.fn()} label="Approve Clara untuk Deploy" />,
    );
    expect(screen.getByTestId("approve-button")).toHaveTextContent("Approve Clara untuk Deploy");
  });
});
