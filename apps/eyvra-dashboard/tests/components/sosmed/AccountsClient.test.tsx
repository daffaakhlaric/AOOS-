import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountsClient } from "@/components/sosmed/AccountsClient";
import type { SosmedAccountDto } from "@/types/sosmed.types";

const OFFICIAL_ACCOUNT: SosmedAccountDto = {
  id: "a-1",
  tenantId: "t-1",
  platform: "FACEBOOK",
  accountType: "OFFICIAL",
  accountName: "Mobix by DSS Motor",
  maskedAccessToken: "***abcd",
  followerCount: 12400,
  status: "CONNECTED",
  createdAt: "2026-08-01T00:00:00.000Z",
};

const SALES_ACCOUNT: SosmedAccountDto = {
  id: "a-2",
  tenantId: "t-1",
  salesHumanId: "sales-1",
  platform: "INSTAGRAM",
  accountType: "SALES_PERSONAL",
  accountName: "Ahmad Fauzi Sales",
  username: "ahmadfauzimobix",
  maskedAccessToken: "***wxyz",
  followerCount: 521,
  status: "CONNECTED",
  createdAt: "2026-08-01T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetchRouter(
  overrides: Partial<{
    accounts: () => Response;
    officialStart: () => Response;
    connectLinks: () => Response;
    disconnect: () => Response;
  }> = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "/api/sosmed/accounts" && init?.method === undefined) {
      return (
        overrides.accounts?.() ?? jsonResponse({ accounts: [OFFICIAL_ACCOUNT, SALES_ACCOUNT] })
      );
    }
    if (url === "/api/sosmed/oauth/official/start") {
      return (
        overrides.officialStart?.() ??
        jsonResponse({ authorizeUrl: "https://facebook.com/dialog/oauth" })
      );
    }
    if (url === "/api/sosmed/oauth/sales/connect-links" && init?.method === "POST") {
      return (
        overrides.connectLinks?.() ??
        jsonResponse(
          {
            token: "tok-1",
            expiresAt: "2026-08-25T00:00:00.000Z",
            connectUrl: "https://app.aaos.id/connect/sales/tok-1",
          },
          201,
        )
      );
    }
    if (url === "/api/sosmed/accounts/a-1" && init?.method === "DELETE") {
      return overrides.disconnect?.() ?? new Response(null, { status: 204 });
    }
    throw new Error(`unexpected fetch: ${url} ${init?.method ?? "GET"}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("AccountsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("splits accounts into Official and Sales Personal lists", async () => {
    mockFetchRouter();
    render(<AccountsClient />);
    await waitFor(() => expect(screen.getByTestId("official-accounts-list")).toBeInTheDocument());
    expect(screen.getByText(/Mobix by DSS Motor/)).toBeInTheDocument();
    expect(screen.getByTestId("sales-accounts-list")).toBeInTheDocument();
    expect(screen.getByText(/Ahmad Fauzi Sales/)).toBeInTheDocument();
  });

  it("+ Hubungkan Akun Official redirects the browser to the real authorizeUrl", async () => {
    mockFetchRouter();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "" },
    });
    render(<AccountsClient />);
    await waitFor(() => expect(screen.getByTestId("official-accounts-list")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "+ Hubungkan Akun Official" }));
    await waitFor(() => expect(window.location.href).toBe("https://facebook.com/dialog/oauth"));
    Object.defineProperty(window, "location", { writable: true, value: originalLocation });
  });

  it("Generate Link calls the real connect-links endpoint and shows the generated URL", async () => {
    mockFetchRouter();
    render(<AccountsClient />);
    await waitFor(() => expect(screen.getByTestId("sales-accounts-list")).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText("Sales Human ID"), "sales-1");
    await userEvent.click(screen.getByRole("button", { name: "Generate Link" }));
    await waitFor(() => expect(screen.getByTestId("generated-connect-link")).toBeInTheDocument());
    expect(screen.getByText(/connect\/sales\/tok-1/)).toBeInTheDocument();
  });

  it("Disconnect calls the real DELETE endpoint and refreshes the list", async () => {
    const fetchMock = mockFetchRouter();
    render(<AccountsClient />);
    await waitFor(() => expect(screen.getByTestId("official-accounts-list")).toBeInTheDocument());

    const disconnectButtons = screen.getAllByRole("button", { name: "Disconnect" });
    await userEvent.click(disconnectButtons[0] as HTMLElement);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sosmed/accounts/a-1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });
});
