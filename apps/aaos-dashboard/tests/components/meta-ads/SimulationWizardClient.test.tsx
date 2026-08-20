import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SimulationWizardClient } from "@/components/meta-ads/SimulationWizardClient";
import { writeCampaignsCache } from "@/lib/campaignsCache";
import type { AdAccountSummaryDto, SimulationStatusDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function metrics(overrides: Partial<AdAccountSummaryDto["totals"]> = {}) {
  return {
    spend: 1_000_000,
    clicks: 100,
    frequency: 1.0,
    conversations: 40,
    d2: 20,
    d3: 10,
    d5: 5,
    leadForm: 2,
    totalLead: 10,
    rphD3: null,
    rphLead: null,
    ...overrides,
  };
}

const DATA: AdAccountSummaryDto = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-11T00:00:00.000Z",
  campaigns: [],
  ads: [
    {
      id: "ad-refresh",
      stableId: "#C001",
      name: "Xpander Cross 2019",
      campaignName: "Campaign A",
      status: "ACTIVE",
      funnel: "DM",
      branch: "CINERE",
      verdict: "REFRESH",
      metrics: metrics({ frequency: 4.1 }),
    },
    {
      id: "ad-fine",
      stableId: "#C002",
      name: "Ad Fine",
      campaignName: "Campaign B",
      status: "ACTIVE",
      funnel: "DM",
      branch: "UMUM",
      verdict: "KEEP",
      metrics: metrics({ frequency: 1.2 }),
    },
  ],
  totals: metrics({}),
  campaignCount: 2,
  adCount: 2,
};

const DONE_STATUS: SimulationStatusDto = {
  id: "sim-1",
  status: "DONE",
  currentStep: "REVIEW",
  campaignDataSource: "cache",
  personaIds: ["ready_buyer"],
  logs: [
    {
      step: "TAMARA",
      level: "INFO",
      message: "Tamara selesai.",
      createdAt: "2026-08-13T00:00:00.000Z",
    },
  ],
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:05.000Z",
  result: {
    tamara: {
      available: true,
      temuan: [{ icon: "🔴", judul: "Frequency tinggi", detail: "detail" }],
      rekomendasi: [{ aksi: "FIX", target: "#C001", alasan: "alasan", estimasi: "hemat" }],
      ringkasan: "Ringkasan Tamara.",
      elapsedMs: 1200,
      coverageScore: 80,
    },
    kai: {
      available: true,
      brief: {
        unit: "Xpander Cross 2019",
        angle: "DP_RINGAN",
        branch: "CINERE",
        primaryMessage: "DP mulai 29 juta",
        tone: "casual",
        formats: ["VIDEO_15S"],
        avoid: [],
        urgency: "HIGH",
      },
      elapsedMs: 800,
      videoGenerated: false,
      note: "Video belum digenerate.",
    },
    jessy: {
      available: true,
      runs: [
        {
          personaId: "ready_buyer",
          ok: true,
          overallScore: 88,
          grade: "B",
          verdict: "APPROVED",
        },
      ],
      elapsedMs: 500,
    },
    scoring: {
      tamaraCoverageScore: 80,
      kaiScore: 100,
      jessyScore: 88,
      overallScore: 85.8,
      grade: "B",
      verdict: "GO",
    },
  },
};

