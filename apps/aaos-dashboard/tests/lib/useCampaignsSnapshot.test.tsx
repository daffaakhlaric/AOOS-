import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readCampaignsCache, writeCampaignsCache } from "@/lib/campaignsCache";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type { AdAccountSummaryDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const DATA: AdAccountSummaryDto = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-11T00:00:00.000Z",
  campaigns: [],
  ads: [],
  totals: {
    spend: 0,
    clicks: 0,
    frequency: 0,
    conversations: 0,
    d2: 0,
    d3: 0,
    d5: 0,
    leadForm: 0,
    totalLead: 0,
    rphD3: null,
  },
  campaignCount: 0,
  adCount: 0,
};

function Harness(): React.ReactElement {
  const { data, loading, error, fetchedAt, period, pull } = useCampaignsSnapshot();
  return (
    <div>
      <p data-testid="state">
        {JSON.stringify({ hasData: data !== undefined, loading, error, fetchedAt, period })}
      </p>
      <button type="button" onClick={() => void pull("last_7d")}>
        Pull
      </button>
    </div>
  );
}

describe("useCampaignsSnapshot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not fetch on mount and starts with no data when the cache is empty", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(DATA));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<Harness />);

    await screen.findByTestId("state");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toContain('"hasData":false');
  });

  it("reads the cache on mount with no network call", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: 1000, period: "last_30d" });
    const fetchMock = vi.fn(async () => jsonResponse(DATA));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<Harness />);

    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain('"hasData":true'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pull() force-pulls fresh data, writing it to the shared cache", async () => {
    global.fetch = vi.fn(async () => jsonResponse(DATA)) as unknown as typeof fetch;
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Pull" }));
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain('"hasData":true'),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(readCampaignsCache()?.period).toBe("last_7d");
  });

  it("surfaces an error message on a failed pull", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Pull" }));
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain("Gagal menarik data iklan."),
    );
  });
});
