import { randomUUID } from "node:crypto";

import { NotFoundError } from "@aos/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../di-tokens.js";
import { LlmService } from "../llm/llm.service.js";

import { computeSimulationScoring } from "./domain/scoring.js";
import type {
  JessyPersonaRun,
  JessyStageResult,
  KaiStageResult,
  SimulationLogEntry,
  SimulationResult,
  SimulationStep,
  StoredSimulation,
  TamaraStageResult,
} from "./domain/simulation-record.js";
import type { ReviewSimulationBodyDto } from "./dto/review-simulation.dto.js";
import {
  toSimulationHistoryEntryDto,
  toSimulationStatusResponseDto,
  type SimulationHistoryEntryDto,
  type SimulationStatusResponseDto,
} from "./dto/simulation-status.dto.js";
import type { StartSimulationBodyDto } from "./dto/start-simulation.dto.js";
import { callAaosSimulator, AaosSimulatorError } from "./infrastructure/aaos-simulator-client.js";
import { SimulationRepository } from "./infrastructure/simulation.repository.js";

/**
 * Orchestrates the "Simulasi Tamara × Kai × Jessy" dry run (Steps 1-6, AAOS-DASHBOARD-SIMULASI).
 * HARD SCOPE BOUNDARY: this is a preview/scoring tool only. Nothing in this class ever creates a
 * real Meta campaign, activates real WhatsApp auto-reply, or touches real CAPI — `approve`/
 * `reject` record the manager's decision on the row only (Step 6's "Review & Approve").
 *
 * Pipeline sequencing (coordinator note #8): `start()` persists the record and returns a
 * `simulationId` immediately — it does NOT hold the HTTP connection open for the full run (Kie AI
 * video generation alone can take minutes per the original spec). The pipeline itself runs as a
 * detached async task (`void this.runPipeline(...)`); the dashboard polls
 * `GET /api/v1/simulation/:id/status` for progress.
 *
 * Step 3 (Kai) scope note: this pass wires the REAL `LlmService.creativeBrief` call (Tamara →
 * Kai handoff, same as `SimulasiClient.tsx`'s existing "Generate Brief" step) but does NOT invoke
 * `@aos/creative-agent`'s `CreativeOrchestratorService` for real Kie AI video/image generation —
 * nothing in `aaos-api` composes that orchestrator today (verified: no `CreativeOrchestratorService`
 * wiring anywhere in `app.module.ts`/`di-tokens.ts` before this task), and wiring a real, costly,
 * multi-minute external generation call into a brand-new background pipeline without being able to
 * verify it end-to-end in this environment is exactly the risk point 9 of this task's coordinator
 * note calls out. `kai.videoGenerated` is honestly `false` on every run — never a fabricated
 * video/image URL.
 */
