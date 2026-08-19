import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const useSalesSession = vi.fn();
vi.mock("@/lib/session", () => ({ useSalesSession: () => useSalesSession() }));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/inbox",
  useRouter: () => ({ push }),
}));

const signOut = vi.fn();
vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signOut } }),
}));

import { CrmSidebar } from "@/components/layout/CrmSidebar";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("CrmSidebar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the real profile name + branch once loaded", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sh-1", branchId: "BINTARO", email: "budi@mobix.id" },
      loading: false,
    });
    global.fetch = vi.fn(async () =>
      jsonResponse({
        id: "sh-1",
        name: "Budi Santoso",
        email: "budi@mobix.id",
        phone: "1",
        branchId: "BINTARO",
        status: "ON",
        maxLeadsPerDay: 10,
        createdAt: "2026-01-01T00:00:00.000Z",
        lastSignInAt: undefined,
      }),
    ) as unknown as typeof fetch;

    render(<CrmSidebar />);
    await waitFor(() => expect(screen.getByText("Budi Santoso")).toBeInTheDocument());
    expect(screen.getByText(/BINTARO/)).toBeInTheDocument();
  });

  it("renders all real nav items and marks the current route active", () => {
    useSalesSession.mockReturnValue({ session: undefined, loading: true });
    global.fetch = vi.fn() as unknown as typeof fetch;
    render(<CrmSidebar />);
    expect(screen.getByText("Inbox").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("Keluar calls supabase.auth.signOut and redirects to /login", async () => {
    useSalesSession.mockReturnValue({ session: undefined, loading: true });
    global.fetch = vi.fn() as unknown as typeof fetch;
    signOut.mockResolvedValue({ error: null });

    render(<CrmSidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Keluar" }));
    expect(signOut).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/login");
  });
});
