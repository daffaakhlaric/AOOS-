import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardSosmedClient } from "@/components/sosmed/DashboardSosmedClient";
import type { ScheduledPostDto, SosmedAccountDto } from "@/types/sosmed.types";

const NOW = new Date();
const TODAY_ISO = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 10, 0).toISOString();

const POSTS: readonly ScheduledPostDto[] = [
  {
    id: "p-1",
    tenantId: "t-1",
    caption: "Foto Xpander Cinere DP ringan mulai 29 juta bulan ini",
    hashtags: ["#Mobix"],
    generatedBy: "TAMARA",
    status: "SCHEDULED",
    scheduledAt: TODAY_ISO,
    reach: 0,
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    engagementCount: 0,
    createdAt: NOW.toISOString(),
  },
  {
    id: "p-2",
    tenantId: "t-1",
    caption: "Testimoni Bu Sari",
    hashtags: [],
    generatedBy: "TAMARA",
    status: "PUBLISHED",
    reach: 1204,
    impressions: 2000,
    likes: 48,
    comments: 7,
    shares: 3,
    engagementCount: 58,
    createdAt: NOW.toISOString(),
  },
];

const ACCOUNTS: readonly SosmedAccountDto[] = [
  {
    id: "a-1",
    tenantId: "t-1",
    platform: "INSTAGRAM",
    accountType: "OFFICIAL",
    accountName: "@mobixbydss",
    maskedAccessToken: "***abcd",
    followerCount: 8200,
    status: "CONNECTED",
    createdAt: NOW.toISOString(),
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetchRouter(
  overrides: Partial<{ posts: () => Response; accounts: () => Response }> = {},
): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "/api/sosmed/posts") {
      return overrides.posts?.() ?? jsonResponse({ posts: POSTS });
    }
    if (url === "/api/sosmed/accounts") {
      return overrides.accounts?.() ?? jsonResponse({ accounts: ACCOUNTS });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe("DashboardSosmedClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the real KPI strip aggregated from posts + accounts", async () => {
    mockFetchRouter();
    render(<DashboardSosmedClient />);
    await waitFor(() => expect(screen.getByTestId("sosmed-kpi-strip")).toBeInTheDocument());

    expect(screen.getByText("1")).toBeInTheDocument(); // akun terhubung
    expect(screen.getByText("2")).toBeInTheDocument(); // post bulan ini
    expect(screen.getByText("1.204")).toBeInTheDocument(); // total reach
  });

  it("shows today's scheduled post", async () => {
    mockFetchRouter();
    render(<DashboardSosmedClient />);
    await waitFor(() => expect(screen.getByTestId("today-schedule-list")).toBeInTheDocument());
    expect(screen.getByText(/Foto Xpander Cinere/)).toBeInTheDocument();
  });

  it("shows an empty state when there is no post scheduled today", async () => {
    mockFetchRouter({ posts: () => jsonResponse({ posts: [] }) });
    render(<DashboardSosmedClient />);
    await waitFor(() =>
      expect(screen.getByText(/Tidak ada post terjadwal hari ini/)).toBeInTheDocument(),
    );
  });

  it("shows the real connected accounts list with platform + status", async () => {
    mockFetchRouter();
    render(<DashboardSosmedClient />);
    await waitFor(() => expect(screen.getByTestId("connected-accounts-list")).toBeInTheDocument());
    expect(screen.getByText(/@mobixbydss/)).toBeInTheDocument();
    expect(screen.getByText(/8.200 followers/)).toBeInTheDocument();
    expect(screen.getByText(/🟢 Connected/)).toBeInTheDocument();
  });

  it("shows an error card when the posts fetch fails", async () => {
    mockFetchRouter({ posts: () => new Response("{}", { status: 500 }) });
    render(<DashboardSosmedClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
