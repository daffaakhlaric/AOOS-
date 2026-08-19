import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn(async () => ({ data: { user: { email: "manager@dssmotor.id" } } }));
const signOut = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({ auth: { getUser, signOut } }),
}));

import { SettingsClient } from "@/components/settings/SettingsClient";

const SETTINGS_RESPONSE = {
  tenant: { tenantId: "dss-motor", name: "DSS Motor", vertical: "AUTOMOTIVE", status: "ACTIVE" },
  meta: { apiVersion: "v21.0", hasToken: true, usingEnvDefault: true, adAccountId: "act_1" },
};

function mockFetchSequence(responses: readonly Response[]): void {
  let call = 0;
  global.fetch = vi.fn(async () => {
    const response = responses[Math.min(call, responses.length - 1)]!;
    call += 1;
    return response;
  }) as unknown as typeof fetch;
}

describe("SettingsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads settings + waba configs and renders all 4 cards", async () => {
    mockFetchSequence([
      new Response(JSON.stringify(SETTINGS_RESPONSE), { status: 200 }),
      new Response(JSON.stringify({ wabaConfigs: [] }), { status: 200 }),
    ]);
    render(<SettingsClient />);
    await waitFor(() => expect(screen.getByText("Meta Ads Configuration")).toBeInTheDocument());
    expect(screen.getByText("WhatsApp Business (WABA)")).toBeInTheDocument();
    expect(screen.getByText("Tenant Info")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Belum ada WABA yang dikonfigurasi.")).toBeInTheDocument();
  });

  it("renders a WABA row and shows the real Test Koneksi result", async () => {
    const wabaListResponse = () =>
      new Response(
        JSON.stringify({
          wabaConfigs: [
            {
              id: "waba-1",
              branchId: "BINTARO",
              phoneNumber: "+628110000001",
              wabaId: "w-1",
              phoneNumberId: "p-1",
              maskedAccessToken: "tokxxxx",
              status: "ACTIVE",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        }),
        { status: 200 },
      );
    mockFetchSequence([
      new Response(JSON.stringify(SETTINGS_RESPONSE), { status: 200 }),
      wabaListResponse(),
      new Response(JSON.stringify({ success: true, message: "Terhubung — DSS Motor Bintaro" }), {
        status: 200,
      }),
      wabaListResponse(),
    ]);
    render(<SettingsClient />);
    await waitFor(() => expect(screen.getByText("BINTARO")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Test" }));
    await waitFor(() =>
      expect(screen.getByText("Terhubung — DSS Motor Bintaro")).toBeInTheDocument(),
    );
  });

  it("wires the Account card's Logout button to a real supabase.auth.signOut() call", async () => {
    mockFetchSequence([
      new Response(JSON.stringify(SETTINGS_RESPONSE), { status: 200 }),
      new Response(JSON.stringify({ wabaConfigs: [] }), { status: 200 }),
    ]);
    signOut.mockResolvedValue({ error: null });
    render(<SettingsClient />);
    await waitFor(() => expect(screen.getByText("Account")).toBeInTheDocument());
    const logoutButtons = screen.getAllByRole("button", { name: /Logout/ });
    await userEvent.click(logoutButtons[0]!);
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });
});
