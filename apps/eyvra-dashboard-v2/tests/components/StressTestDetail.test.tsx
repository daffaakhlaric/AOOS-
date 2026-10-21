import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { StressTestDetail } from "@/components/stress-test/StressTestDetail";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const BASE_RUN = {
  id: "run-1",
  name: "Run 1",
  sourceType: "LISTING",
  creativeIds: [],
  mode: "STANDARD",
  primaryGoal: "CREATIVE_QUALITY",
  personaIds: ["PRICE_SENSITIVE"],
  objectionSources: ["LISTING_KNOWLEDGE_BASE", "FIRST_MESSAGE_INTELLIGENCE"],
  createdAt: "2026-09-28T00:00:00.000Z",
};

describe("StressTestDetail", () => {
  it("renders the honest WAITING_FOR_ENGINE gap — never a fabricated score/verdict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ...BASE_RUN,
          status: "WAITING_FOR_ENGINE",
          completedAt: "2026-09-28T01:00:00.000Z",
          result: {
            kind: "WAITING_FOR_ENGINE",
            reason: "Evaluator registry belum dibangun (Boundary 2).",
            objectionSourceAvailability: [
              { source: "LISTING_KNOWLEDGE_BASE", hasRealData: true, note: "real" },
              {
                source: "FIRST_MESSAGE_INTELLIGENCE",
                hasRealData: false,
                note: "Belum tersedia — belum ada field firstMessage nyata.",
              },
            ],
          },
        }),
      })),
    );
    render(<StressTestDetail runId="run-1" />);
    await waitFor(() =>
      expect(screen.getByTestId("stress-test-waiting-for-engine")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("stress-test-detail-status")).toHaveTextContent(
      "Menunggu Engine Evaluasi",
    );
    // Never renders a fabricated score/verdict anywhere on the page.
    expect(document.body.textContent).not.toMatch(/skor|score/i);
  });

  it("renders an honest empty result state when result is still null (DRAFT run)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ...BASE_RUN, status: "DRAFT", result: null }),
      })),
    );
    render(<StressTestDetail runId="run-1" />);
    await waitFor(() => expect(screen.getByText("Evaluasi belum tersedia")).toBeInTheDocument());
  });

  it("shows a real error state when the run fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ message: "not found" }) })),
    );
    render(<StressTestDetail runId="missing" />);
    await waitFor(() => expect(screen.getByText("Run belum dapat dimuat.")).toBeInTheDocument());
  });

  it("renders a real COMPLETED evaluated result with dimension scores, honest simulation labeling, and the primary recommendation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ...BASE_RUN,
          status: "COMPLETED",
          completedAt: "2026-09-28T01:00:00.000Z",
          result: {
            kind: "COMPLETED",
            personaCritiques: [
              {
                personaId: "PRICE_SENSITIVE",
                personaLabel: "Price Sensitive",
                ok: true,
                critique: {
                  simulated: true,
                  attracts: ["Lokasi strategis"],
                  confusions: [],
                  objections: [{ objection: "Harga tinggi", severity: "MEDIUM" }],
                  intentDrivers: ["Diskon DP"],
                  narrativeReaction: "Lumayan menarik tapi masih mikir soal harga.",
                },
              },
            ],
            copyEvaluation: {
              ok: true,
              hookClarity: { status: "STRONG", reasoning: "Judul kuat." },
              offerStrength: { status: "ADEQUATE", reasoning: "Cukup." },
              ctaSpecificity: { status: "WEAK", reasoning: "Tidak ada CTA jelas." },
              internalConsistency: { status: "STRONG", reasoning: "Konsisten." },
              summary: "Copy cukup kuat.",
            },
            factCheck: {
              status: "NOT_APPLICABLE",
              note: "Tidak dapat diverifikasi — belum ada Listing Knowledge untuk listing ini.",
              findings: [],
            },
            dimensionScores: [
              { dimension: "HOOK", score: 90 },
              { dimension: "OFFER", score: 65 },
              { dimension: "CTA", score: 35 },
              { dimension: "OBJECTION_HANDLING", score: 88 },
            ],
            overallScore: 70,
            scoreBucket: "MINOR_REVISION",
            confidence: 85,
            primaryRecommendation: "Prioritas utama: perbaiki CTA — Tidak ada CTA jelas.",
            evaluatorsAttempted: 2,
            evaluatorsSucceeded: 2,
            gaps: ["Tidak dapat diverifikasi — belum ada Listing Knowledge untuk listing ini."],
          },
        }),
      })),
    );
    render(<StressTestDetail runId="run-1" />);
    await waitFor(() => expect(screen.getByTestId("stress-test-scoring-card")).toBeInTheDocument());
    expect(screen.getByTestId("stress-test-primary-recommendation")).toHaveTextContent(
      "Prioritas utama: perbaiki CTA",
    );
    // Simulation disclaimer shown exactly once, at the persona section header.
    expect(screen.getAllByText(/Hasil berikut menggunakan persona simulasi AI/)).toHaveLength(1);
    expect(screen.getByTestId("stress-test-persona-PRICE_SENSITIVE")).toHaveTextContent(
      "Lumayan menarik tapi masih mikir soal harga.",
    );
    expect(screen.getByTestId("stress-test-gaps")).toHaveTextContent("belum ada Listing Knowledge");
  });

  it("shows an honest reduced-confidence notice for a partial result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ...BASE_RUN,
          status: "COMPLETED",
          completedAt: "2026-09-28T01:00:00.000Z",
          result: {
            kind: "COMPLETED",
            personaCritiques: [
              {
                personaId: "PRICE_SENSITIVE",
                personaLabel: "Price Sensitive",
                ok: false,
                failureReason: "PROVIDER_ERROR: boom",
              },
            ],
            copyEvaluation: {
              ok: true,
              hookClarity: { status: "STRONG", reasoning: "Judul kuat." },
              offerStrength: { status: "STRONG", reasoning: "Kuat." },
              ctaSpecificity: { status: "STRONG", reasoning: "Jelas." },
              internalConsistency: { status: "STRONG", reasoning: "Konsisten." },
              summary: "Copy kuat.",
            },
            factCheck: {
              status: "NOT_APPLICABLE",
              note: "Tidak dapat diverifikasi — belum ada Listing Knowledge untuk listing ini.",
              findings: [],
            },
            dimensionScores: [{ dimension: "HOOK", score: 90 }],
            overallScore: 90,
            scoreBucket: "READY_TO_TEST",
            confidence: 25,
            primaryRecommendation: "Coba lagi simulasi persona yang gagal.",
            evaluatorsAttempted: 2,
            evaluatorsSucceeded: 1,
            gaps: [
              "Tidak ada simulasi persona yang berhasil — dimensi Objection Handling tidak memiliki skor nyata pada run ini.",
            ],
          },
        }),
      })),
    );
    render(<StressTestDetail runId="run-1" />);
    await waitFor(() =>
      expect(screen.getByTestId("stress-test-reduced-confidence")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("stress-test-persona-PRICE_SENSITIVE")).toHaveTextContent(
      "Simulasi gagal",
    );
  });

  it("shows a real FAILED state with the real failedReason, never a hollow result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ...BASE_RUN,
          status: "FAILED",
          failedReason: "Semua evaluator gagal dijalankan.",
          result: null,
        }),
      })),
    );
    render(<StressTestDetail runId="run-1" />);
    await waitFor(() =>
      expect(screen.getByText("Semua evaluator gagal dijalankan.")).toBeInTheDocument(),
    );
  });

  const COMPLETED_RESULT = {
    kind: "COMPLETED",
    personaCritiques: [
      {
        personaId: "PRICE_SENSITIVE",
        personaLabel: "Price Sensitive",
        ok: true,
        critique: {
          simulated: true,
          attracts: ["Lokasi strategis"],
          confusions: [],
          objections: [{ objection: "Harga tinggi", severity: "HIGH" }],
          intentDrivers: ["Diskon DP"],
          narrativeReaction: "Lumayan menarik tapi masih mikir soal harga.",
        },
      },
    ],
    copyEvaluation: {
      ok: true,
      hookClarity: { status: "STRONG", reasoning: "Judul kuat." },
      offerStrength: { status: "ADEQUATE", reasoning: "Cukup." },
      ctaSpecificity: { status: "WEAK", reasoning: "Tidak ada CTA jelas." },
      internalConsistency: { status: "STRONG", reasoning: "Konsisten." },
      summary: "Copy cukup kuat.",
    },
    factCheck: { status: "NOT_APPLICABLE", note: "Tidak dapat diverifikasi.", findings: [] },
    dimensionScores: [
      { dimension: "HOOK", score: 90 },
      { dimension: "CTA", score: 35 },
      { dimension: "OBJECTION_HANDLING", score: 70 },
    ],
    overallScore: 65,
    scoreBucket: "NEEDS_REVISION",
    confidence: 85,
    primaryRecommendation: "Prioritas utama: perbaiki CTA — Tidak ada CTA jelas.",
    evaluatorsAttempted: 2,
    evaluatorsSucceeded: 2,
    gaps: [],
  };

  it('shows "Kirim ke Kai" only for a COMPLETED run with real evaluator content, requires angle/format before submit is enabled, and calls the new listing-path route for a sourceType LISTING run', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          expect(url).toBe("/api/creative-stress-test/run-1/send-to-kai");
          const body = JSON.parse(String(init.body)) as {
            angle: string;
            format: string;
            message: string;
          };
          expect(body.angle).toBe("INVESTASI");
          expect(body.format).toBe("IMAGES_ONLY");
          expect(body.message.length).toBeGreaterThan(0);
          return { ok: true, json: async () => ({ id: "pkg-1", status: "DRAFT" }) };
        }
        return {
          ok: true,
          json: async () => ({
            ...BASE_RUN,
            sourceType: "LISTING",
            listingId: "listing-9",
            status: "COMPLETED",
            completedAt: "2026-09-28T01:00:00.000Z",
            result: COMPLETED_RESULT,
          }),
        };
      }),
    );
    render(<StressTestDetail runId="run-1" />);
    const trigger = await screen.findByTestId("stress-test-send-to-kai-button");
    fireEvent.click(trigger);

    const submit = await screen.findByTestId("stress-test-kai-submit");
    // No default silently chosen — disabled until both angle and format are explicitly picked.
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByTestId("stress-test-kai-angle"), {
      target: { value: "INVESTASI" },
    });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByTestId("stress-test-kai-format"), {
      target: { value: "IMAGES_ONLY" },
    });
    expect(submit).not.toBeDisabled();

    // The pre-filled brief is real, not generic — traces to real evaluator fields.
    const textarea = screen.getByTestId("stress-test-kai-message") as HTMLTextAreaElement;
    expect(textarea.value).toContain("Tidak ada CTA jelas.");
    expect(textarea.value).toContain("Harga tinggi");

    fireEvent.click(submit);
    await waitFor(() =>
      expect(screen.getByText(/Brief tersimpan sebagai Draft di Kai/)).toBeInTheDocument(),
    );
  });

  it("reuses the existing /api/campaigns/[campaignId]/brief route for a sourceType CAMPAIGN run — never duplicates that logic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          expect(url).toBe("/api/campaigns/camp-1/brief");
          return { ok: true, json: async () => ({ id: "pkg-1", status: "DRAFT" }) };
        }
        return {
          ok: true,
          json: async () => ({
            ...BASE_RUN,
            sourceType: "CAMPAIGN",
            campaignId: "camp-1",
            status: "COMPLETED",
            completedAt: "2026-09-28T01:00:00.000Z",
            result: COMPLETED_RESULT,
          }),
        };
      }),
    );
    render(<StressTestDetail runId="run-1" />);
    const trigger = await screen.findByTestId("stress-test-send-to-kai-button");
    fireEvent.click(trigger);
    fireEvent.change(await screen.findByTestId("stress-test-kai-angle"), {
      target: { value: "INVESTASI" },
    });
    fireEvent.change(screen.getByTestId("stress-test-kai-format"), {
      target: { value: "IMAGES_ONLY" },
    });
    fireEvent.click(screen.getByTestId("stress-test-kai-submit"));
    await waitFor(() =>
      expect(screen.getByText(/Brief tersimpan sebagai Draft di Kai/)).toBeInTheDocument(),
    );
  });

  it("does not offer Kirim ke Kai for a run status that is not COMPLETED, even if a result exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ...BASE_RUN,
          sourceType: "LISTING",
          listingId: "listing-9",
          status: "RUNNING",
          result: COMPLETED_RESULT,
        }),
      })),
    );
    render(<StressTestDetail runId="run-1" />);
    await waitFor(() =>
      expect(screen.getByTestId("stress-test-detail-status")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("stress-test-send-to-kai-button")).not.toBeInTheDocument();
  });

  describe("decision workspace layout", () => {
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
        attracts: ["Lokasi strategis"],
        confusions: ["Cicilan tidak disebut"],
        objections,
        intentDrivers: ["Promo DP"],
        narrativeReaction: `Reaksi ${label}.`,
      },
    });

    const RICH_RESULT = {
      ...COMPLETED_RESULT,
      personaCritiques: [
        PERSONA("PRICE_SENSITIVE", "Price Sensitive", [
          { objection: "Harga terlalu tinggi", severity: "HIGH" },
        ]),
        PERSONA("SKEPTICAL_BUYER", "Skeptical Buyer", [
          { objection: "harga terlalu tinggi.", severity: "MEDIUM" },
          { objection: "Legalitas belum jelas", severity: "HIGH" },
        ]),
        PERSONA("INVESTOR", "Investor", []),
      ],
      dimensionScores: [
        { dimension: "HOOK", score: 90 },
        { dimension: "OFFER", score: 65 },
        { dimension: "CTA", score: 35 },
        { dimension: "OBJECTION_HANDLING", score: 72 },
      ],
      overallScore: 42,
      scoreBucket: "MAJOR_ISSUES",
      confidence: 85,
      evaluatorsAttempted: 4,
      evaluatorsSucceeded: 4,
      gaps: ["Tidak dapat diverifikasi."],
    };

    const RUN = {
      ...BASE_RUN,
      id: "run-1",
      name: "Run Bintaro",
      sourceType: "LISTING",
      listingId: "listing-9",
      creativeIds: ["photo-1"],
      personaIds: ["PRICE_SENSITIVE", "SKEPTICAL_BUYER", "INVESTOR"],
      status: "COMPLETED",
      completedAt: "2026-09-28T00:01:23.000Z",
      result: RICH_RESULT,
    };

    const LISTING = {
      id: "listing-9",
      title: "Rumah Bintaro Sektor 9",
      price: 1_250_000_000,
      landArea: 120,
      certificate: "SHM",
      city: "Tangerang Selatan",
      listingStatus: "ACTIVE",
      description: "Rumah siap huni.",
      mainPhotoUrl: "https://example.test/main.jpg",
      photos: [{ id: "photo-1", url: "https://example.test/photo-1.jpg", isMain: true }],
    };

    function stubRouted(extraRuns: unknown[] = []): void {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url === "/api/creative-stress-test/run-1") return { ok: true, json: async () => RUN };
          if (url === "/api/listings/listing-9") return { ok: true, json: async () => LISTING };
          if (url === "/api/creative-stress-test") {
            return { ok: true, json: async () => ({ runs: [RUN, ...extraRuns] }) };
          }
          throw new Error(`Unexpected fetch ${url}`);
        }),
      );
    }

    it("renders the Creative Readiness Score with the backend bucket, confidence separately, and the no-CTR-prediction note", async () => {
      stubRouted();
      render(<StressTestDetail runId="run-1" />);
      expect(await screen.findByTestId("stress-test-overall-score")).toHaveTextContent("42");
      expect(screen.getByTestId("stress-test-score-bucket")).toHaveTextContent("Masalah Besar");
      expect(screen.getByTestId("stress-test-confidence")).toHaveTextContent("85%");
      expect(screen.getByTestId("stress-test-run-duration")).toHaveTextContent("1 mnt 23 dtk");
      expect(screen.getByTestId("stress-test-scoring-card")).toHaveTextContent(
        /bukan prediksi\s+performa, CTR/,
      );
      expect(screen.getByTestId("stress-test-result-stepper")).toHaveTextContent(
        "Hasil & Rekomendasi",
      );
    });

    it("shows the simulation disclaimer exactly once even with several personas", async () => {
      stubRouted();
      render(<StressTestDetail runId="run-1" />);
      await screen.findByTestId("stress-test-persona-SKEPTICAL_BUYER");
      expect(
        screen.getAllByText(/persona simulasi AI\. Ini bukan pernyataan dari pembeli nyata/),
      ).toHaveLength(1);
      expect(
        screen.queryByText(/Hasil simulasi AI berdasarkan persona preset/),
      ).not.toBeInTheDocument();
    });

    it("renders the 4 unevaluated dimensions as N/A (never 0) and opens real evidence for a scored one", async () => {
      stubRouted();
      render(<StressTestDetail runId="run-1" />);
      await screen.findByTestId("stress-test-dimension-grid");
      for (const label of [
        "Visual Relevance",
        "Message-Market Fit",
        "Trust & Proof",
        "Campaign Fit",
      ]) {
        const cell = screen.getByTestId(`stress-test-dimension-na-${label}`);
        expect(cell).toHaveTextContent("N/A");
        expect(cell).toHaveTextContent("Evaluator belum tersedia");
        expect(cell.textContent).not.toMatch(/\d/);
      }
      expect(screen.getByTestId("stress-test-dimension-CTA")).toHaveTextContent("35");
      fireEvent.click(screen.getByTestId("stress-test-dimension-CTA"));
      expect(await screen.findByTestId("stress-test-dimension-drawer")).toHaveTextContent(
        "Tidak ada CTA jelas.",
      );
    });

    it("aggregates objections as simulation agreement (n/N + % of simulated personas), labelled as simulation", async () => {
      stubRouted();
      render(<StressTestDetail runId="run-1" />);
      const table = await screen.findByTestId("stress-test-objection-table");
      const agreements = screen
        .getAllByTestId("stress-test-objection-agreement")
        .map((c) => c.textContent);
      expect(agreements).toEqual(["67% · 2/3 persona", "33% · 1/3 persona"]);
      expect(table).toHaveTextContent("Frekuensi (Simulasi)");
      expect(table.textContent).not.toMatch(/Frekuensi Buyer/i);
      expect(within(table).getAllByTestId("evidence-badge-SIMULATED")).toHaveLength(2);
      // Anchor for the Simulation Runs "Keberatan" deep link.
      expect(document.getElementById("objections")).toContainElement(table);
    });

    it("shows resolution as 'Belum dinilai' (never 'Belum Terjawab') and impact as '—' under a goal-labelled header", async () => {
      stubRouted();
      render(<StressTestDetail runId="run-1" />);
      await screen.findByTestId("stress-test-objection-table");
      const resolutions = screen.getAllByTestId("objection-resolution").map((c) => c.textContent);
      expect(resolutions).toEqual(["Belum dinilai", "Belum dinilai"]);
      expect(screen.queryByText("Belum Terjawab")).not.toBeInTheDocument();
      expect(screen.getByTestId("objection-resolution-note")).toHaveTextContent(
        "Status resolusi belum dinilai",
      );
      expect(screen.getByTestId("objection-impact-header")).toHaveTextContent(
        "Dampak ke Kualitas Creative",
      );
      expect(screen.getByTestId("objection-impact-header")).toHaveAttribute(
        "title",
        "Belum dinilai — evaluator dampak belum tersedia",
      );
      expect(screen.getAllByTestId("objection-category").map((c) => c.textContent)).toEqual([
        "Harga / Nilai",
        "Legal / Keamanan",
      ]);
    });

    it("opens the objection detail drawer with each persona's own text and honest gaps", async () => {
      stubRouted();
      render(<StressTestDetail runId="run-1" />);
      await screen.findByTestId("stress-test-objection-table");
      fireEvent.click(screen.getAllByRole("button", { name: "Lihat Detail →" })[0] as HTMLElement);
      const drawer = await screen.findByTestId("objection-detail-drawer");
      expect(drawer).toHaveTextContent("Kategori otomatis (berdasarkan kata kunci)");
      expect(drawer).toHaveTextContent("2/3 persona simulasi (67%)");
      expect(drawer).toHaveTextContent("Data live belum terhubung");
      const personas = within(drawer)
        .getAllByTestId("objection-detail-persona")
        .map((p) => p.textContent);
      expect(personas[0]).toContain("Price Sensitive");
      expect(personas[0]).toContain("Harga terlalu tinggi");
      expect(personas[1]).toContain("Skeptical Buyer");
      expect(personas[1]).toContain("harga terlalu tinggi.");
    });

    it("exports the filtered objection rows as a UTF-8 CSV download named after the run", async () => {
      stubRouted();
      const createObjectURL = vi.fn(() => "blob:x");
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => undefined);
      render(<StressTestDetail runId="run-1" />);
      await screen.findByTestId("stress-test-objection-table");
      fireEvent.click(screen.getByTestId("objection-export-csv"));
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
      const bytes = new Uint8Array(
        await new Promise<ArrayBuffer>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.readAsArrayBuffer(blob);
        }),
      );
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      const text = new TextDecoder().decode(bytes.slice(3));
      expect(text).toContain("objection,category,personas,simulation_agreement,live_frequency");
      expect(text).toContain("NOT_ASSESSED");
      const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
      expect(anchor.download).toBe("stress-test-run-1-objections.csv");
      clickSpy.mockRestore();
    });

    it("builds the priority list only from real findings", async () => {
      stubRouted();
      render(<StressTestDetail runId="run-1" />);
      const items = await screen.findAllByTestId("stress-test-priority-item");
      expect(items[0]).toHaveTextContent('Jawab keberatan: "Harga terlalu tinggi"');
      const text = items.map((i) => i.textContent).join(" ");
      expect(text).toContain("Perkuat CTA");
      expect(text).not.toContain("Perkuat Hook");
    });

    it("shows real listing context, a dash for fields without a source, and links NOT_APPLICABLE fact status to the listing knowledge editor", async () => {
      stubRouted();
      render(<StressTestDetail runId="run-1" />);
      expect(await screen.findByTestId("stress-test-context-title")).toHaveTextContent(
        "Rumah Bintaro Sektor 9",
      );
      const card = screen.getByTestId("stress-test-context-card");
      expect(card).toHaveTextContent("SHM");
      expect(card).toHaveTextContent("Tangerang Selatan");
      expect(screen.getByTestId("stress-test-context-objective")).toHaveTextContent("—");
      expect(screen.getByTestId("stress-test-fact-status")).toHaveTextContent(
        "Belum dapat diverifikasi",
      );
      expect(screen.getByTestId("stress-test-complete-knowledge-link")).toHaveAttribute(
        "href",
        "/listings/listing-9/edit#knowledge",
      );
      expect(screen.getByTestId("stress-test-creative-info-card")).toHaveTextContent(
        "Foto utama listing",
      );
      expect(document.body.textContent).not.toMatch(/LIVE DATA/);
    });

    it("counts only real evaluators in Evaluator Coverage and lists planned ones as Belum tersedia", async () => {
      stubRouted();
      render(<StressTestDetail runId="run-1" />);
      expect(await screen.findByTestId("stress-test-evaluator-coverage")).toHaveTextContent("2/2");
      const rows = screen.getByTestId("stress-test-evaluator-rows");
      expect(rows).toHaveTextContent("Visual Evaluator");
      expect(within(rows).getAllByText("Belum tersedia")).toHaveLength(3);
      expect(screen.getByTestId("stress-test-data-coverage")).toHaveTextContent(
        "First MessageBelum terhubung",
      );
    });

    it("keeps the experiment draft button disabled with an honest reason", async () => {
      stubRouted();
      render(<StressTestDetail runId="run-1" />);
      const button = await screen.findByTestId("stress-test-experiment-button");
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", expect.stringContaining("belum tersedia"));
    });

    it("links Run Lagi / Duplicate Run to the builder with the run prefilled", async () => {
      stubRouted();
      render(<StressTestDetail runId="run-1" />);
      await screen.findByTestId("stress-test-scoring-card");
      expect(screen.getByTestId("stress-test-run-again-link")).toHaveAttribute(
        "href",
        "/samantha/stress-test/run?fromRun=run-1&intent=rerun",
      );
      expect(screen.getByTestId("stress-test-duplicate-link")).toHaveAttribute(
        "href",
        "/samantha/stress-test/run?fromRun=run-1&intent=duplicate",
      );
    });

    it("compares against another real evaluated run with real score deltas", async () => {
      stubRouted([
        {
          ...RUN,
          id: "run-0",
          name: "Run sebelumnya",
          createdAt: "2026-09-20T00:00:00.000Z",
          result: {
            ...RICH_RESULT,
            overallScore: 30,
            scoreBucket: "MAJOR_ISSUES",
            dimensionScores: [{ dimension: "CTA", score: 35 }],
          },
        },
        {
          ...RUN,
          id: "run-legacy",
          name: "Legacy",
          status: "WAITING_FOR_ENGINE",
          result: { kind: "WAITING_FOR_ENGINE", reason: "x", objectionSourceAvailability: [] },
        },
      ]);
      render(<StressTestDetail runId="run-1" />);
      fireEvent.click(await screen.findByTestId("stress-test-compare-button"));
      const select = await screen.findByTestId("stress-test-compare-select");
      expect(within(select).queryByText(/Legacy/)).not.toBeInTheDocument();
      fireEvent.change(select, { target: { value: "run-0" } });
      const table = await screen.findByTestId("stress-test-compare-table");
      expect(table).toHaveTextContent("Creative Readiness Score4230+12");
      expect(table).toHaveTextContent("Hook90—");
    });

    it("renders the Kai preview sections from the existing brief composer plus the knowledge gap", async () => {
      stubRouted();
      render(<StressTestDetail runId="run-1" />);
      const preview = await screen.findByTestId("stress-test-kai-preview");
      expect(preview).toHaveTextContent("Pertahankan");
      expect(preview).toHaveTextContent("Ubah");
      expect(screen.getByTestId("stress-test-kai-knowledge-gaps")).toHaveTextContent(
        "Tidak dapat diverifikasi.",
      );
    });
  });
});

