import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword } }),
}));

import { LoginForm } from "@/components/auth/LoginForm";

describe("LoginForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders email/password inputs and a submit button", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Masuk" })).toBeInTheDocument();
  });

  it("redirects to /inbox on successful sign-in", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "rina@dssmotor.id");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Masuk" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/inbox"));
  });

  it("shows an error card when sign-in fails", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid credentials" } });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "rina@dssmotor.id");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Masuk" }));
    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });
});
