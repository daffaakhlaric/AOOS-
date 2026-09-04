import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectSalesClient } from "@/components/sosmed/ConnectSalesClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("ConnectSalesClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects the browser to the real authorizeUrl on a valid token", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ authorizeUrl: "https://facebook.com/dialog/oauth?client_id=1" }),
    ) as unknown as typeof fetch;
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "" },
    });

    render(<ConnectSalesClient token="tok-1" />);
    await waitFor(() =>
      expect(window.location.href).toBe("https://facebook.com/dialog/oauth?client_id=1"),
    );

    Object.defineProperty(window, "location", { writable: true, value: originalLocation });
  });

  it("shows a real, honest error for an expired/used token instead of a fabricated success state", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "Connect link sudah kedaluwarsa." } }, 400),
    ) as unknown as typeof fetch;

    render(<ConnectSalesClient token="expired-token" />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
    expect(screen.getByText(/sudah kedaluwarsa/)).toBeInTheDocument();
  });
});
