import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContentCalendarClient } from "@/components/sosmed/ContentCalendarClient";
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

const POST: ScheduledPostDto = {
  id: "p-1",
  tenantId: "t-1",
  accountId: "a-1",
  caption: "Foto unit terbaru siap test drive minggu ini",
  hashtags: [],
  generatedBy: "SAMANTHA",
  status: "SCHEDULED",
  scheduledAt: "2026-08-16T03:00:00.000Z",
  reach: 0,
  impressions: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  engagementCount: 0,
  createdAt: "2026-08-14T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetchRouter(posts: readonly ScheduledPostDto[] = [POST]): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "/api/sosmed/posts?status=SCHEDULED") {
      return jsonResponse({ posts });
    }
    if (url === "/api/sosmed/accounts") {
      return jsonResponse({ accounts: [ACCOUNT] });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe("ContentCalendarClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("groups the real scheduled posts by date and shows the platform badge", async () => {
    mockFetchRouter();
    render(<ContentCalendarClient />);
    await waitFor(() => expect(screen.getByTestId("calendar-groups")).toBeInTheDocument());
    expect(screen.getByText(/Foto unit terbaru/)).toBeInTheDocument();
    expect(screen.getByText("IG")).toBeInTheDocument();
  });

  it("shows an empty state when there is no scheduled content", async () => {
    mockFetchRouter([]);
    render(<ContentCalendarClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });
});
