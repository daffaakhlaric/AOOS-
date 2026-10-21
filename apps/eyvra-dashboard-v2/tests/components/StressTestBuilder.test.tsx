import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
let searchQuery = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(searchQuery),
}));

import { StressTestBuilder } from "@/components/stress-test/StressTestBuilder";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockClear();
  searchQuery = "";
});

function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url === "/api/listings") {
        return {
          ok: true,
          json: async () => ({
            listings: [{ listing: { id: "listing-1", title: "Rumah Bintaro" } }],
          }),
        };
      }
      if (url === "/api/campaigns") {
        return { ok: true, json: async () => ({ campaigns: [] }) };
      }
      if (url === "/api/listings/listing-1") {
        return {
          ok: true,
          json: async () => ({
            id: "listing-1",
            photos: [
              { id: "photo-1", url: "https://example.test/photo-1.jpg", isMain: true },
              { id: "photo-2", url: "https://example.test/photo-2.jpg", isMain: false },
            ],
          }),
        };
      }
      if (url === "/api/creative-stress-test/persona-presets") {
        return {
          ok: true,
          json: async () => ({
            version: 1,
            presets: [
              { id: "PRICE_SENSITIVE", label: "Price Sensitive", description: "Fokus harga." },
              { id: "HIGH_INTENT", label: "High Intent", description: "Siap beli." },
            ],
          }),
        };
      }
      if (url === "/api/creative-stress-test/objection-sources") {
        return {
          ok: true,
          json: async () => ({
            sources: [
              {
                key: "LISTING_KNOWLEDGE_BASE",
                label: "Listing Knowledge Base",
                available: true,
                note: "Real",
              },
              {
                key: "FIRST_MESSAGE_INTELLIGENCE",
                label: "First Message Intelligence",
                available: false,
                note: "Belum tersedia — belum ada field firstMessage nyata.",
              },
            ],
          }),
        };
      }
      if (url === "/api/creative-stress-test" && method === "GET") {
        return { ok: true, json: async () => ({ runs: [] }) };
      }
      if (url === "/api/creative-stress-test" && method === "POST") {
        return {
          ok: true,
          json: async () => ({
            id: "run-new",
            name: "New run",
            sourceType: "LISTING",
            listingId: "listing-1",
            creativeIds: [],
            mode: "STANDARD",
            primaryGoal: "CREATIVE_QUALITY",
            personaIds: ["PRICE_SENSITIVE"],
            objectionSources: [],
            status: "DRAFT",
            result: null,
            createdAt: "2026-09-28T00:00:00.000Z",
          }),
        };
      }
      if (url === "/api/creative-stress-test/run-old" && method === "GET") {
        return {
          ok: true,
          json: async () => ({
            id: "run-old",
            name: "Run lama",
            sourceType: "LISTING",
            listingId: "listing-1",
            creativeIds: ["photo-2"],
            mode: "DEEP",
            primaryGoal: "HOT_LEAD_RATE",
            personaIds: ["HIGH_INTENT"],
            objectionSources: ["LISTING_KNOWLEDGE_BASE"],
            status: "COMPLETED",
            result: null,
            createdAt: "2026-09-27T00:00:00.000Z",
          }),
        };
      }
      if (url === "/api/creative-stress-test/run-new/execute") {
        return {
          ok: true,
          json: async () => ({
            id: "run-new",
            status: "WAITING_FOR_ENGINE",
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }),
  );
}

