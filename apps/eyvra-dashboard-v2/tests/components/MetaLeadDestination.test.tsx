import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MetaLeadDestination } from "@/components/listings/MetaLeadDestination";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("clears the previous number on Page changes and offers only the linked business number", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        adAccountId: "act_123",
        pages: [
          { id: "1", name: "BSD", whatsappNumber: "+62812" },
          { id: "2", name: "Other", whatsappNumber: null },
        ],
      }),
    })),
  );
  const change = vi.fn();
  const view = render(<MetaLeadDestination pageId="1" number="+62812" onChange={change} />);
  const page = await screen.findByLabelText("Facebook Page");
  expect(screen.getByRole("option", { name: "+62812" })).toBeInTheDocument();
  fireEvent.change(page, { target: { value: "2" } });
  expect(change).toHaveBeenCalledWith("2", "act_123", "");
  view.rerender(<MetaLeadDestination pageId="2" number="" onChange={change} />);
  expect(screen.getByLabelText("WhatsApp Business Tujuan")).toBeDisabled();
  expect(screen.queryByRole("option", { name: "+62812" })).not.toBeInTheDocument();
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