@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    private readonly repository: SimulationRepository,
    private readonly llmService: LlmService,
  ) {}

  async start(body: StartSimulationBodyDto): Promise<{ id: string; status: "RUNNING" }> {
    const created = await this.repository.create({
      id: randomUUID(),
      tenantId: this.config.AAOS_TENANT_ID,
      objectiveSnapshot: body.objective,
      campaignDataSource: body.campaignDataSource,
      personaIds: body.personaIds,
      branch: body.branch,
    });

    // Detached on purpose (coordinator note #8) — not awaited, errors are caught and persisted
    // inside `runPipeline` itself so an unhandled rejection never crashes the process.
    void this.runPipeline(created.id, body);

    return { id: created.id, status: "RUNNING" };
  }

  private async log(
    id: string,
    step: SimulationStep,
    level: "INFO" | "WARN" | "ERROR",
    message: string,
  ): Promise<void> {
    const entry: SimulationLogEntry = { step, level, message, createdAt: new Date().toISOString() };
    try {
      await this.repository.appendLog(id, entry);
    } catch (caught) {
      // A log-write failure must never abort the pipeline itself.
      this.logger.warn(`SimulationService.log failed for ${id}: ${String(caught)}`);
    }
  }

  private async runPipeline(id: string, body: StartSimulationBodyDto): Promise<void> {
    try {
      await this.log(
        id,
        "SETUP",
        "INFO",
        "Simulasi dimulai dari data yang sudah di-cache/ditarik.",
      );

      // --- Step 2: Tamara (real /api/v1/llm/analyze, in-process — see class doc) ---
      await this.repository.updateStep(id, "TAMARA");
      await this.log(id, "TAMARA", "INFO", "Tamara sedang menganalisa data iklan…");
      const tamaraStart = Date.now();
      const analyzeResult = await this.llmService.analyze({
        campaigns: body.campaigns,
        totals: body.totals,
      });
      const tamara: TamaraStageResult = analyzeResult.available
        ? {
            available: true,
            temuan: analyzeResult.temuan,
            rekomendasi: analyzeResult.rekomendasi,
            ringkasan: analyzeResult.ringkasan,
            elapsedMs: Date.now() - tamaraStart,
            coverageScore: 0, // computed below via scoreTamaraCoverage in computeSimulationScoring's inputs
          }
        : {
            available: false,
            reason: analyzeResult.reason,
            elapsedMs: Date.now() - tamaraStart,
            coverageScore: 0,
          };
      await this.log(
        id,
        "TAMARA",
        tamara.available ? "INFO" : "WARN",
        tamara.available
          ? `Tamara selesai menganalisa dalam ${tamara.elapsedMs}ms.`
          : `Tamara tidak tersedia: ${tamara.reason ?? "unknown"}.`,
      );

      // --- Step 3: Kai (real /api/v1/llm/creative-brief; real Kie AI generation NOT invoked) ---
      await this.repository.updateStep(id, "KAI");
      await this.log(id, "KAI", "INFO", "Tamara brief Kai untuk creative refresh…");
      const kaiStart = Date.now();
      const briefResult = await this.llmService.creativeBrief({
        ad: body.kaiAd,
        angle: body.kaiAngle,
        branch: body.kaiBranch,
      });
      const kai: KaiStageResult = briefResult.available
        ? {
            available: true,
            brief: {
              unit: briefResult.unit,
              angle: briefResult.angle,
              branch: briefResult.branch,
              primaryMessage: briefResult.primaryMessage,
              tone: briefResult.tone,
              formats: briefResult.formats,
              avoid: briefResult.avoid,
              urgency: briefResult.urgency,
            },
            elapsedMs: Date.now() - kaiStart,
            videoGenerated: false,
            note: "Brief nyata dari Tamara. Generate video/gambar Kie AI belum dijalankan pada simulasi ini.",
          }
        : {
            available: false,
            reason: briefResult.reason,
            elapsedMs: Date.now() - kaiStart,
            videoGenerated: false,
            note: "Brief tidak tersedia — AI unavailable.",
          };
      await this.log(
        id,
        "KAI",
        kai.available ? "INFO" : "WARN",
        kai.available
          ? `Kai menerima brief dalam ${kai.elapsedMs}ms. Video/gambar belum digenerate (belum tersedia pada simulasi ini).`
          : `Kai tidak menerima brief: ${kai.reason ?? "unknown"}.`,
      );

      // --- Step 4+5: Jessy + AI Judge (real cross-app HTTP call to apps/aaos-simulator) ---
      await this.repository.updateStep(id, "JESSY");
      const jessy = await this.runJessyStage(id, body.personaIds);

      // --- Scoring ---
      await this.repository.updateStep(id, "JUDGE");
      const scoring = computeSimulationScoring(tamara, kai, jessy);
      const result: SimulationResult = {
        tamara: { ...tamara, coverageScore: scoring.tamaraCoverageScore },
        kai,
        jessy,
        scoring,
      };
      await this.log(
        id,
        "JUDGE",
        "INFO",
        `Skor akhir: ${scoring.overallScore} (${scoring.grade}) — verdict ${scoring.verdict}.`,
      );

      await this.repository.updateStep(id, "REVIEW");
      await this.repository.complete(id, result);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      this.logger.error(`SimulationService.runPipeline(${id}) failed: ${message}`);
      await this.log(id, "DONE", "ERROR", `Simulasi gagal: ${message}`);
      await this.repository.fail(id, message);
    }
  }

  private async runJessyStage(
    id: string,
    personaIds: readonly string[],
  ): Promise<JessyStageResult> {
    const jessyStart = Date.now();
    if (this.config.AAOS_SIMULATOR_BASE_URL.length === 0) {
      await this.log(
        id,
        "JESSY",
        "WARN",
        "AAOS_SIMULATOR_BASE_URL belum dikonfigurasi — tahap Jessy/AI Judge dilewati (bukan hasil palsu).",
      );
      return {
        available: false,
        reason: "AAOS_SIMULATOR_BASE_URL is not configured",
        runs: [],
        elapsedMs: Date.now() - jessyStart,
      };
    }

    const runs: JessyPersonaRun[] = [];
    for (const personaId of personaIds) {
      await this.log(
        id,
        "JESSY",
        "INFO",
        `Menjalankan simulasi Jessy untuk persona "${personaId}"…`,
      );
      try {
        const run = await callAaosSimulator(this.config.AAOS_SIMULATOR_BASE_URL, personaId);
        runs.push({
          personaId,
          ok: true,
          finalScore: run.finalScore,
          finalTemperature: run.finalTemperature,
          handoffTriggered: run.handoffTriggered,
          totalTurns: run.totalTurns,
          overallScore: run.overallScore,
          grade: run.grade,
          verdict: run.verdict,
          feedbackItems: run.feedbackItems,
        });
        await this.log(
          id,
          "JESSY",
          "INFO",
          `Persona "${personaId}": skor Judge ${run.overallScore} (${run.grade}).`,
        );
      } catch (caught) {
        const message = caught instanceof AaosSimulatorError ? caught.message : String(caught);
        runs.push({ personaId, ok: false, error: message });
        await this.log(id, "JESSY", "ERROR", `Persona "${personaId}" gagal: ${message}`);
      }
    }

    return { available: true, runs, elapsedMs: Date.now() - jessyStart };
  }

  async getStatus(id: string): Promise<SimulationStatusResponseDto> {
    const simulation = await this.findOrThrow(id);
    const logs = await this.repository.listLogs(id);
    return toSimulationStatusResponseDto(simulation, logs);
  }

  /** Step 6 "Review & Approve" — records the decision only. See this class's hard-scope-boundary doc: no `/api/verdicts`, no Meta/WhatsApp/CAPI call. */
  async approve(id: string, body: ReviewSimulationBodyDto): Promise<SimulationStatusResponseDto> {
    await this.findOrThrow(id);
    await this.repository.recordDecision(
      id,
      "APPROVED",
      body.decidedBy,
      body.notes,
      new Date().toISOString(),
    );
    return this.getStatus(id);
  }

  async reject(id: string, body: ReviewSimulationBodyDto): Promise<SimulationStatusResponseDto> {
    await this.findOrThrow(id);
    await this.repository.recordDecision(
      id,
      "REJECTED",
      body.decidedBy,
      body.notes,
      new Date().toISOString(),
    );
    return this.getStatus(id);
  }

  async history(): Promise<readonly SimulationHistoryEntryDto[]> {
    const simulations = await this.repository.list();
    return simulations.map(toSimulationHistoryEntryDto);
  }

  private async findOrThrow(id: string): Promise<StoredSimulation> {
    const simulation = await this.repository.findById(id);
    if (simulation === undefined) {
      throw new NotFoundError(`No simulation found with id "${id}"`);
    }
    return simulation;
  }
}
