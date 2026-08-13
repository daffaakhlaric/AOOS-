import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreativeClient } from "@/components/creative/CreativeClient";

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

describe("CreativeClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders pending packages", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ packages: [PACKAGE] }),
    ) as unknown as typeof fetch;
    render(<CreativeClient />);
    await waitFor(() => expect(screen.getByTestId("creative-package-card")).toBeInTheDocument());
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

  it("approving a package updates it in place", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/approve")) {
        return jsonResponse({ package: { ...PACKAGE, status: "APPROVED" } });
      }
      return jsonResponse({ packages: [PACKAGE] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CreativeClient />);
    await waitFor(() => expect(screen.getByTestId("creative-package-card")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Approve/ }));
    await waitFor(() =>
      expect(screen.queryByTestId("creative-package-card")).not.toBeInTheDocument(),
    );
  });
});
