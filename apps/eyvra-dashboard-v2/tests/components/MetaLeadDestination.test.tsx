import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MetaLeadDestination } from "@/components/listings/MetaLeadDestination";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps the chosen WhatsApp number on Page change — they are independent real Business assets", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        adAccountId: "act_123",
        pages: [
          { id: "1", name: "BSD" },
          { id: "2", name: "Other" },
        ],
        whatsappNumbers: [
          { phoneNumberId: "p1", displayNumber: "+62812", wabaId: "w1", wabaName: "Agen Pintar" },
        ],
      }),
    })),
  );
  const change = vi.fn();
  const view = render(<MetaLeadDestination pageId="1" number="+62812" onChange={change} />);
  const page = await screen.findByLabelText("Facebook Page");
  expect(screen.getByRole("option", { name: "+62812 · Agen Pintar" })).toBeInTheDocument();
  fireEvent.change(page, { target: { value: "2" } });
  // Switching Page keeps the already-chosen WhatsApp number, since the two are independent picks
  // from the same Business — not a Page-level join.
  expect(change).toHaveBeenCalledWith("2", "act_123", "+62812");
  view.rerender(<MetaLeadDestination pageId="2" number="+62812" onChange={change} />);
  expect(screen.getByLabelText("WhatsApp Business Tujuan")).not.toBeDisabled();
  expect(screen.getByRole("option", { name: "+62812 · Agen Pintar" })).toBeInTheDocument();
});
it("clears both Page and number when the Page is cleared", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        adAccountId: "act_123",
        pages: [{ id: "1", name: "BSD" }],
        whatsappNumbers: [
          { phoneNumberId: "p1", displayNumber: "+62812", wabaId: "w1", wabaName: "Agen Pintar" },
        ],
      }),
    })),
  );
  const change = vi.fn();
  render(<MetaLeadDestination pageId="1" number="+62812" onChange={change} />);
  const page = await screen.findByLabelText("Facebook Page");
  fireEvent.change(page, { target: { value: "" } });
  expect(change).toHaveBeenCalledWith("", "", "");
});
it("disables the WhatsApp select and explains honestly when the Business has no verified numbers", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        adAccountId: "act_123",
        pages: [{ id: "1", name: "BSD" }],
        whatsappNumbers: [],
      }),
    })),
  );
  render(<MetaLeadDestination pageId="" number="" onChange={vi.fn()} />);
  expect(await screen.findByLabelText("WhatsApp Business Tujuan")).toBeDisabled();
  expect(screen.getByText(/Belum ada nomor WhatsApp Business terverifikasi/)).toBeInTheDocument();
});
it("shows connection failures without inventing assets", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, json: async () => ({ message: "Hubungkan Meta Ads" }) })),
  );
  render(<MetaLeadDestination pageId="" number="" onChange={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Hubungkan Meta Ads");
  expect(screen.queryByLabelText("Facebook Page")).not.toBeInTheDocument();
});
