import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { ContentStudioClient } from "@/components/sosmed/ContentStudioClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetchRouter(
  overrides: Partial<{
    caption: () => Response;
    hashtags: () => Response;
    accounts: () => Response;
    createPost: () => Response;
    settings: () => Response;
  }> = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "/api/settings") {
      return overrides.settings?.() ?? jsonResponse({ tenant: { vertical: "AUTOMOTIVE" } });
    }
    if (url === "/api/sosmed/generate-caption") {
      return (
        overrides.caption?.() ??
        jsonResponse({
          available: true,
          instagramCaption: "Caption IG generated",
          facebookCaption: "Caption FB generated",
        })
      );
    }
    if (url === "/api/sosmed/generate-hashtags") {
      return (
        overrides.hashtags?.() ?? jsonResponse({ available: true, hashtags: ["#Mobix", "#Cinere"] })
      );
    }
    if (url === "/api/sosmed/accounts") {
      return overrides.accounts?.() ?? jsonResponse({ accounts: [] });
    }
    if (url === "/api/sosmed/posts" && init?.method === "POST") {
      return overrides.createPost?.() ?? jsonResponse({ post: { id: "p-1" } }, 201);
    }
    throw new Error(`unexpected fetch: ${url} ${init?.method ?? "GET"}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("ContentStudioClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Auto mode step 1 -> generate calls the real caption + hashtag endpoints and shows results", async () => {
    mockFetchRouter();
    render(<ContentStudioClient />);

    await userEvent.type(screen.getByLabelText("Unit/Listing"), "Xpander Cross 2019");
    await userEvent.type(screen.getByLabelText("Angle"), "DP Ringan");
    await userEvent.click(screen.getByRole("button", { name: /Generate Konten/ }));

    await waitFor(() =>
      expect(screen.getByLabelText("Caption (IG)")).toHaveValue("Caption IG generated"),
    );
    expect(screen.getByTestId("hashtag-chips")).toHaveTextContent("#Mobix");
  });

  it("shows the real degraded LLM-unavailable message instead of fabricating a caption", async () => {
    mockFetchRouter({
      caption: () =>
        jsonResponse({
          available: false,
          reason: "NO_API_KEY",
          message: "Aktifkan AI Analysis...",
        }),
    });
    render(<ContentStudioClient />);

    await userEvent.type(screen.getByLabelText("Unit/Listing"), "Xpander Cross 2019");
    await userEvent.type(screen.getByLabelText("Angle"), "DP Ringan");
    await userEvent.click(screen.getByRole("button", { name: /Generate Konten/ }));

    await waitFor(() => expect(screen.getByText(/Aktifkan AI Analysis/)).toBeInTheDocument());
  });

  it("Manual mode submits a real DRAFT post via POST /api/sosmed/posts", async () => {
    const fetchMock = mockFetchRouter();
    render(<ContentStudioClient />);

    await userEvent.click(screen.getByRole("button", { name: /Manual — Saya buat sendiri/ }));
    await userEvent.type(screen.getByLabelText("Caption"), "Halo dari Mobix");
    await userEvent.click(screen.getByRole("button", { name: "Simpan sebagai Draft" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sosmed/posts",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
