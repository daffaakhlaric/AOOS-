import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecyclingClient } from "@/components/jessy/RecyclingClient";
import type { BroadcastLogDto, RecyclingPoolLeadDto, TemplateDto } from "@/types/dashboard.types";

const POOL_LEAD: RecyclingPoolLeadDto = {
  id: "lead-1",
  leadName: "Pak Hendra",
  leadPhone: "+6281234560006",
  branchId: "CINERE",
  status: "WARM",
  score: 45,
  temperature: "WARM",
  lastMessageAt: "2026-01-15T06:00:00.000Z",
  broadcastCount: 0,
  readyToSend: true,
};

const COLD_LEAD: RecyclingPoolLeadDto = {
  id: "lead-2",
  leadName: "Bu Ratna",
  leadPhone: "+6281234560007",
  branchId: "BINTARO",
  status: "COLD",
  score: 22,
  temperature: "COLD",
  broadcastCount: 1,
  readyToSend: false,
};

const TEMPLATE: TemplateDto = {
  id: "template-1",
  name: "Promo DP Ringan",
  content: "Halo {nama}!",
  targetStatuses: ["WARM", "COLD"],
  cooldownDays: 3,
  status: "ACTIVE",
  replyRate: 28,
  hotRate: 8,
  sentCount: 42,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const LOG: BroadcastLogDto = {
  id: "log-1",
  leadId: "lead-1",
  templateId: "template-1",
  messageSent: "Halo Pak Hendra!",
  status: "SENT",
  sentAt: new Date().toISOString(),
  replied: true,
  convertedToHot: false,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Routes every `fetch()` this component makes to its real proxy endpoint's fixture response. */
function mockFetchRouter(overrides: Partial<Record<string, () => Response>> = {}): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/recycling/pool")) {
      return overrides["pool"]?.() ?? jsonResponse({ leads: [POOL_LEAD, COLD_LEAD] });
    }
    if (url.startsWith("/api/recycling/templates")) {
      return overrides["templates"]?.() ?? jsonResponse({ templates: [TEMPLATE] });
    }
    if (url.startsWith("/api/recycling/logs")) {
      return overrides["logs"]?.() ?? jsonResponse({ logs: [LOG] });
    }
    if (url.startsWith("/api/recycling/auto-mode")) {
      return overrides["autoMode"]?.() ?? jsonResponse({ autoMode: true });
    }
    if (url.startsWith("/api/recycling/broadcast-all")) {
      return (
        overrides["broadcastAll"]?.() ?? jsonResponse({ attempted: 1, sent: [{}], failed: [] })
      );
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe("RecyclingClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the 5-cell KPI strip with real values derived from the pool + logs", async () => {
    mockFetchRouter();
    render(<RecyclingClient />);
    await waitFor(() => expect(screen.getByTestId("recycling-kpi-strip")).toBeInTheDocument());

    const strip = screen.getByTestId("recycling-kpi-strip");
    expect(within(strip).getByText("RECYCLING POOL")).toBeInTheDocument();
    expect(within(strip).getByText("2")).toBeInTheDocument(); // pool size
    expect(within(strip).getByText("WARM (3hr)")).toBeInTheDocument();
    expect(within(strip).getByText("COLD (7hr)")).toBeInTheDocument();
    expect(within(strip).getByText("BERHASIL HOT")).toBeInTheDocument();
    expect(within(strip).getByText("BROADCAST HARI INI")).toBeInTheDocument();
  });

  it("Recycling Pool tab shows both leads, with Kirim ▶ only for the ready one", async () => {
    mockFetchRouter();
    render(<RecyclingClient />);
    await waitFor(() => expect(screen.getByTestId("recycling-pool-table")).toBeInTheDocument());

    const rows = screen.getAllByTestId("recycling-pool-row");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Pak Hendra", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kirim ▶" })).toBeInTheDocument();
    expect(screen.getByText("Cooldown")).toBeInTheDocument(); // COLD_LEAD, not ready
  });

  it("opens BroadcastToLeadModal from a pool row's Kirim ▶ button", async () => {
    mockFetchRouter();
    render(<RecyclingClient />);
    await waitFor(() => expect(screen.getByTestId("recycling-pool-table")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Kirim ▶" }));
    expect(screen.getByRole("dialog", { name: "Broadcast ke lead" })).toBeInTheDocument();
  });

  it("Broadcast ke Semua yang Siap sends and shows the real result summary", async () => {
    mockFetchRouter();
    render(<RecyclingClient />);
    await waitFor(() => expect(screen.getByTestId("recycling-pool-table")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Broadcast ke Semua yang Siap/ }));
    expect(await screen.findByText("1/1 broadcast terkirim")).toBeInTheDocument();
  });

  it("switches to Template Broadcast tab and shows real template cards", async () => {
    mockFetchRouter();
    render(<RecyclingClient />);
    await waitFor(() => expect(screen.getByTestId("recycling-pool-table")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("tab", { name: "Template Broadcast" }));
    expect(await screen.findByTestId("template-grid")).toBeInTheDocument();
    expect(screen.getByText("🏷 Promo DP Ringan")).toBeInTheDocument();
    expect(screen.getByText(/Terkirim: 42 kali/)).toBeInTheDocument();
  });

  it("opens the create-template modal from '+ Buat Template Baru'", async () => {
    mockFetchRouter();
    render(<RecyclingClient />);
    await userEvent.click(screen.getByRole("tab", { name: "Template Broadcast" }));
    await waitFor(() => expect(screen.getByTestId("template-grid")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "+ Buat Template Baru" }));
    expect(screen.getByRole("dialog", { name: "Template Broadcast" })).toBeInTheDocument();
  });

  it("switches to Riwayat Broadcast tab and shows the honest (never fabricated) Hasil column", async () => {
    mockFetchRouter();
    render(<RecyclingClient />);
    await waitFor(() => expect(screen.getByTestId("recycling-pool-table")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("tab", { name: "Riwayat Broadcast" }));
    expect(await screen.findByTestId("recycling-history-table")).toBeInTheDocument();
    // LOG.replied = true, LOG.convertedToHot = false — honest copy, never a fabricated "🔥HOT".
    expect(screen.getByText("Dibalas — lanjutkan manual")).toBeInTheDocument();
  });

  it("toggles Auto Mode via the real /api/recycling/auto-mode endpoint", async () => {
    mockFetchRouter();
    render(<RecyclingClient />);
    await waitFor(() => expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true"));

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/recycling/auto-mode" && init?.method === "POST") {
        expect(JSON.parse(init.body as string)).toEqual({ autoMode: false });
        return jsonResponse({ autoMode: false });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    await userEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false"),
    );
    expect(screen.getByText("Auto Mode: OFF ○")).toBeInTheDocument();
  });

  it("shows an error card when the pool fetch fails", async () => {
    mockFetchRouter({ pool: () => jsonResponse({}, 500) });
    render(<RecyclingClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
