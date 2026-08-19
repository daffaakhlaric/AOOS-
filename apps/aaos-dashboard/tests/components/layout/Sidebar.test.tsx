import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

import { Sidebar } from "@/components/layout/Sidebar";

function mockSettingsFetch(vertical: "AUTOMOTIVE" | "PROPERTY" | undefined): void {
  global.fetch = vi.fn(async () =>
    vertical === undefined
      ? new Response(null, { status: 401 })
      : new Response(
          JSON.stringify({
            tenant: { tenantId: "t", name: "T", vertical, status: "ACTIVE" },
            meta: { apiVersion: "v21.0", hasToken: false, usingEnvDefault: true },
          }),
          { status: 200 },
        ),
  ) as unknown as typeof fetch;
}

describe("Sidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the AUTOMOTIVE nav (Scraper Mobix, plain KAI label) before the vertical is resolved", () => {
    mockSettingsFetch(undefined);
    render(<Sidebar />);
    expect(screen.getByText("KAI (CREATIVE)")).toBeInTheDocument();
    expect(screen.getByText("Scraper Mobix")).toBeInTheDocument();
    expect(screen.queryByText("Listing Manager")).not.toBeInTheDocument();
  });

  it("keeps the AUTOMOTIVE nav (Scraper Mobix) when the session's vertical is AUTOMOTIVE", async () => {
    mockSettingsFetch("AUTOMOTIVE");
    render(<Sidebar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/settings"));
    expect(screen.getByText("Scraper Mobix")).toBeInTheDocument();
    expect(screen.queryByText("Listing Manager")).not.toBeInTheDocument();
  });

  it("swaps to the PROPERTY nav (Listing Manager, relabeled KAI section) when the session's vertical is PROPERTY", async () => {
    mockSettingsFetch("PROPERTY");
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByText("Listing Manager")).toBeInTheDocument());
    expect(screen.getByText("KAI (CREATIVE) — PROPERTI")).toBeInTheDocument();
    expect(screen.queryByText("Scraper Mobix")).not.toBeInTheDocument();
    const link = screen.getByText("Listing Manager").closest("a");
    expect(link).toHaveAttribute("href", "/listings");
  });

  it("never breaks rendering when the settings fetch fails", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    render(<Sidebar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText("Scraper Mobix")).toBeInTheDocument();
  });
});
