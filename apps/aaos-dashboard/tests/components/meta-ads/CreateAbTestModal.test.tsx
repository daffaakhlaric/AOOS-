import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateAbTestModal } from "@/components/meta-ads/CreateAbTestModal";

const STOCK_RESPONSE = {
  units: [
    { unitId: "xpander-cinere-001", model: "Xpander", year: 2023, branch: "CINERE", photoCount: 5 },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetchRouter(
  overrides: Partial<Record<string, () => Response>> = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/scraper/stock")) {
      return overrides["stock"]?.() ?? jsonResponse(STOCK_RESPONSE);
    }
    if (url === "/api/abtesting" && init?.method === "POST") {
      return overrides["create"]?.() ?? jsonResponse({ id: "test-1", status: "DRAFT" }, 201);
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("CreateAbTestModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads real scraped stock units into the unit picker", async () => {
    mockFetchRouter();
    render(<CreateAbTestModal onClose={vi.fn()} onCreated={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("Xpander 2023 · CINERE", { exact: false })).toBeInTheDocument(),
    );
  });

  it("requires name/campaignId/adSetId/pageId/waLink/primaryMessage before submitting", async () => {
    const fetchMock = mockFetchRouter();
    render(<CreateAbTestModal onClose={vi.fn()} onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Xpander", { exact: false })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "🔬 Mulai A/B Test" }));
    expect(await screen.findByText("Nama test wajib diisi.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the stock fetch, never the create POST
  });

  it("submits a real POST /api/abtesting with Mode Auto and the selected variant count", async () => {
    const fetchMock = mockFetchRouter();
    const onCreated = vi.fn();
    render(<CreateAbTestModal onClose={vi.fn()} onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByText("Xpander", { exact: false })).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText("Nama Test *"), "Xpander Cinere — DP vs Stok");
    await userEvent.type(screen.getByLabelText("Campaign ID (Meta) *"), "camp-1");
    await userEvent.type(screen.getByLabelText("Ad Set ID (Meta) *"), "adset-1");
    await userEvent.type(screen.getByLabelText("Page ID (Facebook) *"), "page-1");
    await userEvent.type(screen.getByLabelText(/Link WhatsApp/), "https://wa.me/6281234567890");
    await userEvent.click(screen.getByRole("button", { name: "3 variasi" }));
    await userEvent.type(
      screen.getByLabelText("Pesan Utama *"),
      "DP mulai 29 juta, cicilan 5 jutaan",
    );
    await userEvent.click(screen.getByRole("button", { name: "🔬 Mulai A/B Test" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const createCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    );
    expect(createCall).toBeDefined();
    const [, init] = createCall as [unknown, RequestInit];
    const body = JSON.parse(init.body as string) as {
      name: string;
      mode: string;
      variantCount: number;
      unit: string;
    };
    expect(body.name).toBe("Xpander Cinere — DP vs Stok");
    expect(body.mode).toBe("AUTO");
    expect(body.variantCount).toBe(3);
    expect(body.unit).toBe("xpander-cinere-001");
  });

  it("closes on the ✕ button without submitting", async () => {
    mockFetchRouter();
    const onClose = vi.fn();
    render(<CreateAbTestModal onClose={onClose} onCreated={vi.fn()} />);
    await userEvent.click(screen.getByLabelText("Tutup"));
    expect(onClose).toHaveBeenCalled();
  });
});
