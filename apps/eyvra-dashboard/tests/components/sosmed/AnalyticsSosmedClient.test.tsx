import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalyticsSosmedClient } from "@/components/sosmed/AnalyticsSosmedClient";
import type { ScheduledPostDto, SosmedAccountDto } from "@/types/sosmed.types";

const ACCOUNT: SosmedAccountDto = {
  id: "a-1",
  tenantId: "t-1",
  platform: "INSTAGRAM",
  accountType: "OFFICIAL",
  accountName: "@mobixbydss",
  maskedAccessToken: "***abcd",
  followerCount: 8200,
  status: "CONNECTED",
  createdAt: "2026-08-01T00:00:00.000Z",
};

function post(overrides: Partial<ScheduledPostDto>): ScheduledPostDto {
  return {
    id: "p",
    tenantId: "t-1",
    accountId: "a-1",
    caption: "Xpander DP 29jt",
    hashtags: [],
    generatedBy: "SAMANTHA",
    contentType: "PROMO",
    status: "PUBLISHED",
    publishedAt: "2026-08-14T03:00:00.000Z",
    reach: 2400,
    impressions: 3000,
    likes: 100,
    comments: 20,
    shares: 5,
    engagementCount: 200,
    createdAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetchRouter(posts: readonly ScheduledPostDto[]): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "/api/sosmed/posts?status=PUBLISHED") {
      return jsonResponse({ posts });
    }
    if (url === "/api/sosmed/accounts") {
      return jsonResponse({ accounts: [ACCOUNT] });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe("AnalyticsSosmedClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an empty state when no post has published yet", async () => {
    mockFetchRouter([]);
    render(<AnalyticsSosmedClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("computes real KPI totals from the published posts' own reach/impressions columns", async () => {
    mockFetchRouter([post({ id: "p-1" }), post({ id: "p-2", reach: 1800, impressions: 2200 })]);
    render(<AnalyticsSosmedClient />);
    await waitFor(() => expect(screen.getByTestId("analytics-kpi-strip")).toBeInTheDocument());
    expect(screen.getByText("4.200")).toBeInTheDocument(); // total reach: 2400+1800
    expect(screen.getByText("5.200")).toBeInTheDocument(); // total impressions
  });

  it("shows the top posts and per-account rollup", async () => {
    mockFetchRouter([post({ id: "p-1" })]);
    render(<AnalyticsSosmedClient />);
    await waitFor(() => expect(screen.getByTestId("top-posts")).toBeInTheDocument());
    expect(screen.getByTestId("account-rollups")).toBeInTheDocument();
    expect(screen.getByText(/@mobixbydss/)).toBeInTheDocument();
  });

  it("shows 'belum cukup data' for best posting times below the minimum sample size", async () => {
    mockFetchRouter([post({ id: "p-1" }), post({ id: "p-2" })]);
    render(<AnalyticsSosmedClient />);
    await waitFor(() => expect(screen.getByText(/Belum cukup data/)).toBeInTheDocument());
  });

  it("computes real best posting hours once there are at least 3 published posts", async () => {
    mockFetchRouter([
      post({ id: "p-1", publishedAt: "2026-08-14T03:00:00.000Z" }),
      post({ id: "p-2", publishedAt: "2026-08-15T03:00:00.000Z" }),
      post({ id: "p-3", publishedAt: "2026-08-16T03:00:00.000Z" }),
    ]);
    render(<AnalyticsSosmedClient />);
    await waitFor(() => expect(screen.getByTestId("best-hours")).toBeInTheDocument());
  });

  it("shows content type breakdown as a real count-by-type list", async () => {
    mockFetchRouter([
      post({ id: "p-1", contentType: "PROMO" }),
      post({ id: "p-2", contentType: "TESTIMONI" }),
    ]);
    render(<AnalyticsSosmedClient />);
    await waitFor(() => expect(screen.getByTestId("content-type-breakdown")).toBeInTheDocument());
    expect(screen.getByText("PROMO")).toBeInTheDocument();
    expect(screen.getByText("TESTIMONI")).toBeInTheDocument();
  });
});
