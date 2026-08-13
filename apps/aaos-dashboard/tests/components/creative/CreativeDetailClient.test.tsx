import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { CreativeDetailClient } from "@/components/creative/CreativeDetailClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const PACKAGE = {
  id: "KAI-001",
  briefId: "A003",
  branch: "BINTARO",
  unit: "Xpander",
  title: "Xpander Bintaro",
  imageUrls: ["a.jpg", "b.jpg", "c.jpg"],
  copyVariants: [
    { id: "v-a", variantLabel: "A", primaryText: "Copy A", headline: "H", callToAction: "CTA" },
  ],
  status: "PENDING",
  createdAt: "2026-08-09T00:00:00.000Z",
};

describe("CreativeDetailClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the found package", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ packages: [PACKAGE] }),
    ) as unknown as typeof fetch;
    render(<CreativeDetailClient packageId="KAI-001" />);
    await waitFor(() => expect(screen.getByTestId("creative-package-card")).toBeInTheDocument());
  });

  it("shows an empty state when the package id is not found", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ packages: [PACKAGE] }),
    ) as unknown as typeof fetch;
    render(<CreativeDetailClient packageId="missing" />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("rejecting the package calls the reject endpoint", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/reject"))
        return jsonResponse({ package: { ...PACKAGE, status: "REJECTED" } });
      return jsonResponse({ packages: [PACKAGE] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CreativeDetailClient packageId="KAI-001" />);
    await waitFor(() => expect(screen.getByTestId("creative-package-card")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Reject/ }));
    await waitFor(() => {
      const called = fetchMock.mock.calls.some(([url]) => String(url).includes("/reject"));
      expect(called).toBe(true);
    });
  });
});
