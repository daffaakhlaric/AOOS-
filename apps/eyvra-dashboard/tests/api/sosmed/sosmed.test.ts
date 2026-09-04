import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as GET_POSTS, POST as POST_POSTS } from "@/app/api/sosmed/posts/route";
import {
  DELETE as DELETE_POST,
  GET as GET_POST,
  PUT as PUT_POST,
} from "@/app/api/sosmed/posts/[id]/route";
import { POST as POST_PUBLISH_NOW } from "@/app/api/sosmed/posts/[id]/publish-now/route";
import { POST as POST_GENERATE_CAPTION } from "@/app/api/sosmed/generate-caption/route";
import { POST as POST_GENERATE_HASHTAGS } from "@/app/api/sosmed/generate-hashtags/route";
import { GET as GET_ACCOUNTS } from "@/app/api/sosmed/accounts/route";
import { DELETE as DELETE_ACCOUNT } from "@/app/api/sosmed/accounts/[id]/route";
import { GET as GET_OAUTH_OFFICIAL_START } from "@/app/api/sosmed/oauth/official/start/route";
import { POST as POST_CONNECT_LINKS } from "@/app/api/sosmed/oauth/sales/connect-links/route";
import { GET as GET_PUBLIC_CONNECT_START } from "@/app/api/sosmed/public/connect/[token]/start/route";

