import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { StressTestListPage } from "@/components/stress-test/StressTestListPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockClear();
});

const LEGACY_RUN = {
  id: "run-1",
  name: "Run 1",
  sourceType: "LISTING",
  creativeIds: [],
  mode: "STANDARD",
  primaryGoal: "CREATIVE_QUALITY",
  personaIds: ["PRICE_SENSITIVE"],
  objectionSources: [],
  status: "WAITING_FOR_ENGINE",
  result: null,
  createdAt: "2026-09-28T00:00:00.000Z",
};

const oneRun = { runs: [LEGACY_RUN] };

const PERSONA = (
  id: string,
  label: string,
  objections: { objection: string; severity: string }[],
) => ({
  personaId: id,
  personaLabel: label,
  ok: true,
  critique: {
    simulated: true,
    attracts: [],
    confusions: [],
    objections,
    intentDrivers: [],
    narrativeReaction: "x",
  },
});

const COMPLETED_RUN = {
  ...LEGACY_RUN,
  id: "run-2",
  name: "Run Bintaro",
  listingId: "listing-9",
  creativeIds: ["photo-1"],
  mode: "DEEP",
  personaIds: ["PRICE_SENSITIVE", "SKEPTICAL_BUYER"],
  status: "COMPLETED",
  createdAt: "2026-09-27T00:00:00.000Z",
  result: {
    kind: "COMPLETED",
    personaCritiques: [
      PERSONA("PRICE_SENSITIVE", "Price Sensitive", [
        { objection: "Harga terlalu tinggi", severity: "HIGH" },
      ]),
      PERSONA("SKEPTICAL_BUYER", "Skeptical Buyer", [
        { objection: "harga terlalu tinggi.", severity: "MEDIUM" },
        { objection: "Legalitas belum jelas", severity: "HIGH" },
      ]),
    ],
    copyEvaluation: { ok: false, failureReason: "x" },
    factCheck: { status: "NOT_APPLICABLE", note: "Tidak ada knowledge.", findings: [] },
    dimensionScores: [{ dimension: "OBJECTION_HANDLING", score: 42 }],
    overallScore: 42,
    scoreBucket: "MAJOR_ISSUES",
    confidence: 85,
    primaryRecommendation: "Jawab keberatan harga lebih dulu.",
    evaluatorsAttempted: 3,
    evaluatorsSucceeded: 2,
    gaps: [],
  },
};

const FAILED_RUN = {
  ...LEGACY_RUN,
  id: "run-3",
  name: "Run Gagal",
  status: "FAILED",
  mode: "FAST",
  createdAt: "2026-09-26T00:00:00.000Z",
};

const LISTING = {
  id: "listing-9",
  title: "Rumah Bintaro Sektor 9",
  mainPhotoUrl: "https://example.test/main.jpg",
  photos: [{ id: "photo-1", url: "https://example.test/photo-1.jpg", isMain: true }],
};

