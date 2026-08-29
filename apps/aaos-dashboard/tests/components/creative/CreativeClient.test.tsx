import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreativeClient } from "@/components/creative/CreativeClient";
import type { CreativePackageDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const PACKAGE: CreativePackageDto = {
  id: "11111111-1111-4111-8111-111111111111",
  briefId: "22222222-2222-4222-8222-222222222222",
  branch: "BINTARO",
  unit: "xpander-gls-2022-001",
  unitModel: "Xpander GLS 2022",
  title: "Xpander GLS 2022 BINTARO · DP_RINGAN",
  angle: "DP_RINGAN",
  targetPersona: "PRIMARY_FAMILY",
  reason: "Brief manual dibuat manager.",
  requestedFormat: "VIDEO_AND_IMAGES",
  primaryMessage: "DP mulai 29 juta",
  urgency: "HIGH",
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

describe("CreativeClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders pending packages in the default Antrian Review tab", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ packages: [PACKAGE] }),
    ) as unknown as typeof fetch;
    render(<CreativeClient />);
    await waitFor(() => expect(screen.getByTestId("creative-package-card")).toBeInTheDocument());
  });

  it("renders all five tabs and no Full Auto / mode switcher / settings control", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ packages: [PACKAGE] }),
    ) as unknown as typeof fetch;
    render(<CreativeClient />);
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(5));
    for (const label of [
      "Antrian Review",
      "Sedang Diproses",
      "Buat Manual",
      "Rekomendasi Samantha",
      "Log Samantha × Kai",
    ]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByText(/Full Auto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Semi-Auto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Threshold/i)).not.toBeInTheDocument();
  });

  it("shows KPI counts derived from the real persisted statuses", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        packages: [
          PACKAGE,
          { ...PACKAGE, id: "b", status: "GENERATING" },
          { ...PACKAGE, id: "c", status: "DRAFT" },
        ],
      }),
    ) as unknown as typeof fetch;
    render(<CreativeClient />);
    await waitFor(() => expect(screen.getAllByTestId("metric-card")).toHaveLength(5));
  });

  it("shows an empty state when there are no pending packages", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ packages: [{ ...PACKAGE, status: "APPROVED" }] }),
    ) as unknown as typeof fetch;
    render(<CreativeClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<CreativeClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });

  it("approving a package re-reads the real persisted list", async () => {
    let approved = false;
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/approve")) {
        approved = true;
        return jsonResponse({ package: { ...PACKAGE, status: "APPROVED" } });
      }
      return jsonResponse({
        packages: [approved ? { ...PACKAGE, status: "APPROVED" } : PACKAGE],
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CreativeClient />);
    await waitFor(() => expect(screen.getByTestId("creative-package-card")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Approve/ }));
    await waitFor(() =>
      expect(screen.queryByTestId("creative-package-card")).not.toBeInTheDocument(),
    );
  });

  it("the Sedang Diproses tab lists running jobs and offers a manual generate for drafts", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        packages: [
          { ...PACKAGE, id: "g", status: "GENERATING", sourcePhotoUrls: ["https://gcs/f1.jpg"] },
          { ...PACKAGE, id: "d", status: "DRAFT" },
        ],
      }),
    ) as unknown as typeof fetch;
    render(<CreativeClient />);
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(5));
    await userEvent.click(screen.getByRole("tab", { name: "Sedang Diproses" }));
    expect(screen.getByTestId("creative-processing-row")).toBeInTheDocument();
    expect(screen.getByTestId("creative-draft-row")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Kirim ke Kai — Generate Sekarang/ }),
    ).toBeInTheDocument();
  });

  it("a draft's generate button hits the real generate endpoint (the only Kie AI spend path)", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/generate")) {
        return jsonResponse({ package: { ...PACKAGE, id: "d", status: "GENERATING" } });
      }
      return jsonResponse({ packages: [{ ...PACKAGE, id: "d", status: "DRAFT" }] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CreativeClient />);
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(5));
    await userEvent.click(screen.getByRole("tab", { name: "Sedang Diproses" }));
    await userEvent.click(screen.getByRole("button", { name: /Kirim ke Kai/ }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/generate"))).toBe(
        true,
      ),
    );
  });

  it("surfaces an honest error when generate is refused upstream (e.g. Kai not configured)", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/generate")) {
        return jsonResponse(
          { error: { message: "Kai (creative generation) is not configured" } },
          503,
        );
      }
      return jsonResponse({ packages: [{ ...PACKAGE, id: "d", status: "DRAFT" }] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CreativeClient />);
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(5));
    await userEvent.click(screen.getByRole("tab", { name: "Sedang Diproses" }));
    await userEvent.click(screen.getByRole("button", { name: /Kirim ke Kai/ }));
    await waitFor(() =>
      expect(screen.getByTestId("error-card")).toHaveTextContent(/not configured/),
    );
  });

  it("never calls the generate endpoint on its own — only in response to a click", async () => {
    const fetchMock = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      jsonResponse({ packages: [{ ...PACKAGE, id: "d", status: "DRAFT" }] }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<CreativeClient />);
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(5));
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/generate"))).toBe(false);
  });
});
