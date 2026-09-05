import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { CreativeDetailClient } from "@/components/creative/CreativeDetailClient";
import type { CreativePackageDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const PACKAGE: CreativePackageDto = {
  id: "11111111-1111-4111-8111-111111111111",
  briefId: "22222222-2222-4222-8222-222222222222",
  vertical: "AUTOMOTIVE",
  branch: "BINTARO",
  unit: "xpander-gls-2022-001",
  title: "Xpander GLS 2022 BINTARO · DP_RINGAN",
  angle: "DP_RINGAN",
  targetPersona: "PRIMARY_FAMILY",
  reason: "Brief manual dibuat manager.",
  requestedFormat: "IMAGES_ONLY",
  primaryMessage: "DP mulai 29 juta",
  urgency: "HIGH",
  aiRecommended: false,
  fatigueStatus: "NORMAL",
  origin: "MANUAL",
  status: "PENDING",
  sourcePhotoUrls: [],
  imageUrls: ["https://gcs/a.jpg"],
  copyVariants: [
    { id: "v-a", variantLabel: "A", primaryText: "Copy A", headline: "H", callToAction: "CTA" },
  ],
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z",
};

const DETAIL = { package: PACKAGE, logs: [] };

describe("CreativeDetailClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the REAL single-item endpoint instead of scanning the whole list", async () => {
    const fetchMock = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      jsonResponse(DETAIL),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<CreativeDetailClient packageId={PACKAGE.id} />);
    await waitFor(() => expect(screen.getByTestId("creative-package-card")).toBeInTheDocument());
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`/api/creative/${PACKAGE.id}`);
  });

  it("renders the package's own real log trail when it has one", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        package: PACKAGE,
        logs: [
          {
            id: "log-1",
            fromAgent: "MANAGER",
            toAgent: "KAI",
            eventType: "BRIEF_SENT",
            message: "Brief dikirim ke Kai.",
            createdAt: "2026-08-18T02:41:00.000Z",
          },
        ],
      }),
    ) as unknown as typeof fetch;
    render(<CreativeDetailClient packageId={PACKAGE.id} />);
    await waitFor(() => expect(screen.getByTestId("creative-detail-logs")).toBeInTheDocument());
    expect(screen.getByText(/Brief dikirim ke Kai/)).toBeInTheDocument();
  });

  it("shows an empty state on a real upstream 404", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "not found" } }, 404),
    ) as unknown as typeof fetch;
    render(<CreativeDetailClient packageId="missing" />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("shows an error card on any other upstream failure", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<CreativeDetailClient packageId={PACKAGE.id} />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });

  it("rejecting the package calls the reject endpoint", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/reject"))
        return jsonResponse({ package: { ...PACKAGE, status: "REJECTED" } });
      return jsonResponse(DETAIL);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CreativeDetailClient packageId={PACKAGE.id} />);
    await waitFor(() => expect(screen.getByTestId("creative-package-card")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Reject/ }));
    await waitFor(() => {
      const called = fetchMock.mock.calls.some(([url]) => String(url).includes("/reject"));
      expect(called).toBe(true);
    });
  });
});
