import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => searchParams,
}));

const useSalesSession = vi.fn();
vi.mock("@/lib/session", () => ({ useSalesSession: () => useSalesSession() }));

import { ClosingForm } from "@/components/closing/ClosingForm";

describe("ClosingForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    searchParams = new URLSearchParams();
  });

  it("prefills leadId from the ?leadId= query param", () => {
    searchParams = new URLSearchParams({ leadId: "lead-1" });
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    render(<ClosingForm />);
    expect(screen.getByPlaceholderText("Lead ID")).toHaveValue("lead-1");
  });

  it("renders test drive / SPK / batal radio buttons", () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    render(<ClosingForm />);
    expect(screen.getByLabelText("Test Drive")).toBeInTheDocument();
    expect(screen.getByLabelText("SPK")).toBeInTheDocument();
    expect(screen.getByLabelText("Batal")).toBeInTheDocument();
  });

  it("komisi Rp is auto-calculated from % + harga", async () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    render(<ClosingForm />);
    await userEvent.type(screen.getByLabelText("Harga"), "195000000");
    await userEvent.type(screen.getByLabelText("Komisi (%)"), "3");
    expect(screen.getByTestId("commission-idr")).toHaveTextContent("5.850.000");
  });

  it("submit → POST /api/closings", async () => {
    searchParams = new URLSearchParams({ leadId: "lead-1" });
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "closing-1" }), { status: 201 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ClosingForm />);
    await userEvent.click(screen.getByLabelText("SPK"));
    await userEvent.type(screen.getByLabelText("Harga"), "195000000");
    await userEvent.click(screen.getByRole("button", { name: "✅ Simpan Closing" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/closings");
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body["leadId"]).toBe("lead-1");
    expect(body["closingType"]).toBe("SPK");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/closing"));
  });

  it("validation: harga required for SPK", async () => {
    searchParams = new URLSearchParams({ leadId: "lead-1" });
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ClosingForm />);
    await userEvent.click(screen.getByLabelText("SPK"));
    await userEvent.click(screen.getByRole("button", { name: "✅ Simpan Closing" }));
    expect(screen.getByText("Harga wajib diisi untuk SPK.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validation: leadId required", async () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    render(<ClosingForm />);
    await userEvent.click(screen.getByRole("button", { name: "✅ Simpan Closing" }));
    expect(screen.getByText("Lead wajib diisi.")).toBeInTheDocument();
  });
});