function requestWith(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/sosmed/posts");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

function fetchMockReturning(response: Response): ReturnType<typeof vi.fn> {
  return vi.fn(async () => response);
}

describe("/api/sosmed", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /posts proxies aaos-api's real GET /api/v1/sosmed/posts with a status filter", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.pathname).toBe("/api/v1/sosmed/posts");
      expect(url.searchParams.get("status")).toBe("SCHEDULED");
      return new Response(JSON.stringify([{ id: "p-1", status: "SCHEDULED" }]), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET_POSTS(requestWith({ status: "SCHEDULED" }));
    const body = (await response.json()) as { posts: unknown[] };
    expect(body.posts).toHaveLength(1);
  });

  it("POST /posts forwards the create body and returns 201", async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      expect(JSON.parse(init?.body as string)).toMatchObject({ caption: "Halo dunia" });
      return new Response(JSON.stringify({ id: "p-1", status: "DRAFT" }), { status: 201 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await POST_POSTS(postRequest({ caption: "Halo dunia", status: "DRAFT" }));
    expect(response.status).toBe(201);
  });

  it("GET /posts/:id proxies the real single-post lookup", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.pathname).toBe("/api/v1/sosmed/posts/p-1");
      return new Response(JSON.stringify({ id: "p-1" }), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET_POST({} as NextRequest, { params: { id: "p-1" } });
    const body = (await response.json()) as { post: { id: string } };
    expect(body.post.id).toBe("p-1");
  });

  it("PUT /posts/:id forwards the patch body", async () => {
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      expect(url.pathname).toBe("/api/v1/sosmed/posts/p-1");
      expect(JSON.parse(init?.body as string)).toEqual({ status: "CANCELLED" });
      return new Response(JSON.stringify({ id: "p-1", status: "CANCELLED" }), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await PUT_POST(postRequest({ status: "CANCELLED" }), {
      params: { id: "p-1" },
    });
    const body = (await response.json()) as { post: { status: string } };
    expect(body.post.status).toBe("CANCELLED");
  });

  it("DELETE /posts/:id returns 204 on success", async () => {
    global.fetch = fetchMockReturning(
      new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;
    const response = await DELETE_POST({} as NextRequest, { params: { id: "p-1" } });
    expect(response.status).toBe(204);
  });

  it("POST /posts/:id/publish-now proxies the real publish call", async () => {
    global.fetch = fetchMockReturning(
      new Response(JSON.stringify({ id: "p-1", status: "PUBLISHED" }), { status: 200 }),
    ) as unknown as typeof fetch;
    const response = await POST_PUBLISH_NOW(postRequest(undefined), { params: { id: "p-1" } });
    const body = (await response.json()) as { post: { status: string } };
    expect(body.post.status).toBe("PUBLISHED");
  });

  it("POST /generate-caption proxies aaos-api's real Samantha caption generator", async () => {
    global.fetch = fetchMockReturning(
      new Response(
        JSON.stringify({
          available: true,
          instagramCaption: "IG caption",
          facebookCaption: "FB caption",
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const response = await POST_GENERATE_CAPTION(
      postRequest({
        contentType: "PROMO",
        productRef: "Xpander",
        angle: "DP",
        tone: "FRIENDLY",
        vertical: "AUTOMOTIVE",
      }),
    );
    const body = (await response.json()) as { available: boolean };
    expect(body.available).toBe(true);
  });

  it("POST /generate-caption forwards the real LLM-unavailable degraded response honestly", async () => {
    global.fetch = fetchMockReturning(
      new Response(JSON.stringify({ available: false, reason: "NO_API_KEY", message: "..." }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;
    const response = await POST_GENERATE_CAPTION(postRequest({}));
    const body = (await response.json()) as { available: boolean };
    expect(body.available).toBe(false);
  });

  it("POST /generate-hashtags proxies aaos-api's real hashtag generator", async () => {
    global.fetch = fetchMockReturning(
      new Response(JSON.stringify({ available: true, hashtags: ["#A", "#B"] }), { status: 200 }),
    ) as unknown as typeof fetch;
    const response = await POST_GENERATE_HASHTAGS(postRequest({}));
    const body = (await response.json()) as { available: boolean; hashtags?: string[] };
    expect(body.hashtags).toEqual(["#A", "#B"]);
  });

  it("GET /accounts proxies the real, masked account list", async () => {
    global.fetch = fetchMockReturning(
      new Response(JSON.stringify([{ id: "a-1", maskedAccessToken: "***abcd" }]), { status: 200 }),
    ) as unknown as typeof fetch;
    const response = await GET_ACCOUNTS();
    const body = (await response.json()) as { accounts: unknown[] };
    expect(body.accounts).toHaveLength(1);
  });

  it("DELETE /accounts/:id disconnects the real account", async () => {
    global.fetch = fetchMockReturning(
      new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;
    const response = await DELETE_ACCOUNT({} as NextRequest, { params: { id: "a-1" } });
    expect(response.status).toBe(204);
  });

  it("GET /oauth/official/start proxies the real Meta OAuth authorize URL", async () => {
    global.fetch = fetchMockReturning(
      new Response(JSON.stringify({ authorizeUrl: "https://facebook.com/dialog/oauth?..." }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;
    const response = await GET_OAUTH_OFFICIAL_START();
    const body = (await response.json()) as { authorizeUrl: string };
    expect(body.authorizeUrl).toContain("facebook.com");
  });

  it("POST /oauth/sales/connect-links forwards salesHumanId and returns the real generated link", async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      expect(JSON.parse(init?.body as string)).toEqual({ salesHumanId: "sales-1" });
      return new Response(
        JSON.stringify({
          token: "tok-1",
          expiresAt: "2026-08-25T00:00:00.000Z",
          connectUrl: "https://app.aaos.id/connect/sales/tok-1",
        }),
        { status: 201 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await POST_CONNECT_LINKS(postRequest({ salesHumanId: "sales-1" }));
    expect(response.status).toBe(201);
  });

  it("GET /public/connect/:token/start proxies the real public sales OAuth start (no session gate)", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.pathname).toBe("/api/v1/sosmed/oauth/sales/tok-1/start");
      return new Response(
        JSON.stringify({ authorizeUrl: "https://facebook.com/dialog/oauth?..." }),
        {
          status: 200,
        },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET_PUBLIC_CONNECT_START({} as NextRequest, {
      params: { token: "tok-1" },
    });
    const body = (await response.json()) as { authorizeUrl: string };
    expect(body.authorizeUrl).toContain("facebook.com");
  });

  it("GET /public/connect/:token/start surfaces an expired/used token's real error honestly", async () => {
    global.fetch = fetchMockReturning(
      new Response(
        JSON.stringify({ message: "Connect link sudah kedaluwarsa atau sudah dipakai." }),
        {
          status: 400,
        },
      ),
    ) as unknown as typeof fetch;
    const response = await GET_PUBLIC_CONNECT_START({} as NextRequest, {
      params: { token: "expired" },
    });
    expect(response.status).toBe(400);
  });
});
