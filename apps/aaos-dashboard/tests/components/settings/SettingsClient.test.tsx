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

  it("loads settings + waba configs + competitor pages and renders all 5 cards", async () => {
    mockFetchSequence([
      new Response(JSON.stringify(SETTINGS_RESPONSE), { status: 200 }),
      new Response(JSON.stringify({ wabaConfigs: [] }), { status: 200 }),
      new Response(JSON.stringify({ competitors: [] }), { status: 200 }),
    ]);
    render(<SettingsClient />);
    await waitFor(() => expect(screen.getByText("Meta Ads Configuration")).toBeInTheDocument());
    expect(screen.getByText("WhatsApp Business (WABA)")).toBeInTheDocument();
    expect(screen.getByText("Competitor Pages (Tamara Intelligence)")).toBeInTheDocument();
    expect(screen.getByText("Tenant Info")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Belum ada WABA yang dikonfigurasi.")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText("Belum ada halaman kompetitor yang ditambahkan."),
      ).toBeInTheDocument(),
    );
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
      new Response(JSON.stringify({ competitors: [] }), { status: 200 }),
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

  it("adds a competitor page via POST /api/competitors and reloads the list", async () => {
    let competitors: readonly Record<string, unknown>[] = [];
    global.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/settings/waba")) {
        return new Response(JSON.stringify({ wabaConfigs: [] }), { status: 200 });
      }
      if (url.endsWith("/api/settings")) {
        return new Response(JSON.stringify(SETTINGS_RESPONSE), { status: 200 });
      }
      if (url.endsWith("/api/competitors") && init?.method === "POST") {
        const parsed = JSON.parse(init.body as string) as Record<string, unknown>;
        competitors = [
          {
            id: "c-1",
            name: parsed["name"],
            pageId: parsed["pageId"],
            vertical: parsed["vertical"],
            active: true,
            createdAt: "2026-08-24T00:00:00.000Z",
          },
        ];
        return new Response(JSON.stringify(competitors[0]), { status: 201 });
      }
      if (url.endsWith("/api/competitors")) {
        return new Response(JSON.stringify({ competitors }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    render(<SettingsClient />);
    await waitFor(() =>
      expect(
        screen.getByText("Belum ada halaman kompetitor yang ditambahkan."),
      ).toBeInTheDocument(),
    );

    await userEvent.type(screen.getByLabelText("Nama Kompetitor"), "Suzuki Bintaro");
    await userEvent.type(screen.getByLabelText("Meta Page ID"), "1234567890");
    await userEvent.click(screen.getByRole("button", { name: "+ Tambah Kompetitor" }));

    await waitFor(() => expect(screen.getByText("Suzuki Bintaro")).toBeInTheDocument());
    expect(screen.getByText("1234567890")).toBeInTheDocument();
  });

  it("deletes a competitor page via DELETE /api/competitors/:id and reloads the list", async () => {
    let deleted = false;
    global.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/settings/waba")) {
        return new Response(JSON.stringify({ wabaConfigs: [] }), { status: 200 });
      }
      if (url.endsWith("/api/settings")) {
        return new Response(JSON.stringify(SETTINGS_RESPONSE), { status: 200 });
      }
      if (url.includes("/api/competitors/c-1") && init?.method === "DELETE") {
        deleted = true;
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/api/competitors")) {
        const competitors = deleted
          ? []
          : [
              {
                id: "c-1",
                name: "Suzuki Bintaro",
                pageId: "1234567890",
                vertical: "AUTOMOTIVE",
                active: true,
                createdAt: "2026-08-24T00:00:00.000Z",
              },
            ];
        return new Response(JSON.stringify({ competitors }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    render(<SettingsClient />);
    await waitFor(() => expect(screen.getByText("Suzuki Bintaro")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Hapus" }));

    await waitFor(() =>
      expect(
        screen.getByText("Belum ada halaman kompetitor yang ditambahkan."),
      ).toBeInTheDocument(),
    );
  });

  it("wires the Account card's Logout button to a real supabase.auth.signOut() call", async () => {
    mockFetchSequence([
      new Response(JSON.stringify(SETTINGS_RESPONSE), { status: 200 }),
      new Response(JSON.stringify({ wabaConfigs: [] }), { status: 200 }),
      new Response(JSON.stringify({ competitors: [] }), { status: 200 }),
    ]);
    signOut.mockResolvedValue({ error: null });
    render(<SettingsClient />);
    await waitFor(() => expect(screen.getByText("Account")).toBeInTheDocument());
    const logoutButtons = screen.getAllByRole("button", { name: /Logout/ });
    await userEvent.click(logoutButtons[0]!);
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });
});
