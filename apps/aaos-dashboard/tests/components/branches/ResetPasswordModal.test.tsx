import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordModal } from "@/components/branches/ResetPasswordModal";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("ResetPasswordModal", () => {
  afterEach(() => vi.restoreAllMocks());

  it("validates the minimum password length before submitting", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    render(
      <ResetPasswordModal
        salesHumanId="sales-1"
        salesHumanName="Budi"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByLabelText("New password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Reset Password" }));
    expect(screen.getByText(/minimal 8 karakter/)).toBeInTheDocument();
  });

  it("POSTs the new password and calls onSaved", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ salesHuman: {} }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSaved = vi.fn();

    render(
      <ResetPasswordModal
        salesHumanId="sales-1"
        salesHumanName="Budi"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await userEvent.type(screen.getByLabelText("New password"), "newpassword123");
    await userEvent.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sales-humans/sales-1/reset-password",
      expect.objectContaining({ method: "POST" }),
    );
    expect(onSaved).toHaveBeenCalled();
  });
});
