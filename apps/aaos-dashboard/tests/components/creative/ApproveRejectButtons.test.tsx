import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApproveRejectButtons } from "@/components/creative/ApproveRejectButtons";

describe("ApproveRejectButtons", () => {
  it("calls onApprove when the approve button is clicked", async () => {
    const onApprove = vi.fn();
    render(<ApproveRejectButtons onApprove={onApprove} onReject={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Approve/ }));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("calls onReject when the reject button is clicked", async () => {
    const onReject = vi.fn();
    render(<ApproveRejectButtons onApprove={vi.fn()} onReject={onReject} />);
    await userEvent.click(screen.getByRole("button", { name: /Reject/ }));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it("disables both buttons when disabled is true", () => {
    render(<ApproveRejectButtons onApprove={vi.fn()} onReject={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: /Approve/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Reject/ })).toBeDisabled();
  });
});
