import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClaimButton } from "@/components/leads/ClaimButton";

describe("ClaimButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("click calls POST /api/leads/:id/claim with salesHumanId", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "lead-1" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ClaimButton leadId="lead-1" salesHumanId="sales-rina" />);
    await userEvent.click(screen.getByRole("button", { name: "Claim Lead →" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/leads/lead-1/claim");
    expect(JSON.parse(options.body as string)).toEqual({ salesHumanId: "sales-rina" });
  });

  it("shows a loading state while claiming", async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ClaimButton leadId="lead-1" salesHumanId="sales-rina" />);
    await userEvent.click(screen.getByRole("button", { name: "Claim Lead →" }));
    expect(screen.getByRole("button", { name: "Memproses..." })).toBeDisabled();
    await act(async () => {
      resolveFetch(new Response(JSON.stringify({ id: "lead-1" }), { status: 200 }));
    });
  });

  it("success → button changes to 'Diklaim'", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ id: "lead-1" }), { status: 200 }),
    ) as unknown as typeof fetch;
    const onClaimed = vi.fn();
    render(<ClaimButton leadId="lead-1" salesHumanId="sales-rina" onClaimed={onClaimed} />);
    await userEvent.click(screen.getByRole("button", { name: "Claim Lead →" }));
    await waitFor(() =>
      expect(screen.getByTestId("claim-status-claimed")).toHaveTextContent("Diklaim"),
    );
    expect(onClaimed).toHaveBeenCalledTimes(1);
  });

  it("error 409 → shows 'Sudah diklaim' toast", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 409 }),
    ) as unknown as typeof fetch;
    render(<ClaimButton leadId="lead-1" salesHumanId="sales-rina" />);
    await userEvent.click(screen.getByRole("button", { name: "Claim Lead →" }));
    await waitFor(() =>
      expect(screen.getByTestId("claim-error")).toHaveTextContent("Sudah diklaim"),
    );
  });

  it("a generic failure shows a retry-oriented error message", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    render(<ClaimButton leadId="lead-1" salesHumanId="sales-rina" />);
    await userEvent.click(screen.getByRole("button", { name: "Claim Lead →" }));
    await waitFor(() =>
      expect(screen.getByTestId("claim-error")).toHaveTextContent("Gagal klaim lead"),
    );
  });
});
