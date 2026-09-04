import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn(async () => ({ data: { user: { email: "manager@dssmotor.id" } } }));
const signOut = vi.fn();
const replace = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({ auth: { getUser, signOut } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

import { SettingsHubClient } from "@/components/settings/SettingsHubClient";

const SETTINGS_RESPONSE = {
  tenant: {
    tenantId: "dss-motor",
    name: "DSS Motor",
    vertical: "AUTOMOTIVE",
    status: "ACTIVE",
    mode: "LIVE",
    operatingMode: "FULL_CONTROL",
  },
  meta: { apiVersion: "v21.0", hasToken: true, usingEnvDefault: true, adAccountId: "act_1" },
};

function mockFetch(): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/api/settings/waba")) {
      return new Response(JSON.stringify({ wabaConfigs: [] }), { status: 200 });
    }
    if (url.includes("/api/competitors")) {
      return new Response(JSON.stringify({ competitors: [] }), { status: 200 });
    }
    if (url.endsWith("/api/settings")) {
      return new Response(JSON.stringify(SETTINGS_RESPONSE), { status: 200 });
    }
    if (url.endsWith("/api/objective")) {
      return new Response(JSON.stringify({ objective: null }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
}

describe("SettingsHubClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the real Objective tab (real ObjectiveClient, target hot leads form)", async () => {
    mockFetch();
    render(<SettingsHubClient />);
    await waitFor(() => expect(screen.getByText("🎯 Objective Bulan Ini")).toBeInTheDocument());
    expect(screen.getByLabelText(/Target Hot Leads/)).toBeInTheDocument();
  });

  it("Jadwal tab honestly reports no real backing instead of fabricating a schedule UI", async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<SettingsHubClient />);
    await waitFor(() => expect(screen.getByText("🎯 Objective Bulan Ini")).toBeInTheDocument());
    await user.click(screen.getByRole("tab", { name: "Jadwal" }));
    expect(screen.getByText("Jadwal Loop")).toBeInTheDocument();
    expect(screen.getByText(/Belum tersedia/)).toBeInTheDocument();
  });

  it("Lokasi tab honestly points to the real areaPriorities mechanism inside Objective", async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<SettingsHubClient />);
    await waitFor(() => expect(screen.getByText("🎯 Objective Bulan Ini")).toBeInTheDocument());
    await user.click(screen.getByRole("tab", { name: "Lokasi" }));
    expect(screen.getByText(/Area Prioritas/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Buka tab Objective →" }));
    expect(screen.getByText("🎯 Objective Bulan Ini")).toBeInTheDocument();
  });

  it("Koneksi tab renders the real, embedded SettingsClient (Meta Ads + WABA cards, no duplicate TopBar)", async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<SettingsHubClient />);
    await waitFor(() => expect(screen.getByText("🎯 Objective Bulan Ini")).toBeInTheDocument());
    await user.click(screen.getByRole("tab", { name: "Koneksi" }));
    await waitFor(() => expect(screen.getByText("Meta Ads Configuration")).toBeInTheDocument());
    expect(screen.getByText("WhatsApp Business (WABA)")).toBeInTheDocument();
    expect(screen.getByText("Mode Operasi")).toBeInTheDocument();
    // Only ONE TopBar title ("Settings", owned by the hub) — the embedded SettingsClient must not
    // render its own second one.
    expect(screen.getAllByText("Settings")).toHaveLength(1);
  });

  it("Agen tab lists the 4 real agents with disabled toggles (no real per-agent toggle backing) and Clara always active", async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<SettingsHubClient />);
    await waitFor(() => expect(screen.getByText("🎯 Objective Bulan Ini")).toBeInTheDocument());
    await user.click(screen.getByRole("tab", { name: "Agen" }));

    expect(screen.getByTestId("agent-card-SAMANTHA")).toBeInTheDocument();
    expect(screen.getByTestId("agent-card-KAI")).toBeInTheDocument();
    expect(screen.getByTestId("agent-card-CLARA")).toBeInTheDocument();
    expect(screen.getByTestId("agent-card-KAREN")).toBeInTheDocument();

    const claraToggle = screen
      .getByTestId("agent-card-CLARA")
      .querySelector("input[type=checkbox]");
    expect(claraToggle).toBeDisabled();
    expect(
      screen.getByRole("link", { name: /Buka AI Improve untuk config detail/ }),
    ).toHaveAttribute("href", "/self-improve");
  });

  it("?tab= deep-links directly to a non-default tab (e.g. koneksi)", async () => {
    mockFetch();
    render(<SettingsHubClient initialTab="koneksi" />);
    await waitFor(() => expect(screen.getByText("Meta Ads Configuration")).toBeInTheDocument());
  });
});