function stubRouted(runs: unknown[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/creative-stress-test") return { ok: true, json: async () => ({ runs }) };
      if (url === "/api/listings/listing-9") return { ok: true, json: async () => LISTING };
      if (url === "/api/creative-stress-test/persona-presets") {
        return {
          ok: true,
          json: async () => ({
            presets: [{ id: "PRICE_SENSITIVE", label: "Price Sensitive", description: "" }],
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    }),
  );
}

function rowFor(name: string): HTMLElement {
  return screen.getByRole("link", { name: `Lihat detail run ${name}` });
}

describe("StressTestListPage", () => {
  it("renders an honest empty state with a CTA to the builder when there are no real runs yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ runs: [] }) })),
    );
    render(<StressTestListPage />);
    await waitFor(() => expect(screen.getByText("Belum ada simulasi.")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Mulai Simulasi Pertama" })).toHaveAttribute(
      "href",
      "/samantha/stress-test/run",
    );
  });

  it("lists real, persisted runs with their honest status label", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => oneRun })),
    );
    render(<StressTestListPage />);
    await waitFor(() => expect(screen.getByText("Run 1")).toBeInTheDocument());
    expect(screen.getByText("Simulation Runs")).toBeInTheDocument();
    expect(within(rowFor("Run 1")).getByText("Menunggu Engine Evaluasi")).toBeInTheDocument();
  });

  it("renders a legacy WAITING_FOR_ENGINE row with '—' for readiness, score, confidence, top issue and objections", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => oneRun })),
    );
    render(<StressTestListPage />);
    await waitFor(() => expect(screen.getByText("Run 1")).toBeInTheDocument());
    const row = rowFor("Run 1");
    expect(within(row).getByTestId("run-readiness")).toHaveTextContent("—");
    expect(within(row).getByTestId("run-score")).toHaveTextContent("—");
    expect(within(row).getByTestId("run-score").textContent).not.toContain("0");
    expect(within(row).getByTestId("run-confidence")).toHaveTextContent("—");
    expect(within(row).queryByTestId("run-top-issue")).not.toBeInTheDocument();
    expect(within(row).queryByTestId("run-objections")).not.toBeInTheDocument();
    expect(within(row).getByText("Tanpa creative spesifik")).toBeInTheDocument();
  });

  it("shows real readiness, score, confidence, top issue, objection counts and listing context for an evaluated run", async () => {
    stubRouted([COMPLETED_RUN]);
    render(<StressTestListPage />);
    await waitFor(() => expect(screen.getByText("Run Bintaro")).toBeInTheDocument());
    const row = rowFor("Run Bintaro");
    expect(within(row).getByTestId("run-readiness")).toHaveTextContent("Masalah Besar");
    expect(within(row).getByTestId("run-score")).toHaveTextContent("42/100");
    expect(within(row).getByTestId("run-confidence")).toHaveTextContent("85%High");
    expect(within(row).getByTestId("run-confidence")).toHaveAttribute(
      "title",
      expect.stringContaining("bukan probabilitas keberhasilan campaign"),
    );
    expect(within(row).getByTestId("run-top-issue")).toHaveTextContent(
      "Jawab keberatan harga lebih dulu.",
    );
    expect(within(row).getByTestId("run-objections")).toHaveTextContent("3 keberatan · 2 unik");
    expect(within(row).getByTestId("run-objections")).toHaveAttribute(
      "href",
      "/samantha/stress-test/run-2#objections",
    );
    await waitFor(() =>
      expect(within(row).getByTestId("run-context-title")).toHaveTextContent(
        "Rumah Bintaro Sektor 9",
      ),
    );
    expect(within(row).getByText("1 creative")).toBeInTheDocument();
    expect(row.textContent).not.toMatch(/unresolved|resolved|partial/i);
  });

  it("shows 'Alasan tidak tercatat' for a FAILED run with no persisted reason, and the real reason when present", async () => {
    stubRouted([
      FAILED_RUN,
      { ...FAILED_RUN, id: "run-4", name: "Run Gagal 2", failedReason: "LLM timeout" },
    ]);
    render(<StressTestListPage />);
    await waitFor(() => expect(screen.getByText("Run Gagal")).toBeInTheDocument());
    expect(within(rowFor("Run Gagal")).getByTestId("run-status")).toHaveTextContent(
      "GagalAlasan tidak tercatat",
    );
    expect(within(rowFor("Run Gagal 2")).getByTestId("run-status")).toHaveTextContent(
      "LLM timeout",
    );
    expect(within(rowFor("Run Gagal")).getByRole("link", { name: "Run Lagi" })).toHaveAttribute(
      "href",
      "/samantha/stress-test/run?fromRun=run-3&intent=rerun",
    );
  });

  it("shows a real error state when the run history fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ message: "boom" }) })),
    );
    render(<StressTestListPage />);
    await waitFor(() =>
      expect(screen.getByText("Riwayat run belum dapat dimuat.")).toBeInTheDocument(),
    );
  });

  it("navigates to the run detail when any cell in the row is clicked, not just the name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => oneRun })),
    );
    render(<StressTestListPage />);
    await waitFor(() => expect(screen.getByText("Run 1")).toBeInTheDocument());
    fireEvent.click(within(rowFor("Run 1")).getByText("Standard"));
    expect(push).toHaveBeenCalledWith("/samantha/stress-test/run-1");
  });

  it("navigates to the run detail on Enter when the row is focused (keyboard access)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => oneRun })),
    );
    render(<StressTestListPage />);
    await waitFor(() => expect(screen.getByText("Run 1")).toBeInTheDocument());
    fireEvent.keyDown(rowFor("Run 1"), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/samantha/stress-test/run-1");
  });

  it("does not trigger row navigation when an action is clicked, and shows unavailable actions disabled with a reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => oneRun })),
    );
    render(<StressTestListPage />);
    await waitFor(() => expect(screen.getByText("Run 1")).toBeInTheDocument());
    const row = rowFor("Run 1");
    // jsdom cannot follow real <a> navigation; block the default so only bubbling is under test.
    row.addEventListener("click", (e) => e.preventDefault(), { capture: true });
    fireEvent.click(within(row).getByRole("link", { name: "Lihat Hasil" }));
    fireEvent.click(within(row).getByRole("link", { name: "Run Lagi" }));
    const more = within(row).getByRole("button", { name: "Aksi lain untuk Run 1" });
    fireEvent.click(more);
    fireEvent.keyDown(more, { key: "Enter" });
    expect(push).not.toHaveBeenCalled();
    const menu = within(row).getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /Duplikat/ })).toHaveAttribute(
      "href",
      "/samantha/stress-test/run?fromRun=run-1&intent=duplicate",
    );
    expect(within(menu).getByRole("menuitem", { name: /Hapus/ })).toBeDisabled();
    expect(within(menu).getByRole("menuitem", { name: /Arsipkan/ })).toBeDisabled();
    expect(within(menu).getByRole("menuitem", { name: /Buat Eksperimen/ })).toBeDisabled();
    expect(within(menu).getByRole("menuitem", { name: /Kirim ke Kai/ })).toBeDisabled();
  });

  it("filters by the 'Deep' quick chip and the search box", async () => {
    stubRouted([LEGACY_RUN, COMPLETED_RUN]);
    render(<StressTestListPage />);
    await waitFor(() => expect(screen.getByText("Run Bintaro")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Deep" }));
    expect(screen.queryByText("Run 1")).not.toBeInTheDocument();
    expect(screen.getByText("Run Bintaro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Semua" }));
    fireEvent.change(screen.getByPlaceholderText("Nama run atau judul konteks…"), {
      target: { value: "run 1" },
    });
    expect(screen.getByText("Run 1")).toBeInTheDocument();
    expect(screen.queryByText("Run Bintaro")).not.toBeInTheDocument();
  });

  it("links the primary action to the real builder route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ runs: [] }) })),
    );
    render(<StressTestListPage />);
    expect(screen.getByRole("link", { name: /Uji Ketahanan Creative Baru/i })).toHaveAttribute(
      "href",
      "/samantha/stress-test/run",
    );
  });
});

