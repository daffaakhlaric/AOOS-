import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TenantVerticalSelector } from "@/components/simulator/TenantVerticalSelector";
import type { FetchActiveListingsResponse, FetchTenantsResponse } from "@/types/simulator.types";

function jsonResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

const AUTOMOTIVE_ONLY_TENANTS: FetchTenantsResponse = {
  ok: true,
  tenants: [{ tenantId: "dss-motor", name: "DSS Motor", vertical: "AUTOMOTIVE" }],
};

const MIXED_TENANTS: FetchTenantsResponse = {
  ok: true,
  tenants: [
    { tenantId: "dss-motor", name: "DSS Motor", vertical: "AUTOMOTIVE" },
    { tenantId: "agen-pintar-indonesia", name: "Agen Pintar Indonesia", vertical: "PROPERTY" },
  ],
};

describe("TenantVerticalSelector", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /api/tenants on mount and auto-selects the tenant, reporting AUTOMOTIVE vertical with no listing fetch", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(AUTOMOTIVE_ONLY_TENANTS));
    const onSelectionChange = vi.fn();

    render(<TenantVerticalSelector onSelectionChange={onSelectionChange} />);

    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenCalledWith({
        tenantId: "dss-motor",
        vertical: "AUTOMOTIVE",
      }),
    );
    expect(screen.getByTestId("vertical-badge")).toHaveTextContent("AUTOMOTIVE");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("/api/tenants");
  });

  it("defaults the initial pick to defaultTenantId when it matches a real tenant in the list", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(MIXED_TENANTS));
    const onSelectionChange = vi.fn();

    render(
      <TenantVerticalSelector
        defaultTenantId="agen-pintar-indonesia"
        onSelectionChange={onSelectionChange}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("tenant-select")).toHaveValue("agen-pintar-indonesia"),
    );
  });

  it("shows an honest error and calls onSelectionChange(undefined) when the real tenant fetch fails", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: false, reason: "aaos-api merespons status 500." }),
    } as unknown as Response);
    const onSelectionChange = vi.fn();

    render(<TenantVerticalSelector onSelectionChange={onSelectionChange} />);

    await waitFor(() => expect(screen.getByTestId("tenant-selector-error")).toBeInTheDocument());
    expect(onSelectionChange).toHaveBeenCalledWith(undefined);
    expect(screen.queryByTestId("tenant-select")).not.toBeInTheDocument();
  });

  it("selecting a PROPERTY tenant fetches its real active listings and auto-selects the first one", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (url === "/api/tenants") {
        return jsonResponse(MIXED_TENANTS);
      }
      const listingsResponse: FetchActiveListingsResponse = {
        ok: true,
        listings: [
          {
            id: "listing-1",
            title: "Rumah Minimalis Cinere",
            propertyType: "RUMAH",
            price: 1_500_000_000,
          },
        ],
      };
      return jsonResponse(listingsResponse);
    });
    const onSelectionChange = vi.fn();

    render(
      <TenantVerticalSelector
        defaultTenantId="agen-pintar-indonesia"
        onSelectionChange={onSelectionChange}
      />,
    );

    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenCalledWith({
        tenantId: "agen-pintar-indonesia",
        vertical: "PROPERTY",
        listingId: "listing-1",
      }),
    );
    expect(screen.getByTestId("listing-select")).toBeInTheDocument();
  });

  it("shows an honest empty state when a PROPERTY tenant has zero real active listings", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (url === "/api/tenants") {
        return jsonResponse(MIXED_TENANTS);
      }
      const listingsResponse: FetchActiveListingsResponse = { ok: true, listings: [] };
      return jsonResponse(listingsResponse);
    });
    const onSelectionChange = vi.fn();

    render(
      <TenantVerticalSelector
        defaultTenantId="agen-pintar-indonesia"
        onSelectionChange={onSelectionChange}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("listing-selector-empty")).toBeInTheDocument());
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      tenantId: "agen-pintar-indonesia",
      vertical: "PROPERTY",
    });
  });

  it("switching tenants via the dropdown re-resolves the vertical and clears any prior listing selection", async () => {
    const user = userEvent.setup();
    fetchSpy.mockImplementation(async (url: string) => {
      if (url === "/api/tenants") {
        return jsonResponse(MIXED_TENANTS);
      }
      const listingsResponse: FetchActiveListingsResponse = {
        ok: true,
        listings: [
          {
            id: "listing-1",
            title: "Rumah Minimalis Cinere",
            propertyType: "RUMAH",
            price: 1_500_000_000,
          },
        ],
      };
      return jsonResponse(listingsResponse);
    });
    const onSelectionChange = vi.fn();

    render(
      <TenantVerticalSelector defaultTenantId="dss-motor" onSelectionChange={onSelectionChange} />,
    );

    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenCalledWith({
        tenantId: "dss-motor",
        vertical: "AUTOMOTIVE",
      }),
    );

    await user.selectOptions(screen.getByTestId("tenant-select"), "agen-pintar-indonesia");

    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenCalledWith({
        tenantId: "agen-pintar-indonesia",
        vertical: "PROPERTY",
        listingId: "listing-1",
      }),
    );
  });
});
