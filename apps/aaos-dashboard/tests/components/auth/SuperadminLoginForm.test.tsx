import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();
const signOut = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword, signOut } }),
}));

import { SuperadminLoginForm } from "@/components/auth/SuperadminLoginForm";

describe("SuperadminLoginForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders email/password inputs and a submit button", () => {
    render(<SuperadminLoginForm />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Masuk" })).toBeInTheDocument();
  });

  it("redirects to /superadmin when the signed-in user has role='superadmin'", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { user_metadata: { role: "superadmin" } } },
      error: null,
    });
    render(<SuperadminLoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "superadmin@aaos.id");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Masuk" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/superadmin"));
  });

  it("signs the user back out and shows an error when the account is not a superadmin", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { user_metadata: { role: "manager" } } },
      error: null,
    });
    render(<SuperadminLoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "manager@dssmotor.id");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Masuk" }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(screen.getByText("Akun ini bukan akun Super Admin.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows an error card when sign-in itself fails", async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid credentials" } });
    render(<SuperadminLoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "superadmin@aaos.id");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Masuk" }));
    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
  });
});