describe("StressTestListPage — progress, polling, campaign titles, partial results", () => {
  const PROGRESS = {
    updatedAt: "2026-09-28T00:00:05.000Z",
    steps: [
      { key: "PERSONA_SIMULATION", state: "DONE", done: 3, total: 3, failed: 0 },
      { key: "COPY_EVALUATION", state: "DONE" },
      { key: "FACT_VALIDATION", state: "RUNNING" },
      { key: "OBJECTION_RESOLUTION", state: "RUNNING" },
    ],
  };
  const RUNNING_RUN = {
    ...LEGACY_RUN,
    id: "run-r",
    name: "Run Berjalan",
    sourceType: "CAMPAIGN",
    campaignId: "cmp-7",
    status: "RUNNING",
    result: { kind: "IN_PROGRESS", progress: PROGRESS },
  };

  function stubSequence(
    sequences: unknown[][],
    campaigns: unknown = { campaigns: [{ id: "cmp-7", name: "Promo Bintaro Q3" }] },
  ) {
    let i = 0;
    const fn = vi.fn(async (url: string) => {
      if (url === "/api/creative-stress-test") {
        const runs = sequences[Math.min(i, sequences.length - 1)];
        i += 1;
        return { ok: true, json: async () => ({ runs }) };
      }
      if (url === "/api/campaigns") return { ok: true, json: async () => campaigns };
      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fn);
    return fn;
  }
  const listFetches = (fn: ReturnType<typeof vi.fn>): number =>
    fn.mock.calls.filter(([u]) => u === "/api/creative-stress-test").length;

  it("shows the real per-evaluator checklist for a RUNNING row and the campaign title from /api/campaigns (fetched once)", async () => {
    const fn = stubSequence([
      [RUNNING_RUN, { ...RUNNING_RUN, id: "run-x", name: "Lain", campaignId: "unknown" }],
    ]);
    render(<StressTestListPage />);
    await screen.findByTestId("simulation-runs-table");
    const progress = await within(rowFor("Run Berjalan")).findByTestId("run-progress");
    expect(progress).toHaveTextContent("Persona 3/3 ✓");
    expect(progress).toHaveTextContent("Fact berjalan");
    expect(progress).toHaveTextContent("2/4 evaluator");
    await waitFor(() =>
      expect(within(rowFor("Run Berjalan")).getByTestId("run-context-title")).toHaveTextContent(
        "Promo Bintaro Q3",
      ),
    );
    expect(within(rowFor("Lain")).getByTestId("run-context-title")).toHaveTextContent("—");
    expect(fn.mock.calls.filter(([u]) => u === "/api/campaigns")).toHaveLength(1);
    expect(fn.mock.calls.some(([u]) => String(u).includes("/workspace"))).toBe(false);
  });

  it("polls every 3s while a visible run is RUNNING and stops once none is", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const fn = stubSequence([
        [RUNNING_RUN],
        [{ ...RUNNING_RUN, status: "COMPLETED", result: COMPLETED_RUN.result }],
      ]);
      render(<StressTestListPage />);
      await screen.findByTestId("simulation-runs-table");
      await within(rowFor("Run Berjalan")).findByTestId("run-progress");
      expect(listFetches(fn)).toBe(1);
      await vi.advanceTimersByTimeAsync(3000);
      await waitFor(() =>
        expect(within(rowFor("Run Berjalan")).getByTestId("run-status")).toHaveTextContent(
          "Selesai",
        ),
      );
      expect(listFetches(fn)).toBe(2);
      await vi.advanceTimersByTimeAsync(12_000);
      expect(listFetches(fn)).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never polls when nothing is QUEUED/RUNNING", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const fn = stubSequence([[COMPLETED_RUN, FAILED_RUN]]);
      render(<StressTestListPage />);
      await screen.findByTestId("simulation-runs-table");
      await vi.advanceTimersByTimeAsync(10_000);
      expect(listFetches(fn)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers 'Lihat Hasil Parsial' only on FAILED rows with a real partial result; legacy RUNNING keeps 'Sedang dievaluasi'", async () => {
    stubSequence([
      [
        {
          ...FAILED_RUN,
          failedReason: "kaboom",
          result: {
            kind: "PARTIAL",
            partial: true,
            hasRealOutput: true,
            personaCritiques: COMPLETED_RUN.result.personaCritiques,
            evaluatorsAttempted: 3,
            evaluatorsSucceeded: 2,
            gaps: [],
            progress: PROGRESS,
          },
        },
        { ...FAILED_RUN, id: "run-f2", name: "Gagal Total" },
        { ...LEGACY_RUN, id: "run-l", name: "Legacy Running", status: "RUNNING", result: null },
      ],
    ]);
    render(<StressTestListPage />);
    await screen.findByTestId("simulation-runs-table");
    expect(within(rowFor("Run Gagal")).getByTestId("run-partial-result")).toHaveTextContent(
      "Lihat Hasil Parsial",
    );
    expect(within(rowFor("Run Gagal")).getByTestId("run-score")).toHaveTextContent("—");
    expect(
      within(rowFor("Gagal Total")).queryByTestId("run-partial-result"),
    ).not.toBeInTheDocument();
    expect(within(rowFor("Legacy Running")).getByTestId("run-status")).toHaveTextContent(
      "Sedang dievaluasi",
    );
    expect(within(rowFor("Legacy Running")).queryByTestId("run-progress")).not.toBeInTheDocument();
  });

  it("objection cell shows 'x belum terjawab · y sebagian' when the run was assessed", async () => {
    stubSequence([
      [
        {
          ...COMPLETED_RUN,
          result: {
            ...COMPLETED_RUN.result,
            objectionResolution: {
              status: "ASSESSED",
              simulated: true,
              note: "AI",
              items: [
                {
                  key: "harga terlalu tinggi",
                  objection: "Harga terlalu tinggi",
                  resolutionStatus: "UNRESOLVED",
                  goalImpact: "HIGH",
                  shortRecommendation: "x",
                  evidence: null,
                },
                {
                  key: "legalitas belum jelas",
                  objection: "Legalitas belum jelas",
                  resolutionStatus: "PARTIAL",
                  goalImpact: "LOW",
                  shortRecommendation: "y",
                  evidence: "SHM",
                },
              ],
            },
          },
        },
      ],
    ]);
    render(<StressTestListPage />);
    await screen.findByTestId("simulation-runs-table");
    expect(within(rowFor("Run Bintaro")).getByTestId("run-objections")).toHaveTextContent(
      "1 belum terjawab · 1 sebagian",
    );
  });
});
