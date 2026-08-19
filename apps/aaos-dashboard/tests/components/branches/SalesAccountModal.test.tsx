import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SalesAccountModal } from "@/components/branches/SalesAccountModal";
import type { SalesHumanAccountDto } from "@/types/sales-human-account.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const EXISTING: SalesHumanAccountDto = {
  id: "sales-1",
  name: "Budi",
  email: "budi@mobix.id",
  phone: "+628120000001",
  branchId: "BINTARO",
  status: "ON",
  maxLeadsPerDay: 10,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: undefined,
};

describe("SalesAccountModal — Add mode", () => {
  afterEach(() => vi.restoreAllMocks());

  it("validates name/email/password before submitting", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const onSaved = vi.fn();
    render(<SalesAccountModal branchId="BINTARO" onClose={vi.fn()} onSaved={onSaved} />);
    await userEvent.click(screen.getByRole("button", { name: "✓ Tambah Sales" }));
    expect(screen.getByText("Nama lengkap wajib diisi.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("POSTs the new sales human and calls onSaved on success", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ salesHuman: EXISTING }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSaved = vi.fn();

    render(<SalesAccountModal branchId="BINTARO" onClose={vi.fn()} onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText(/Nama Lengkap/), "Ahmad Fauzi");
    await userEvent.type(screen.getByLabelText(/Email/), "ahmad@mobix.id");
    await userEvent.type(screen.getByLabelText(/^Password \*/), "password123");
    await userEvent.type(screen.getByLabelText(/Konfirmasi Password/), "password123");
    await userEvent.click(screen.getByRole("button", { name: "✓ Tambah Sales" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sales-humans",
      expect.objectContaining({ method: "POST" }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("shows the real upstream error message (e.g. duplicate email) instead of a generic one", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: 'Email "x@mobix.id" sudah terdaftar' } }, 409),
    ) as unknown as typeof fetch;

    render(<SalesAccountModal branchId="BINTARO" onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Nama Lengkap/), "Ahmad");
    await userEvent.type(screen.getByLabelText(/Email/), "x@mobix.id");
    await userEvent.type(screen.getByLabelText(/^Password \*/), "password123");
    await userEvent.type(screen.getByLabelText(/Konfirmasi Password/), "password123");
    await userEvent.click(screen.getByRole("button", { name: "✓ Tambah Sales" }));

    expect(await screen.findByText(/sudah terdaftar/)).toBeInTheDocument();
  });
});

describe("SalesAccountModal — Edit mode", () => {
  afterEach(() => vi.restoreAllMocks());

  it("pre-fills fields and allows saving without a password (Password kosong = tidak berubah)", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ salesHuman: EXISTING }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSaved = vi.fn();

    render(
      <SalesAccountModal
        branchId="BINTARO"
        editing={EXISTING}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByDisplayValue("Budi")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "✓ Simpan" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sales-humans/sales-1",
      expect.objectContaining({ method: "PUT" }),
    );
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body["password"]).toBeUndefined();
    expect(onSaved).toHaveBeenCalled();
  });
});
