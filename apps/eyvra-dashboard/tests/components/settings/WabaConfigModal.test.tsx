import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WabaConfigModal } from "@/components/settings/WabaConfigModal";

describe("WabaConfigModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Add mode requires an access token before submitting", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<WabaConfigModal onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Cabang *"), "BINTARO");
    await userEvent.type(screen.getByLabelText("Nomor WA *"), "+628110000001");
    await userEvent.type(screen.getByLabelText("WABA ID *"), "w-1");
    await userEvent.type(screen.getByLabelText("Phone Number ID *"), "p-1");
    await userEvent.click(screen.getByRole("button", { name: "💾 Simpan" }));
    expect(await screen.findByText("Access Token wajib diisi.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs a new WABA config and calls onSaved", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "waba-1" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSaved = vi.fn();
    render(<WabaConfigModal onClose={vi.fn()} onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText("Cabang *"), "BINTARO");
    await userEvent.type(screen.getByLabelText("Nomor WA *"), "+628110000001");
    await userEvent.type(screen.getByLabelText("WABA ID *"), "w-1");
    await userEvent.type(screen.getByLabelText("Phone Number ID *"), "p-1");
    await userEvent.type(screen.getByLabelText(/Access Token/), "token-1");
    await userEvent.click(screen.getByRole("button", { name: "💾 Simpan" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/settings/waba");
    expect(init?.method).toBe("POST");
  });

  it("Edit mode allows saving with a blank access token (unchanged)", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "waba-1" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSaved = vi.fn();
    render(
      <WabaConfigModal
        editing={{
          id: "waba-1",
          branchId: "BINTARO",
          phoneNumber: "+628110000001",
          wabaId: "w-1",
          phoneNumberId: "p-1",
          maskedAccessToken: "tokxxxx",
          status: "ACTIVE",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "💾 Simpan" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/settings/waba/waba-1");
    expect(init?.method).toBe("PUT");
    const sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(sentBody["accessToken"]).toBeUndefined();
  });
});