describe("StressTestBuilder", () => {
  it("marks First Message Intelligence as an honest gap, never a selectable-as-real source", async () => {
    stubFetch();
    render(<StressTestBuilder />);
    await waitFor(() => expect(screen.getByText("Listing Knowledge Base")).toBeInTheDocument());
    expect(
      screen.getByText("Belum tersedia — belum ada field firstMessage nyata."),
    ).toBeInTheDocument();
  });

  it("labels persona presets as configured presets, not real buyer data", async () => {
    stubFetch();
    render(<StressTestBuilder />);
    await waitFor(() => expect(screen.getByText("Price Sensitive")).toBeInTheDocument());
    expect(
      screen.getByText(/Preset persona terkonfigurasi \(bukan data pembeli nyata\)/),
    ).toBeInTheDocument();
  });

  it("creates a real run and navigates to its detail page on submit", async () => {
    stubFetch();
    render(<StressTestBuilder />);
    await waitFor(() => expect(screen.getByText("Price Sensitive")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Nama Run"), { target: { value: "New run" } });
    fireEvent.change(screen.getByLabelText("Listing"), { target: { value: "listing-1" } });
    fireEvent.click(screen.getByText("Price Sensitive"));

    const submit = screen.getByRole("button", { name: /Jalankan Uji Ketahanan Creative/i });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/samantha/stress-test/run-new"));
  });

  it("disables the primary action until a name, context, and at least one persona are chosen", async () => {
    stubFetch();
    render(<StressTestBuilder />);
    await waitFor(() => expect(screen.getByText("Price Sensitive")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Jalankan Uji Ketahanan Creative/i })).toBeDisabled();
  });

  it("offers a listing's real photos as Creative Under Test once that listing is selected", async () => {
    stubFetch();
    render(<StressTestBuilder />);
    await waitFor(() => expect(screen.getByText("Price Sensitive")).toBeInTheDocument());
    expect(
      screen.getByText("Pilih listing untuk memilih foto nyata dari listing tersebut (opsional)."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Listing"), { target: { value: "listing-1" } });
    await waitFor(() => expect(screen.getByText("Foto utama")).toBeInTheDocument());
    expect(screen.getByText("Foto listing")).toBeInTheDocument();
    const mainPhotoButton = screen.getByText("Foto utama").closest("button")!;
    expect(mainPhotoButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(mainPhotoButton);
    expect(mainPhotoButton).toHaveAttribute("aria-pressed", "true");
  });

  it("clears the creative selection when switching between Listing and Campaign source", async () => {
    stubFetch();
    render(<StressTestBuilder />);
    await waitFor(() => expect(screen.getByText("Price Sensitive")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Listing"), { target: { value: "listing-1" } });
    await waitFor(() => expect(screen.getByText("Foto utama")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Foto utama").closest("button")!);
    fireEvent.change(screen.getByLabelText("Sumber"), { target: { value: "CAMPAIGN" } });
    expect(
      screen.getByText(
        "Pilih campaign untuk memilih creative nyata dari campaign tersebut (opsional).",
      ),
    ).toBeInTheDocument();
  });

  it("prefills every setting from a real prior run when opened via ?fromRun (Run Lagi) and creates a NEW run on submit", async () => {
    searchQuery = "fromRun=run-old&intent=rerun";
    stubFetch();
    render(<StressTestBuilder />);
    await waitFor(() => expect(screen.getByLabelText("Nama Run")).toHaveValue("Run lama"));
    expect(screen.getByTestId("stress-test-prefill-notice")).toHaveTextContent('run "Run lama"');
    expect(screen.getByLabelText("Sumber")).toHaveValue("LISTING");
    expect(screen.getByLabelText("Primary Goal")).toHaveValue("HOT_LEAD_RATE");
    await waitFor(() =>
      expect(screen.getByText("High Intent").closest("button")).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(screen.getByRole("button", { name: /Deep/ })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() =>
      expect(screen.getByText("Foto listing").closest("button")).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );

    const fetchMock = vi.mocked(fetch);
    fireEvent.click(screen.getByRole("button", { name: /Jalankan Uji Ketahanan Creative/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/samantha/stress-test/run-new"));
    const post = fetchMock.mock.calls.find(
      ([u, init]) => u === "/api/creative-stress-test" && init?.method === "POST",
    );
    const body = JSON.parse(String(post?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      name: "Run lama",
      sourceType: "LISTING",
      listingId: "listing-1",
      creativeIds: ["photo-2"],
      mode: "DEEP",
      primaryGoal: "HOT_LEAD_RATE",
      personaIds: ["HIGH_INTENT"],
      objectionSources: ["LISTING_KNOWLEDGE_BASE"],
    });
  });

  it("marks a duplicated run's name as a copy", async () => {
    searchQuery = "fromRun=run-old&intent=duplicate";
    stubFetch();
    render(<StressTestBuilder />);
    await waitFor(() =>
      expect(screen.getByLabelText("Nama Run")).toHaveValue("Run lama (salinan)"),
    );
    expect(screen.getByTestId("stress-test-prefill-notice")).toHaveTextContent("Diduplikasi");
  });
});