describe("SimulationWizardClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(overrides: Record<string, () => Response | Promise<Response>> = {}): void {
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      for (const [pattern, handler] of Object.entries(overrides)) {
        if (url.includes(pattern)) {
          return handler();
        }
      }
      if (url.includes("/api/objective")) return jsonResponse({ objective: null });
      return jsonResponse({ error: { message: "unhandled in test" } }, 500);
    }) as unknown as typeof fetch;
  }

  it("shows the empty state when there is no cached campaign data", async () => {
    mockFetch();
    render(<SimulationWizardClient />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
  });

  it("Setup step lists every real ad (not just ones needing refresh) — real bug fix, an account with nothing flagged for refresh must still be able to start a simulation", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    mockFetch();
    render(<SimulationWizardClient />);

    const setup = await screen.findByTestId("wizard-step-setup");
    // Both the refresh-flagged ad and the unrelated "fine" ad are selectable.
    expect(setup.textContent).toContain("Xpander Cross 2019");
    expect(setup.textContent).toContain("Ad Fine");
    // Only the one that actually needs a refresh (verdict=REFRESH or frequency >= 3.5) is flagged.
    expect(screen.getByRole("button", { name: /⚠ #C001 Xpander Cross 2019/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^#C002 Ad Fine/ })).toBeInTheDocument();
  });

  it("'Mulai Simulasi Dry-Run' is not permanently stuck disabled when no ad needs a refresh", async () => {
    const noRefreshNeeded: AdAccountSummaryDto = {
      ...DATA,
      ads: [{ ...DATA.ads[1]!, id: "ad-only" }],
    };
    writeCampaignsCache({ data: noRefreshNeeded, fetchedAt: Date.now(), period: "last_30d" });
    mockFetch();
    render(<SimulationWizardClient />);

    await userEvent.click(await screen.findByRole("button", { name: /Ad Fine/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ready Buyer" }));
    expect(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ })).not.toBeDisabled();
  });

  it("starting a simulation posts to /api/simulation/start and renders the polled pipeline status", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    let startCallBody: unknown;
    mockFetch({
      "/api/simulation/start": () => {
        return (async () => {
          // capture the body via a side-channel since this mock only returns a Response
          return jsonResponse({ id: "sim-1", status: "RUNNING" }, 202);
        })();
      },
      "/api/simulation/sim-1/status": () => jsonResponse(DONE_STATUS),
    });
    // Wrap fetch to also capture the start request body for assertion below.
    const realFetch = global.fetch;
    global.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes("/api/simulation/start") && init?.body !== undefined) {
        startCallBody = JSON.parse(String(init.body));
      }
      return realFetch(input as never, init);
    }) as unknown as typeof fetch;

    render(<SimulationWizardClient />);

    await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ready Buyer" }));
    await userEvent.click(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ }));

    await waitFor(() => expect(screen.getByTestId("wizard-pipeline")).toBeInTheDocument());
    expect(startCallBody).toMatchObject({
      campaignDataSource: "cache",
      personaIds: ["ready_buyer"],
      kaiBranch: "CINERE",
    });

    await waitFor(() => expect(screen.getByText("Ringkasan Tamara.")).toBeInTheDocument());
    expect(screen.getByText("DP mulai 29 juta")).toBeInTheDocument();
    expect(screen.getByText(/88 \(B\)/)).toBeInTheDocument();

    // Step 6 review renders once the run is DONE with a real scored result.
    expect(await screen.findByTestId("wizard-step-review")).toBeInTheDocument();
    expect(screen.getByText("85.8")).toBeInTheDocument();
    expect(screen.getByText("GO")).toBeInTheDocument();
  });

  it("Approve on Step 6 records the decision via /api/simulation/:id/approve", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    mockFetch({
      "/api/simulation/start": () => jsonResponse({ id: "sim-1", status: "RUNNING" }, 202),
      "/api/simulation/sim-1/status": () => jsonResponse(DONE_STATUS),
      "/api/simulation/sim-1/approve": () =>
        jsonResponse({
          ...DONE_STATUS,
          decision: "APPROVED",
          decidedAt: "2026-08-13T00:00:10.000Z",
        }),
    });

    render(<SimulationWizardClient />);
    await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ready Buyer" }));
    await userEvent.click(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ }));

    await screen.findByTestId("wizard-step-review");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(screen.getByText(/Keputusan tercatat/)).toBeInTheDocument());
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
  });

  describe("Go Live (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4)", () => {
    const APPROVED_STATUS: SimulationStatusDto = {
      ...DONE_STATUS,
      decision: "APPROVED",
      decidedAt: "2026-08-13T00:00:10.000Z",
    };

    async function renderApprovedRun(
      extraOverrides: Record<string, () => Response | Promise<Response>> = {},
    ): Promise<void> {
      writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
      mockFetch({
        "/api/simulation/start": () => jsonResponse({ id: "sim-1", status: "RUNNING" }, 202),
        "/api/simulation/sim-1/status": () => jsonResponse(APPROVED_STATUS),
        "/api/simulation/sim-1/approve": () => jsonResponse(APPROVED_STATUS),
        ...extraOverrides,
      });
      render(<SimulationWizardClient />);
      await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));
      await userEvent.click(screen.getByRole("button", { name: "Ready Buyer" }));
      await userEvent.click(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ }));
      await screen.findByTestId("wizard-step-review");
    }

    it("shows the 🚀 Go Live button only once decision is APPROVED", async () => {
      await renderApprovedRun();
      expect(await screen.findByTestId("go-live-button")).toBeInTheDocument();
    });

    it("does NOT show the Go Live button before a decision is recorded", async () => {
      writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
      mockFetch({
        "/api/simulation/start": () => jsonResponse({ id: "sim-1", status: "RUNNING" }, 202),
        "/api/simulation/sim-1/status": () => jsonResponse(DONE_STATUS),
      });
      render(<SimulationWizardClient />);
      await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));
      await userEvent.click(screen.getByRole("button", { name: "Ready Buyer" }));
      await userEvent.click(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ }));
      await screen.findByTestId("wizard-step-review");
      expect(screen.queryByTestId("go-live-button")).not.toBeInTheDocument();
    });

    it("the Go Live confirm button stays disabled until 'GO LIVE' is typed and required fields are filled", async () => {
      await renderApprovedRun();
      await userEvent.click(await screen.findByTestId("go-live-button"));
      const confirmButton = screen.getByTestId("go-live-confirm-button");
      expect(confirmButton).toBeDisabled();

      await userEvent.type(screen.getByTestId("go-live-confirm-input"), "GO LIVE");
      expect(confirmButton).toBeDisabled(); // still missing hostedUrl/primaryText

      const urlInputs = screen.getAllByPlaceholderText(/storage\.googleapis\.com/);
      await userEvent.type(urlInputs[0]!, "https://storage.googleapis.com/aaos/creative.jpg");
      const inputs = screen.getAllByRole("textbox");
      const primaryTextInput = inputs[inputs.length - 1]!;
      await userEvent.type(primaryTextInput, "Promo!");

      expect(confirmButton).not.toBeDisabled();
    });

    it("submits GO LIVE and renders the resulting LIVE status + Rollback button", async () => {
      await renderApprovedRun({
        "/api/simulation/sim-1/go-live": () =>
          jsonResponse({
            ...APPROVED_STATUS,
            status: "LIVE",
            liveCampaignId: "campaign-live-1",
            liveAdId: "ad-live-1",
            liveAt: "2026-08-13T01:00:00.000Z",
          }),
      });
      await userEvent.click(await screen.findByTestId("go-live-button"));
      await userEvent.type(screen.getByTestId("go-live-confirm-input"), "GO LIVE");
      const urlInputs = screen.getAllByPlaceholderText(/storage\.googleapis\.com/);
      await userEvent.type(urlInputs[0]!, "https://storage.googleapis.com/aaos/creative.jpg");
      const inputs = screen.getAllByRole("textbox");
      await userEvent.type(inputs[inputs.length - 1]!, "Promo!");

      await userEvent.click(screen.getByTestId("go-live-confirm-button"));

      await waitFor(() => expect(screen.getByTestId("go-live-status")).toBeInTheDocument());
      expect(screen.getByText(/campaign-live-1/)).toBeInTheDocument();
      expect(screen.getByTestId("rollback-button")).toBeInTheDocument();
    });

    it("Rollback posts to /api/simulation/:id/rollback and renders the ROLLED_BACK state", async () => {
      const liveStatus: SimulationStatusDto = {
        ...APPROVED_STATUS,
        status: "LIVE",
        liveCampaignId: "campaign-live-1",
        liveAdId: "ad-live-1",
        liveAt: "2026-08-13T01:00:00.000Z",
      };
      writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
      mockFetch({
        "/api/simulation/start": () => jsonResponse({ id: "sim-1", status: "RUNNING" }, 202),
        "/api/simulation/sim-1/status": () => jsonResponse(liveStatus),
        "/api/simulation/sim-1/rollback": () =>
          jsonResponse({
            ...liveStatus,
            status: "ROLLED_BACK",
            rolledBackAt: "2026-08-13T01:30:00.000Z",
          }),
      });
      render(<SimulationWizardClient />);
      await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));
      await userEvent.click(screen.getByRole("button", { name: "Ready Buyer" }));
      await userEvent.click(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ }));
      await screen.findByTestId("go-live-status");

      await userEvent.click(screen.getByTestId("rollback-button"));
      await waitFor(() => expect(screen.getByText(/sudah di-rollback/)).toBeInTheDocument());
    });
  });

  it("shows an error card (not a silently blank section) when /api/objective returns a non-2xx response", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    mockFetch({
      "/api/objective": () => jsonResponse({ error: { message: "Gagal memuat objective." } }, 500),
    });
    render(<SimulationWizardClient />);

    const setup = await screen.findByTestId("wizard-step-setup");
    expect(await screen.findByText("Gagal memuat objective.")).toBeInTheDocument();
    // Real bug fix regression guard: the rest of Step 1 (ad list, persona picker) still renders —
    // an objective fetch failure must not blank out the whole setup step.
    expect(setup.textContent).toContain("Xpander Cross 2019");
  });

  describe("log panel + Campaign yang Akan Dibuat preview (AAOS-SIMULASI-TARGETING)", () => {
    /**
     * Same DONE status, plus a multi-step log (one line carrying a real `payload`) and a real
     * audience-targeting block — the interest is verbatim from a live Meta
     * `GET /search?type=adinterest` response (2026-08-18).
     */
    const STATUS_WITH_TARGETING: SimulationStatusDto = {
      ...DONE_STATUS,
      logs: [
        {
          step: "SETUP",
          level: "INFO",
          message: "Simulasi dimulai.",
          createdAt: "2026-08-18T00:00:00.000Z",
        },
        {
          step: "TAMARA",
          level: "INFO",
          message: "Tamara memilih 1 dari 2 kandidat interest Meta.",
          payload: {
            candidateIds: ["6003257869482", "6003739713691"],
            selectedIds: ["6003257869482"],
            rejectedIds: [],
          },
          createdAt: "2026-08-18T00:00:01.000Z",
        },
        {
          step: "JESSY",
          level: "INFO",
          message: "Persona ready_buyer selesai.",
          createdAt: "2026-08-18T00:00:02.000Z",
        },
      ],
      result: {
        ...DONE_STATUS.result!,
        tamara: {
          ...DONE_STATUS.result!.tamara,
          audienceTargeting: {
            branch: "CINERE",
            geo: ["Depok", "Jakarta Selatan", "Tangerang Selatan"],
            radiusKm: 25,
            ageMin: 25,
            ageMax: 50,
            geoNote: "⚠ Perkiraan awal, perlu direview — bukan data targeting resmi DSS Motor.",
            candidateCount: 2,
            interests: [
              {
                id: "6003257869482",
                name: "Used car (vehicle)",
                audienceSizeLower: 61362891,
                audienceSizeUpper: 72162760,
                topic: "Business and industry",
              },
            ],
            reasoning: "Paling relevan untuk pembeli mobil bekas.",
          },
        },
      },
    };

    async function runToPipeline(status: SimulationStatusDto): Promise<void> {
      writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
      mockFetch({
        "/api/objective": () =>
          jsonResponse({
            objective: {
              targetHotLeads: 100,
              budgetAllocation: 30_000_000,
              focusUnits: ["Xpander"],
            },
          }),
        "/api/simulation/start": () => jsonResponse({ id: "sim-1", status: "RUNNING" }, 202),
        "/api/simulation/sim-1/status": () => jsonResponse(status),
      });
      render(<SimulationWizardClient />);
      await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));
      await userEvent.click(screen.getByRole("button", { name: "Ready Buyer" }));
      await userEvent.click(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ }));
      await waitFor(() => expect(screen.getByTestId("simulation-log-panel")).toBeInTheDocument());
    }

    it("labels each real step with an agent-appropriate name (SETUP/JUDGE/REVIEW are not agents)", async () => {
      await runToPipeline(STATUS_WITH_TARGETING);
      const panel = screen.getByTestId("simulation-log-panel");
      expect(panel.textContent).toContain("Sistem");
      expect(panel.textContent).toContain("Tamara");
      expect(panel.textContent).toContain("Jessy");
    });

    it("filters the polled logs by step without any new network transport", async () => {
      await runToPipeline(STATUS_WITH_TARGETING);
      const panel = screen.getByTestId("simulation-log-panel");
      expect(panel.textContent).toContain("Simulasi dimulai.");

      await userEvent.selectOptions(screen.getByTestId("log-step-filter"), "JESSY");

      await waitFor(() =>
        expect(screen.getByTestId("simulation-log-panel").textContent).not.toContain(
          "Simulasi dimulai.",
        ),
      );
      expect(screen.getByTestId("simulation-log-panel").textContent).toContain(
        "Persona ready_buyer selesai.",
      );
    });

    it("shows 'Lihat data' only on the line that really carries a payload, and expands the real JSON", async () => {
      await runToPipeline(STATUS_WITH_TARGETING);
      const toggles = screen.getAllByRole("button", { name: "Lihat data" });
      expect(toggles).toHaveLength(1);

      await userEvent.click(toggles[0]!);
      expect(screen.getByText(/6003739713691/)).toBeInTheDocument();
    });

    it("renders the campaign preview with the real interest and the unreviewed-default caveat", async () => {
      await runToPipeline(STATUS_WITH_TARGETING);
      await userEvent.click(
        screen.getByRole("button", { name: /Campaign yang Akan Dibuat \(Preview\)/ }),
      );

      const preview = screen.getByTestId("campaign-preview");
      // Real Meta interest, with Meta's own audience bounds.
      expect(preview.textContent).toContain("Used car (vehicle)");
      expect(preview.textContent).toContain("61.362.891");
      // Branch geo/age default, always accompanied by its caveat.
      expect(preview.textContent).toContain("Depok");
      expect(preview.textContent).toContain("usia 25–50");
      expect(preview.textContent).toContain("Perkiraan awal");
      // Daily budget = the objective's real monthly allocation / 30.
      expect(preview.textContent).toContain("1.000.000");
      // Deliberately absent — no real source exists for any of these.
      expect(preview.textContent).not.toContain("Frequency cap");
      expect(preview.textContent).not.toContain("Buying type");
    });

    it("says so honestly when no interests could be selected, rather than showing an invented one", async () => {
      await runToPipeline({
        ...STATUS_WITH_TARGETING,
        result: {
          ...STATUS_WITH_TARGETING.result!,
          tamara: {
            ...STATUS_WITH_TARGETING.result!.tamara,
            audienceTargeting: {
              ...STATUS_WITH_TARGETING.result!.tamara.audienceTargeting!,
              candidateCount: 0,
              interests: [],
              reasoning: undefined,
              interestsUnavailableReason: "NO_CANDIDATES",
            },
          },
        },
      });
      await userEvent.click(
        screen.getByRole("button", { name: /Campaign yang Akan Dibuat \(Preview\)/ }),
      );
      expect(screen.getByTestId("campaign-preview").textContent).toContain(
        "Belum ada interest tersimpan",
      );
    });

    it("does not offer the preview at all on a simulation with no targeting block (pre-feature runs)", async () => {
      await runToPipeline(DONE_STATUS);
      expect(
        screen.queryByRole("button", { name: /Campaign yang Akan Dibuat \(Preview\)/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Kai prompt detail panel (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 3, section C)", () => {
    const STATUS_WITH_PROMPT_DETAIL: SimulationStatusDto = {
      ...DONE_STATUS,
      result: {
        ...DONE_STATUS.result!,
        kai: {
          ...DONE_STATUS.result!.kai,
          promptDetail: {
            videoPrompt: "Professional car advertisement video, Xpander Cross 2019 in showroom",
            imagePrompts: [
              "Professional automotive photography, Xpander Cross 2019, variant 1",
              "Professional automotive photography, Xpander Cross 2019, variant 2",
              "Professional automotive photography, Xpander Cross 2019, variant 3",
            ],
            copyVariants: [
              {
                id: "cv-a",
                variantLabel: "A",
                primaryText: "DP mulai 29 juta, cicilan ringan.",
                headline: "Xpander DP Ringan",
                callToAction: "Tanya Sekarang",
              },
            ],
            sourcePhotoUrls: ["https://assets.example/xpander-1.jpg"],
            format: "VIDEO_AND_IMAGES",
            imageModel: "nano-banana-pro",
            imageAspectRatio: "SQUARE",
            imageCount: 3,
            videoModel: "veo3_fast",
            videoDurationSeconds: 15,
            videoAspectRatio: "WIDESCREEN",
          },
        },
      },
    };

    async function runToPipelineWithStatus(status: SimulationStatusDto): Promise<void> {
      writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
      mockFetch({
        "/api/simulation/start": () => jsonResponse({ id: "sim-1", status: "RUNNING" }, 202),
        "/api/simulation/sim-1/status": () => jsonResponse(status),
      });
      render(<SimulationWizardClient />);
      await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));
      await userEvent.click(screen.getByRole("button", { name: "Ready Buyer" }));
      await userEvent.click(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ }));
      await waitFor(() => expect(screen.getByTestId("wizard-pipeline")).toBeInTheDocument());
    }

    it("shows the real EN prompts, model/ratio/duration and copy variants — never a fabricated example", async () => {
      await runToPipelineWithStatus(STATUS_WITH_PROMPT_DETAIL);
      await userEvent.click(screen.getByRole("button", { name: /Lihat Prompt Kai → Kie AI/ }));

      const panel = screen.getByTestId("kai-prompt-preview");
      expect(panel.textContent).toContain(
        "Professional car advertisement video, Xpander Cross 2019 in showroom",
      );
      expect(panel.textContent).toContain("variant 1");
      expect(panel.textContent).toContain("veo3_fast");
      expect(panel.textContent).toContain("15s");
      expect(panel.textContent).toContain("Xpander DP Ringan");
      expect(panel.textContent).toContain("Tanya Sekarang");
    });

    it("does not offer the prompt panel at all when promptDetail is absent (honest, not hidden-empty)", async () => {
      await runToPipelineWithStatus(DONE_STATUS);
      expect(
        screen.queryByRole("button", { name: /Lihat Prompt Kai → Kie AI/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe("History detail modal (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 3, section D)", () => {
    it("'Lihat →' fetches the real historical status and opens a 4-tab detail modal", async () => {
      mockFetch({
        "/api/simulation/history": () =>
          jsonResponse({
            history: [
              {
                id: "sim-old12345",
                status: "DONE",
                overallScore: 85.8,
                grade: "B",
                verdict: "GO",
                decision: "APPROVED",
                createdAt: "2026-08-10T00:00:00.000Z",
                updatedAt: "2026-08-10T00:05:00.000Z",
              },
            ],
          }),
        "/api/simulation/sim-old12345/status": () => jsonResponse(DONE_STATUS),
      });

      render(<SimulationWizardClient />);
      await userEvent.click(await screen.findByRole("button", { name: "Riwayat" }));
      await userEvent.click(await screen.findByRole("button", { name: "Lihat →" }));

      // The fetched detail's own real `id` field ("sim-1" in the shared `DONE_STATUS` fixture) is
      // what renders here — not the history row's id, which is only used to know which status to fetch.
      expect(await screen.findByText(/Detail Simulasi sim-1/)).toBeInTheDocument();
      // Scores tab is the default — the real overall/grade/verdict from the fetched status.
      expect(screen.getByText("85.8")).toBeInTheDocument();
      expect(screen.getByTestId("score-radar-chart")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Kai Prompt" }));
      expect(screen.getByText(/Tidak ada detail prompt Kai/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Log" }));
      expect(screen.getByTestId("simulation-log-panel")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Tutup" }));
      expect(screen.queryByText(/Detail Simulasi sim-1/)).not.toBeInTheDocument();
    });
  });

  describe("PROPERTY vertical (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6, Step 1)", () => {
    function mockPropertySettings(
      overrides: Record<string, () => Response | Promise<Response>> = {},
    ): void {
      mockFetch({
        "/api/settings": () =>
          jsonResponse({
            tenant: {
              tenantId: "propertyklik-demo",
              name: "PropertyKlik Demo",
              vertical: "PROPERTY",
              status: "ACTIVE",
            },
            meta: { apiVersion: "v21.0", hasToken: false, usingEnvDefault: true },
          }),
        "/api/listings?status=AKTIF": () =>
          jsonResponse({
            listings: [
              {
                id: "listing-1",
                title: "Rumah Bintaro 88m²",
                propertyType: "RUMAH",
                listingStatus: "AKTIF",
                price: 1_800_000_000,
                highlights: [],
                photos: [],
                inKnowledgeBase: false,
                createdAt: "2026-08-13T00:00:00.000Z",
                updatedAt: "2026-08-13T00:00:00.000Z",
              },
            ],
            total: 1,
          }),
        ...overrides,
      });
    }

    it("shows the PROPERTY angle list + Pilih Listing dropdown, and relabels personas — once vertical resolves", async () => {
      writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
      mockPropertySettings();
      render(<SimulationWizardClient />);

      await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));

      await waitFor(() => expect(screen.getByText("Rumah Bintaro 88m²")).toBeInTheDocument());
      expect(screen.getByText("Pilih Listing")).toBeInTheDocument();
      // Property-flavored persona label, same real "ready_buyer" id underneath.
      expect(screen.getByRole("button", { name: /Ready Buyer \(Siap Beli\)/ })).toBeInTheDocument();
      // The automotive-only angle option must not leak into the PROPERTY select.
      expect(screen.queryByText("KREDIT_SYARIAH")).not.toBeInTheDocument();
      expect(screen.getByText("VIRTUAL_TOUR")).toBeInTheDocument();
    });

    it("'Mulai Simulasi Dry-Run' stays disabled until a listing is selected", async () => {
      writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
      mockPropertySettings();
      render(<SimulationWizardClient />);

      await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));
      await waitFor(() => expect(screen.getByText("Rumah Bintaro 88m²")).toBeInTheDocument());
      await userEvent.click(screen.getByRole("button", { name: /Ready Buyer \(Siap Beli\)/ }));

      expect(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ })).toBeDisabled();

      await userEvent.selectOptions(screen.getByDisplayValue("— pilih listing —"), "listing-1");
      expect(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ })).not.toBeDisabled();
    });

    it("sends the real listingId + kaiPropertyAngle in the start payload once a listing is selected", async () => {
      writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
      let startCallBody: unknown;
      mockPropertySettings({
        "/api/simulation/start": () => jsonResponse({ id: "sim-1", status: "RUNNING" }, 202),
        "/api/simulation/sim-1/status": () => jsonResponse(DONE_STATUS),
      });
      const realFetch = global.fetch;
      global.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
        if (String(input).includes("/api/simulation/start") && init?.body !== undefined) {
          startCallBody = JSON.parse(String(init.body));
        }
        return realFetch(input as never, init);
      }) as unknown as typeof fetch;

      render(<SimulationWizardClient />);
      await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));
      await waitFor(() => expect(screen.getByText("Rumah Bintaro 88m²")).toBeInTheDocument());
      await userEvent.click(screen.getByRole("button", { name: /Ready Buyer \(Siap Beli\)/ }));
      await userEvent.selectOptions(screen.getByDisplayValue("— pilih listing —"), "listing-1");
      await userEvent.click(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ }));

      await waitFor(() => expect(screen.getByTestId("wizard-pipeline")).toBeInTheDocument());
      expect(startCallBody).toMatchObject({
        listingId: "listing-1",
        kaiPropertyAngle: "DP_RINGAN",
      });
    });

    it("shows an honest empty state when the tenant has no AKTIF listings (never a fabricated option)", async () => {
      writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
      mockPropertySettings({
        "/api/listings?status=AKTIF": () => jsonResponse({ listings: [], total: 0 }),
      });
      render(<SimulationWizardClient />);

      await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));
      expect(
        await screen.findByText("Belum ada listing AKTIF — tambahkan di Listing Manager."),
      ).toBeInTheDocument();
    });
  });

  it("history toggle loads /api/simulation/history", async () => {
    mockFetch({
      "/api/simulation/history": () =>
        jsonResponse({
          history: [
            {
              id: "sim-old",
              status: "DONE",
              overallScore: 72.5,
              grade: "C",
              verdict: "GO",
              createdAt: "2026-08-10T00:00:00.000Z",
              updatedAt: "2026-08-10T00:05:00.000Z",
            },
          ],
        }),
    });

    render(<SimulationWizardClient />);
    await userEvent.click(await screen.findByRole("button", { name: "Riwayat" }));
    await waitFor(() => expect(screen.getByText(/72.5/)).toBeInTheDocument());
  });
});
