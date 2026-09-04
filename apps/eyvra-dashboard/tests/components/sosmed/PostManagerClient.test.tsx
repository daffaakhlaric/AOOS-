import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PostManagerClient } from "@/components/sosmed/PostManagerClient";
import type { ScheduledPostDto } from "@/types/sosmed.types";

const SCHEDULED_POST: ScheduledPostDto = {
  id: "p-1",
  tenantId: "t-1",
  caption: "Xpander Cross 2019 DP 29jt siap bawa keluarga",
  hashtags: ["#MobixCinere", "#XpanderCross"],
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

const PUBLISHED_POST: ScheduledPostDto = {
  ...SCHEDULED_POST,
  id: "p-2",
  status: "PUBLISHED",
  scheduledAt: undefined,
  reach: 1204,
  likes: 48,
  comments: 7,
  shares: 3,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetchRouter(
  byStatus: Partial<Record<string, readonly ScheduledPostDto[]>>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (
      url.startsWith("/api/sosmed/posts?status=") &&
      (init?.method === undefined || init.method === "GET")
    ) {
      const status = url.split("=")[1] ?? "";
      return jsonResponse({ posts: byStatus[status] ?? [] });
    }
    if (url.match(/\/api\/sosmed\/posts\/p-1\/publish-now/) && init?.method === "POST") {
      return jsonResponse({ post: { ...SCHEDULED_POST, status: "PUBLISHED" } });
    }
    if (url === "/api/sosmed/posts/p-1" && init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    throw new Error(`unexpected fetch: ${url} ${init?.method ?? "GET"}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("PostManagerClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the Terjadwal tab by default with the real scheduled posts", async () => {
    mockFetchRouter({ SCHEDULED: [SCHEDULED_POST] });
    render(<PostManagerClient />);
    await waitFor(() => expect(screen.getByTestId("post-manager-list")).toBeInTheDocument());
    expect(screen.getByText(/Xpander Cross 2019/)).toBeInTheDocument();
  });

  it("shows an empty state for a tab with no posts", async () => {
    mockFetchRouter({ SCHEDULED: [] });
    render(<PostManagerClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("switching to Sudah Post shows reach/like/comment/share for published posts", async () => {
    mockFetchRouter({ SCHEDULED: [SCHEDULED_POST], PUBLISHED: [PUBLISHED_POST] });
    render(<PostManagerClient />);
    await waitFor(() => expect(screen.getByTestId("post-manager-list")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("tab", { name: "Sudah Post" }));
    await waitFor(() => expect(screen.getByText(/Reach: 1.204/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Post Sekarang" })).not.toBeInTheDocument();
  });

  it("Post Sekarang calls the real publish-now endpoint and refreshes the list", async () => {
    const fetchMock = mockFetchRouter({ SCHEDULED: [SCHEDULED_POST] });
    render(<PostManagerClient />);
    await waitFor(() => expect(screen.getByTestId("post-manager-list")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Post Sekarang" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sosmed/posts/p-1/publish-now",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("Batalkan calls the real DELETE endpoint", async () => {
    const fetchMock = mockFetchRouter({ SCHEDULED: [SCHEDULED_POST] });
    render(<PostManagerClient />);
    await waitFor(() => expect(screen.getByTestId("post-manager-list")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Batalkan" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sosmed/posts/p-1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });
});
