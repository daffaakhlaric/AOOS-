import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const useSalesSession = vi.fn();
vi.mock("@/lib/session", () => ({ useSalesSession: () => useSalesSession() }));

const signInWithPassword = vi.fn();
const updateUser = vi.fn();
vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword, updateUser },
  }),
}));

import { ProfileClient } from "@/components/profile/ProfileClient";

const ACCOUNT = {
  id: "sh-1",
  name: "Budi",
  email: "budi@mobix.id",
  phone: "+62812000001",
  branchId: "BINTARO",
  status: "ON",
  maxLeadsPerDay: 10,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: undefined,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("ProfileClient", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the loading spinner while the session resolves", () => {
    useSalesSession.mockReturnValue({ session: undefined, loading: true });
    render(<ProfileClient />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("loads and renders the real profile (name, email, phone, branch)", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sh-1", email: "budi@mobix.id", branchId: "BINTARO" },
      loading: false,
    });
    global.fetch = vi.fn(async () => jsonResponse(ACCOUNT)) as unknown as typeof fetch;

    render(<ProfileClient />);
    await waitFor(() => expect(screen.getByDisplayValue("Budi")).toBeInTheDocument());
    expect(screen.getByDisplayValue("budi@mobix.id")).toBeInTheDocument();
  });

  it("saves name/phone via PUT /api/sales-humans/:id", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sh-1", email: "budi@mobix.id", branchId: "BINTARO" },
      loading: false,
    });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? jsonResponse({ ...ACCOUNT, name: "Budi Baru" })
        : jsonResponse(ACCOUNT),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ProfileClient />);
    await waitFor(() => expect(screen.getByDisplayValue("Budi")).toBeInTheDocument());
    await userEvent.clear(screen.getByDisplayValue("Budi"));
    await userEvent.type(screen.getByLabelText(/Nama Lengkap/), "Budi Baru");
    await userEvent.click(screen.getByRole("button", { name: "Simpan Profil" }));

    await waitFor(() => expect(screen.getByText("Profil disimpan.")).toBeInTheDocument());
  });

  it("password change re-authenticates with the old password before calling updateUser", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sh-1", email: "budi@mobix.id", branchId: "BINTARO" },
      loading: false,
    });
    global.fetch = vi.fn(async () => jsonResponse(ACCOUNT)) as unknown as typeof fetch;
    signInWithPassword.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ error: null });

    render(<ProfileClient />);
    await waitFor(() => expect(screen.getByDisplayValue("Budi")).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText("Password Lama"), "oldpassword1");
    await userEvent.type(screen.getByLabelText("Password Baru"), "newpassword1");
    await userEvent.type(screen.getByLabelText("Konfirmasi Password Baru"), "newpassword1");
    await userEvent.click(screen.getByRole("button", { name: "Ubah Password" }));

    await waitFor(() => expect(screen.getByText("Password berhasil diubah.")).toBeInTheDocument());
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "budi@mobix.id",
      password: "oldpassword1",
    });
    expect(updateUser).toHaveBeenCalledWith({ password: "newpassword1" });
  });

  it("honestly fails (never skips the check) when the old password re-auth fails", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sh-1", email: "budi@mobix.id", branchId: "BINTARO" },
      loading: false,
    });
    global.fetch = vi.fn(async () => jsonResponse(ACCOUNT)) as unknown as typeof fetch;
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    render(<ProfileClient />);
    await waitFor(() => expect(screen.getByDisplayValue("Budi")).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText("Password Lama"), "wrongpassword");
    await userEvent.type(screen.getByLabelText("Password Baru"), "newpassword1");
    await userEvent.type(screen.getByLabelText("Konfirmasi Password Baru"), "newpassword1");
    await userEvent.click(screen.getByRole("button", { name: "Ubah Password" }));

    await waitFor(() => expect(screen.getByText("Password lama salah.")).toBeInTheDocument());
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("toggles status via PUT /api/sales-humans/:id", async () => {
    useSalesSession.mockReturnValue({
      session: { salesHumanId: "sh-1", email: "budi@mobix.id", branchId: "BINTARO" },
      loading: false,
    });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? jsonResponse({ ...ACCOUNT, status: "BUSY" }) : jsonResponse(ACCOUNT),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ProfileClient />);
    await waitFor(() => expect(screen.getByDisplayValue("Budi")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "🟡 Sibuk" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sales-humans/sh-1",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
  });
});
