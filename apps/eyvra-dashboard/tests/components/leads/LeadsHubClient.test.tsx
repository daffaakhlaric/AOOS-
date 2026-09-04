import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/components/clara/ContactsClient", () => ({
  ContactsClient: () => <div data-testid="real-contacts-client" />,
}));
vi.mock("@/components/clara/RecyclingClient", () => ({
  RecyclingClient: () => <div data-testid="real-recycling-client" />,
}));
vi.mock("@/components/knowledge/KnowledgeClient", () => ({
  KnowledgeClient: () => <div data-testid="real-knowledge-client" />,
}));
vi.mock("@/components/clara/ClaraInboxClient", () => ({
  ClaraInboxClient: ({ initialLeadId }: { readonly initialLeadId?: string }) => (
    <div data-testid="real-clara-inbox-client">{initialLeadId ?? "no-lead"}</div>
  ),
}));
vi.mock("@/components/leads/LeadPipelineBoard", () => ({
  LeadPipelineBoard: () => <div data-testid="real-lead-pipeline-board" />,
}));

import { LeadsHubClient } from "@/components/leads/LeadsHubClient";

function mockFetchOnce(body: unknown): void {
  global.fetch = vi.fn(
    async () => new Response(JSON.stringify(body), { status: 200 }),
  ) as unknown as typeof fetch;
}

describe("LeadsHubClient (EYVRA MENU RESTRUCTURE Sprint 2, /leads)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the 'pipeline' tab and renders the real LeadPipelineBoard", () => {
    mockFetchOnce({ leads: [] });
    render(<LeadsHubClient />);
    expect(screen.getByTestId("leads-tab-pipeline")).toBeInTheDocument();
    expect(screen.getByTestId("real-lead-pipeline-board")).toBeInTheDocument();
  });

  it("deep-links to ?tab=semua (Sprint 1's real /clara/contacts redirect target) and renders ContactsClient", () => {
    mockFetchOnce({ leads: [] });
    render(<LeadsHubClient initialTab="semua" />);
    expect(screen.getByTestId("real-contacts-client")).toBeInTheDocument();
  });

  it("deep-links to ?tab=recycling (Sprint 1's real /clara/recycling redirect target) and renders RecyclingClient", () => {
    mockFetchOnce({ leads: [] });
    render(<LeadsHubClient initialTab="recycling" />);
    expect(screen.getByTestId("real-recycling-client")).toBeInTheDocument();
  });

  it("deep-links to ?tab=knowledge-base (Sprint 1's real /clara/knowledge redirect target) and renders KnowledgeClient", () => {
    mockFetchOnce({ leads: [] });
    render(<LeadsHubClient initialTab="knowledge-base" />);
    expect(screen.getByTestId("real-knowledge-client")).toBeInTheDocument();
  });

  it("deep-links to ?tab=inbox&lead=:id and renders ClaraInboxClient with the real initialLeadId threaded through", () => {
    mockFetchOnce({ leads: [] });
    render(<LeadsHubClient initialTab="inbox" initialLeadId="lead-42" />);
    expect(screen.getByTestId("real-clara-inbox-client")).toHaveTextContent("lead-42");
  });

  it("clicking a tab switches the rendered body and updates the URL via router.replace", async () => {
    mockFetchOnce({ leads: [] });
    render(<LeadsHubClient />);
    await userEvent.click(screen.getByTestId("hub-tab-semua"));
    expect(screen.getByTestId("leads-tab-semua")).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/leads?tab=semua", { scroll: false });
  });

  it("fetches /api/leads and renders the real HOT/WARM/COLD KPI mini counts", async () => {
    mockFetchOnce({
      leads: [
        { id: "1", leadPhone: "1", status: "NEW", temperature: "HOT", score: 90, createdAt: "" },
        { id: "2", leadPhone: "2", status: "NEW", temperature: "WARM", score: 50, createdAt: "" },
        { id: "3", leadPhone: "3", status: "NEW", temperature: "COLD", score: 10, createdAt: "" },
        { id: "4", leadPhone: "4", status: "NEW", temperature: "HOT", score: 80, createdAt: "" },
      ],
    });
    render(<LeadsHubClient />);
    await waitFor(() => expect(screen.getByTestId("leads-kpi-mini")).toHaveTextContent("HOT: 2"));
    expect(screen.getByTestId("leads-kpi-mini")).toHaveTextContent("WARM: 1");
    expect(screen.getByTestId("leads-kpi-mini")).toHaveTextContent("COLD: 1");
  });

  it("'Lihat WA inbox ↗' links to the real Inbox tab", () => {
    mockFetchOnce({ leads: [] });
    render(<LeadsHubClient />);
    expect(screen.getByText("Lihat WA inbox ↗")).toHaveAttribute("href", "/leads?tab=inbox");
  });
});
