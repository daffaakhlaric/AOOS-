import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const setSession = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({ auth: { setSession } }),
}));

import { AuthCallbackClient } from "@/components/auth/AuthCallbackClient";

describe("AuthCallbackClient", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
  });

  it("parses access_token/refresh_token from the URL hash and calls setSession, then redirects to /dashboard", async () => {
    window.location.hash = "#access_token=at-1&refresh_token=rt-1&token_type=bearer";
    setSession.mockResolvedValue({ error: null });
    render(<AuthCallbackClient />);
    await waitFor(() =>
      expect(setSession).toHaveBeenCalledWith({ access_token: "at-1", refresh_token: "rt-1" }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows an error when the hash has no tokens", async () => {
    window.location.hash = "";
    render(<AuthCallbackClient />);
    await waitFor(() =>
      expect(
        screen.getByText("Link login tidak valid atau sudah kedaluwarsa."),
      ).toBeInTheDocument(),
    );
    expect(setSession).not.toHaveBeenCalled();
  });

  it("shows an error when setSession fails", async () => {
    window.location.hash = "#access_token=at-1&refresh_token=rt-1";
    setSession.mockResolvedValue({ error: { message: "Session expired" } });
    render(<AuthCallbackClient />);
    await waitFor(() => expect(screen.getByText("Session expired")).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });
});
