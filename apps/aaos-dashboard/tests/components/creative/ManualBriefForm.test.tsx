import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ManualBriefForm } from "@/components/creative/ManualBriefForm";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const UNIT = {
  unitId: "xpander-gls-2022-001",
  url: "https://mobixbydss.id/produk/xpander",
  brand: "Mitsubishi",
  model: "Xpander GLS",
  year: 2022,
  transmission: "AT" as const,
  color: "Silver",
  kilometer: 45000,
  priceIdr: 195_000_000,
  branch: "CINERE",
  photos: ["https://mobix/1.jpg"],
  photoCount: 8,
  available: true,
  scrapedAt: "2026-08-18T00:00:00.000Z",
};

function mockFetch(overrides: { readonly assets?: readonly { publicUrl: string }[] } = {}) {
  return vi.fn(async (input: string | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/scraper/stock")) {
      return jsonResponse({ units: [UNIT], total: 1, page: 1, limit: 200 });
    }
    if (url.includes("/api/assets")) {
      return jsonResponse({ assets: overrides.assets ?? [], total: 0, page: 1, limit: 12 });
    }
    return jsonResponse({ package: { id: "pkg-1", title: "T", status: "DRAFT" } }, 200);
  });
}

describe("ManualBriefForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers only the REAL 7 AdAngle members — never the spec's invented PROMO", async () => {
    global.fetch = mockFetch() as unknown as typeof fetch;
    render(<ManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "DP_RINGAN" })).toBeInTheDocument(),
    );
    for (const angle of [
      "DP_RINGAN",
      "KREDIT_SYARIAH",
      "GUDANGNYA",
      "QNA",
      "DISCOVERY",
      "TESTIMONIAL",
      "WEBSITE_REDIRECT",
    ]) {
      expect(screen.getByRole("option", { name: angle })).toBeInTheDocument();
    }
    expect(screen.queryByRole("option", { name: "PROMO" })).not.toBeInTheDocument();
  });

  it("offers the REAL two-value CreativeFormat, not the spec's VIDEO_15S/IMAGE_SQUARE multi-select", async () => {
    global.fetch = mockFetch() as unknown as typeof fetch;
    render(<ManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Video + Gambar")).toBeInTheDocument());
    expect(screen.getByText("Gambar saja")).toBeInTheDocument();
    expect(screen.queryByText("VIDEO_15S")).not.toBeInTheDocument();
    expect(screen.queryByText("IMAGE_SQUARE")).not.toBeInTheDocument();
  });

  it("loads units from the real scraper stock endpoint", async () => {
    const fetchMock = mockFetch();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Xpander GLS 2022/ })).toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls.some(([i]) => String(i).includes("/api/scraper/stock"))).toBe(true);
  });

  it("previews the photos Kai will really find, keyed by the same unitId", async () => {
    const fetchMock = mockFetch({ assets: [{ publicUrl: "https://gcs/foto-1.jpg" }] });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("creative-photo-strip")).toBeInTheDocument());
    const assetCall = fetchMock.mock.calls.find(([i]) => String(i).includes("/api/assets"));
    expect(String(assetCall?.[0])).toContain("unitId=xpander-gls-2022-001");
  });

  it("says plainly when a unit has no photos rather than pretending it does", async () => {
    global.fetch = mockFetch({ assets: [] }) as unknown as typeof fetch;
    render(<ManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/Belum ada foto unit ini di asset library/)).toBeInTheDocument(),
    );
  });

  it("has no “Upload foto sendiri” control (no real upload endpoint exists)", async () => {
    global.fetch = mockFetch() as unknown as typeof fetch;
    render(<ManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Video + Gambar")).toBeInTheDocument());
    expect(screen.queryByText(/Upload foto/i)).not.toBeInTheDocument();
  });

  it("submits the unit's identityKey (not a free-text name) with generate:false for a draft", async () => {
    const fetchMock = mockFetch();
    global.fetch = fetchMock as unknown as typeof fetch;
    const onCreated = vi.fn();
    render(<ManualBriefForm onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByText("Video + Gambar")).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText(/DP mulai 29 juta/), "DP 29 juta");
    await userEvent.click(screen.getByRole("button", { name: /Simpan sebagai Draft/ }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse(String(post?.[1]?.body)) as Record<string, unknown>;
    expect(body["unit"]).toBe("xpander-gls-2022-001");
    expect(body["generate"]).toBe(false);
    expect(body["origin"]).toBe("MANUAL");
    expect(body["format"]).toBe("VIDEO_AND_IMAGES");
  });

  it("submits generate:true only from the explicit “Kirim ke Kai” button", async () => {
    const fetchMock = mockFetch();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Video + Gambar")).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText(/DP mulai 29 juta/), "DP 29 juta");
    await userEvent.click(screen.getByRole("button", { name: /Kirim ke Kai/ }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true),
    );
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse(String(post?.[1]?.body)) as Record<string, unknown>;
    expect(body["generate"]).toBe(true);
  });

  it("keeps both submit buttons disabled until a unit and a primary message exist", async () => {
    global.fetch = mockFetch() as unknown as typeof fetch;
    render(<ManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Video + Gambar")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Kirim ke Kai/ })).toBeDisabled();
  });

  it("shows the brief preview built from real, selected values", async () => {
    global.fetch = mockFetch() as unknown as typeof fetch;
    render(<ManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("creative-brief-preview")).toBeInTheDocument());
    expect(screen.getByTestId("creative-brief-preview")).toHaveTextContent("xpander-gls-2022-001");
  });

  it("surfaces an upstream validation error instead of silently succeeding", async () => {
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/api/scraper/stock")) {
        return jsonResponse({ units: [UNIT], total: 1, page: 1, limit: 200 });
      }
      if (url.includes("/api/assets")) {
        return jsonResponse({ assets: [], total: 0, page: 1, limit: 12 });
      }
      return jsonResponse({ error: { message: "angle: Invalid enum value" } }, 422);
    }) as unknown as typeof fetch;

    render(<ManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Video + Gambar")).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText(/DP mulai 29 juta/), "DP 29 juta");
    await userEvent.click(screen.getByRole("button", { name: /Simpan sebagai Draft/ }));
    await waitFor(() =>
      expect(screen.getByTestId("error-card")).toHaveTextContent(/Invalid enum value/),
    );
  });
});