describe("StressTestDetail — objection resolution, progress, partial results", () => {
  const RUN = {
    id: "run-1",
    name: "Run 1",
    sourceType: "CAMPAIGN_DRAFT",
    creativeIds: [],
    mode: "STANDARD",
    primaryGoal: "CPQL",
    personaIds: ["PRICE_SENSITIVE", "SKEPTICAL_BUYER"],
    objectionSources: [],
    createdAt: "2026-09-28T00:00:00.000Z",
  };
  const PERSONAS = [
    {
      personaId: "PRICE_SENSITIVE",
      personaLabel: "Price Sensitive",
      ok: true,
      critique: {
        simulated: true,
        attracts: ["Lokasi"],
        confusions: [],
        objections: [{ objection: "Harga terlalu tinggi", severity: "HIGH" }],
        intentDrivers: [],
        narrativeReaction: "Mahal.",
      },
    },
    {
      personaId: "SKEPTICAL_BUYER",
      personaLabel: "Skeptical Buyer",
      ok: true,
      critique: {
        simulated: true,
        attracts: ["Lokasi"],
        confusions: [],
        objections: [{ objection: "Sertifikat belum jelas", severity: "MEDIUM" }],
        intentDrivers: [],
        narrativeReaction: "Ragu.",
      },
    },
  ];
  const PROGRESS_RUNNING = {
    updatedAt: "2026-09-28T00:00:05.000Z",
    steps: [
      { key: "PERSONA_SIMULATION", state: "RUNNING", done: 1, total: 2, failed: 0 },
      { key: "COPY_EVALUATION", state: "DONE" },
      { key: "FACT_VALIDATION", state: "SKIPPED" },
      { key: "OBJECTION_RESOLUTION", state: "PENDING" },
    ],
  };
  const COMPLETED = {
    kind: "COMPLETED",
    personaCritiques: PERSONAS,
    copyEvaluation: { ok: false, failureReason: "x" },
    factCheck: { status: "NOT_APPLICABLE", note: "Tidak ada knowledge.", findings: [] },
    dimensionScores: [{ dimension: "OBJECTION_HANDLING", score: 70 }],
    overallScore: 70,
    scoreBucket: "MINOR_REVISION",
    confidence: 60,
    primaryRecommendation: "Jawab keberatan harga.",
    evaluatorsAttempted: 4,
    evaluatorsSucceeded: 3,
    gaps: [],
    objectionResolution: {
      status: "ASSESSED",
      simulated: true,
      note: "Penilaian AI",
      items: [
        {
          key: "harga terlalu tinggi",
          objection: "Harga terlalu tinggi",
          resolutionStatus: "PARTIAL",
          goalImpact: "VERY_HIGH",
          shortRecommendation: "Tambahkan harga per meter.",
          evidence: "Harga Rp 1,5 M",
        },
      ],
    },
  };

  function stubRun(...responses: unknown[]): ReturnType<typeof vi.fn> {
    let i = 0;
    const fn = vi.fn(async (url: string) => {
      if (url === "/api/creative-stress-test/run-1") {
        const body = responses[Math.min(i, responses.length - 1)];
        i += 1;
        return { ok: true, json: async () => body };
      }
      if (url === "/api/creative-stress-test")
        return { ok: true, json: async () => ({ runs: [] }) };
      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  function runFetches(fn: ReturnType<typeof vi.fn>): number {
    return fn.mock.calls.filter(([u]) => u === "/api/creative-stress-test/run-1").length;
  }

  it("renders real resolution badges, AI-labelled impact and recommendation; unassessed rows stay 'Belum dinilai'; evidence in the drawer", async () => {
    stubRun({ ...RUN, status: "COMPLETED", result: COMPLETED });
    render(<StressTestDetail runId="run-1" />);
    await screen.findByTestId("stress-test-objection-table");
    const resolutions = screen.getAllByTestId("objection-resolution").map((c) => c.textContent);
    expect(resolutions).toEqual(["Sebagian Terjawab", "Belum dinilai"]);
    expect(screen.getAllByTestId("objection-impact").map((c) => c.textContent)).toEqual([
      "Sangat Tinggi",
      "—",
    ]);
    expect(screen.getByTestId("objection-impact-ai-badge")).toHaveTextContent(
      "Estimasi AI (simulasi)",
    );
    expect(screen.getAllByTestId("objection-recommendation")[0]).toHaveTextContent(
      "Tambahkan harga per meter.",
    );
    expect(screen.queryByTestId("objection-resolution-note")).not.toBeInTheDocument();
    // Resolution tab lit up from the real count.
    expect(screen.getByRole("tab", { name: "Partial (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Resolved/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Lihat Detail →" })[0] as HTMLElement);
    const drawer = await screen.findByTestId("objection-detail-drawer");
    expect(within(drawer).getByTestId("objection-detail-evidence")).toHaveTextContent(
      "Harga Rp 1,5 M",
    );
    expect(within(drawer).getByTestId("objection-detail-resolution")).toHaveTextContent(
      "Estimasi AI (simulasi)",
    );
  });

  it("FAILED run with a real partial result: 'Hasil parsial' banner, available sections only, no readiness/score", async () => {
    stubRun({
      ...RUN,
      status: "FAILED",
      failedReason: "Run gagal karena error internal: kaboom",
      result: {
        kind: "PARTIAL",
        partial: true,
        hasRealOutput: true,
        personaCritiques: PERSONAS,
        evaluatorsAttempted: 2,
        evaluatorsSucceeded: 2,
        gaps: ["Run gagal karena error internal: kaboom"],
        progress: {
          ...PROGRESS_RUNNING,
          steps: PROGRESS_RUNNING.steps.map((s) => ({ ...s, state: "FAILED" })),
        },
      },
    });
    render(<StressTestDetail runId="run-1" />);
    const banner = await screen.findByTestId("stress-test-partial-banner");
    expect(banner).toHaveTextContent("Hasil parsial — run gagal");
    expect(banner).toHaveTextContent("kaboom");
    expect(screen.getByTestId("stress-test-partial-missing")).toHaveTextContent(
      "Copy Evaluator — gagal atau tidak selesai.",
    );
    expect(screen.getByTestId("stress-test-objection-table")).toBeInTheDocument();
    expect(screen.queryByTestId("stress-test-scoring-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stress-test-overall-score")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stress-test-score-bucket")).not.toBeInTheDocument();
  });

  it("FAILED run without real output keeps the error card (no partial sections)", async () => {
    stubRun({
      ...RUN,
      status: "FAILED",
      failedReason: "Semua evaluator gagal",
      result: {
        kind: "PARTIAL",
        partial: true,
        hasRealOutput: false,
        personaCritiques: [],
        evaluatorsAttempted: 3,
        evaluatorsSucceeded: 0,
        gaps: [],
        progress: PROGRESS_RUNNING,
      },
    });
    render(<StressTestDetail runId="run-1" />);
    await screen.findByTestId("stress-test-detail-result-card");
    expect(screen.queryByTestId("stress-test-partial-banner")).not.toBeInTheDocument();
    expect(screen.getByText("Semua evaluator gagal")).toBeInTheDocument();
  });

  it("RUNNING: shows the real step checklist, polls every 3s, and stops polling once the run completes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const fn = stubRun(
        { ...RUN, status: "RUNNING", result: { kind: "IN_PROGRESS", progress: PROGRESS_RUNNING } },
        { ...RUN, status: "COMPLETED", result: COMPLETED },
      );
      render(<StressTestDetail runId="run-1" />);
      const progress = await screen.findByTestId("stress-test-detail-progress");
      expect(progress).toHaveTextContent("Persona 1/2");
      expect(progress).toHaveTextContent("Copy ✓");
      expect(progress).toHaveTextContent("2/4 evaluator");
      expect(runFetches(fn)).toBe(1);

      await vi.advanceTimersByTimeAsync(3000);
      await screen.findByTestId("stress-test-scoring-card");
      expect(runFetches(fn)).toBe(2);

      await vi.advanceTimersByTimeAsync(10_000);
      expect(runFetches(fn)).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("legacy RUNNING run without persisted progress keeps the generic 'Sedang dievaluasi' text", async () => {
    stubRun({ ...RUN, status: "RUNNING", result: null });
    render(<StressTestDetail runId="run-1" />);
    const box = await screen.findByTestId("stress-test-in-progress");
    expect(box).toHaveTextContent("Sedang dievaluasi");
    expect(screen.queryByTestId("stress-test-detail-progress")).not.toBeInTheDocument();
  });
});
