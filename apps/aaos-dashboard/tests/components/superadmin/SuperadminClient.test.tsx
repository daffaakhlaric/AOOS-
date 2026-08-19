import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const signOut = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signOut, getUser: vi.fn(async () => ({ data: { user: undefined } })) },
  }),
}));

import { SuperadminClient } from "@/components/superadmin/SuperadminClient";

const LIST_RESPONSE = {
  kpi: { totalTenants: 1, activeTenants: 1, trialTenants: 0, suspendedTenants: 0 },
  tenants: [
    {
      id: "t-1",
      tenantId: "dss-motor",
      name: "DSS Motor (Mobix)",
      vertical: "AUTOMOTIVE",
      status: "ACTIVE",
      hasMetaToken: true,
      wabaCount: 4,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

describe("SuperadminClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads and renders the KPI strip + tenant cards", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify(LIST_RESPONSE), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<SuperadminClient />);
    await waitFor(() => expect(screen.getByText("DSS Motor (Mobix)")).toBeInTheDocument());
    expect(screen.getByText("⚡ AAOS Super Admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Login as Tenant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suspend" })).toBeInTheDocument();
  });

  it("opens the Buat Tenant Baru modal", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify(LIST_RESPONSE), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<SuperadminClient />);
    await waitFor(() => expect(screen.getByText("DSS Motor (Mobix)")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "+ Buat Tenant Baru" }));
    expect(screen.getByRole("dialog", { name: "Buat Tenant Baru" })).toBeInTheDocument();
  });

  it("shows an error card when the initial load fails", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "Forbidden" } }), { status: 403 }),
    ) as unknown as typeof fetch;
    render(<SuperadminClient />);
    await waitFor(() => expect(screen.getByText("Forbidden")).toBeInTheDocument());
  });
});
