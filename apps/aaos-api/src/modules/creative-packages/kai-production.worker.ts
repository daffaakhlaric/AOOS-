import { randomUUID } from "node:crypto";

import {
  AspectRatio,
  TaskId,
  VideoModel,
  type CreativeConnectorBundle,
} from "@aos/creative-connector";
import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnModuleInit,
  type OnModuleDestroy,
} from "@nestjs/common";

import { CREATIVE_CONNECTOR_RUNTIME } from "../../di-tokens.js";
import { ListingsService } from "../listings/listings.service.js";

import {
  ProductionPlanSchema,
  prepareProduction,
  type ProductionJob,
} from "./domain/kai-production.js";
import { CreativeHandoffRepository } from "./infrastructure/creative-handoff.repository.js";
import { KaiProductionRepository } from "./infrastructure/kai-production.repository.js";
import { KaiProductionMediaService } from "./kai-production-media.service.js";

/** One checkpoint per lease. Restarts resume polling/ingestion, never blindly repeat a paid submit. */
@Injectable()
export class KaiProductionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KaiProductionWorker.name);
  private readonly workerId = randomUUID();
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopped = false;
  constructor(
    private readonly jobs: KaiProductionRepository,
    private readonly handoff: CreativeHandoffRepository,
    private readonly listings: ListingsService,
    private readonly media: KaiProductionMediaService,
    @Optional()
    @Inject(CREATIVE_CONNECTOR_RUNTIME)
    private readonly connector: CreativeConnectorBundle | undefined,
  ) {}
  onModuleInit() {
    if (
      !this.connector ||
      !this.media.available ||
      process.env["KAI_PRODUCTION_WORKER_ENABLED"] === "false"
    )
      return;
    this.timer = setInterval(() => void this.tick(), 3000);
    this.timer.unref();
    void this.tick();
  }
  async onModuleDestroy() {
    this.stopped = true;
    clearInterval(this.timer);
    await this.running;
  }
  async tick(): Promise<void> {
    if (this.stopped || this.running || !this.connector || !this.media.available) return;
    this.running = this.runOnce().catch(() =>
      this.logger.warn("Production checkpoint unavailable; will resume from persisted state."),
    );
    try {
      await this.running;
    } finally {
      this.running = undefined;
    }
  }
  private async runOnce() {
    let job = await this.jobs.claim(this.workerId);
    if (!job) return;
    // A previous process may have submitted successfully without receiving/persisting the task ID.
    if (job.status === "SUBMITTING") {
      await this.finish(job, {
        status: "FAILED",
        error_code: "SUBMISSION_UNCERTAIN",
        error_message:
          "Status pengiriman ke KIE belum pasti. Rekonsiliasi task sebelum mencoba generasi baru.",
      });
      return;
    }
    let leaseLost = false;
    const heartbeat = setInterval(() => {
      void this.jobs
        .update(job!, { lease_until: new Date(Date.now() + 120000).toISOString() })
        .catch(() => {
          leaseLost = true;
        });
    }, 30000);
    heartbeat.unref();
    try {
      const { project, brief } = await this.handoff.getProject(job.tenant_id, job.project_id);
      if (project.creative_brief_id !== job.brief_id || project.status === "NEEDS_INPUT") {
        await this.finish(job, { status: "CANCELLED", error_code: "BRIEF_SUPERSEDED" });
        return;
      }
      const concept = await this.jobs.context(job);
      const plan = ProductionPlanSchema.parse(job.plan);
      if (plan.format !== job.format || !brief.listingId)
        throw new Error("INVALID_PRODUCTION_PLAN");
      const listing = await this.listings.getById(job.tenant_id, brief.listingId);
      const prepared = prepareProduction(
        plan,
        brief,
        concept.aspectRatios,
        listing.photos.map((p) => p.url),
      );
      if (!job.output)
        job = await this.jobs.update(job, {
          output: prepared,
          ...(job.format === "VIDEO" &&
          prepared.units.every((u) => u.productionMethod === "SOURCE_MOTION")
            ? { model: "source-motion-ffmpeg" }
            : {}),
        });
      const output = job.output!;
      const unit = output.units[output.cursor];
      if (leaseLost) throw new Error("JOB_LEASE_LOST");
      switch (job.status) {
        case "QUEUED": {
          if (!unit || unit.asset || unit.taskId) throw new Error("INVALID_SUBMISSION_STATE");
          if (this.stopped) return;
          if (job.format === "VIDEO" && unit.productionMethod === "SOURCE_MOTION") {
            unit.asset = await this.media.renderSourceMotion(job, unit, brief);
            output.cursor++;
            await this.finish(job, {
              status: output.cursor < output.units.length ? "QUEUED" : "QA",
              output,
              attempt: 0,
            });
            return;
          }
          // Saved before the external side effect, so even timeout/network ambiguity cannot spend twice.
          job = await this.jobs.update(job, {
            status: "SUBMITTING",
            error_code: null,
            error_message: null,
          });
          const result =
            job.format === "VIDEO"
              ? await this.connector!.videoGenerationService.generateFromImage({
                  sourceImageUrls: [unit.sourceUrl],
                  prompt: unit.prompt,
                  model: VideoModel.VEO3_FAST,
                  aspectRatio: unit.ratio as AspectRatio,
                })
              : await this.connector!.imageGenerationService.generate({
                  sourceImageUrls: [unit.sourceUrl],
                  prompt: unit.prompt,
                  aspectRatio: unit.ratio as AspectRatio,
                  outputFormat: "jpg",
                });
          if (!result.ok) {
            await this.finish(job, {
              status: "FAILED",
              error_code: "PROVIDER_SUBMISSION_FAILED",
              error_message: "KIE tidak mengonfirmasi task. Tidak ada pengiriman ulang otomatis.",
            });
            return;
          }
          unit.taskId = result.value.taskId.toString();
          unit.submittedAt = new Date().toISOString();
          await this.finish(
            job,
            { status: "RUNNING", provider_task_id: unit.taskId, output, attempt: 0 },
            10000,
          );
          return;
        }
        case "RUNNING": {
          if (!unit?.taskId || unit.taskId !== job.provider_task_id)
            throw new Error("MISSING_PROVIDER_TASK");
          if (Date.now() - Date.parse(unit.submittedAt ?? job.created_at) > 2 * 60 * 60 * 1000)
            throw new Error("PROVIDER_TIMEOUT");
          const task = TaskId.create(unit.taskId);
          if (!task.ok) throw new Error("INVALID_PROVIDER_TASK");
          const result = await this.connector!.getTaskStatus.execute(
            task.value,
            job.format === "VIDEO" ? "video" : "image",
          );
          if (!result.ok) throw new Error("PROVIDER_POLL_UNAVAILABLE");
          if (result.value.successFlag === 0) {
            await this.finish(job, { attempt: 0 }, 15000);
            return;
          }
          if (result.value.successFlag !== 1) throw new Error("PROVIDER_GENERATION_FAILED");
          const url =
            job.format === "VIDEO"
              ? result.value.videoUrl
              : (result.value.imageUrl ?? result.value.images?.[0]);
          if (!url) throw new Error("PROVIDER_OUTPUT_MISSING");
          unit.providerUrl = url;
          await this.finish(job, { status: "INGESTING", output, attempt: 0 });
          return;
        }
        case "INGESTING": {
          if (!unit?.providerUrl || !unit.taskId) throw new Error("PROVIDER_OUTPUT_MISSING");
          unit.asset = await this.media.ingest(job, unit, brief);
          output.cursor++;
          if (job.format !== "VIDEO")
            output.assets = output.units.flatMap((u) => (u.asset ? [u.asset] : []));
          await this.finish(job, {
            status: output.cursor < output.units.length ? "QUEUED" : "QA",
            output,
            provider_task_id: null,
            attempt: 0,
          });
          return;
        }
        case "QA": {
          if (job.format === "VIDEO" && !output.assets.length) {
            output.assets = await this.media.assembleVideo(job);
            job = await this.jobs.update(job, { output });
          }
          if (!output.qa) {
            output.qa = await this.media.assess(job, brief);
            job = await this.jobs.update(job, { output });
          }
          // Re-read before exposing a final result: a new brief must not inherit this asset's QA.
          const latest = await this.handoff.getProject(job.tenant_id, job.project_id);
          if (latest.project.creative_brief_id !== job.brief_id)
            throw new Error("BRIEF_SUPERSEDED");
          if (plan.renderMode !== "SAMPLE") await this.jobs.syncPackage(job, brief);
          await this.finish(job, {
            status: output.qa.passed
              ? plan.renderMode === "SAMPLE"
                ? "SAMPLE_READY"
                : "READY"
              : "QA_FAILED",
            error_code: output.qa.passed ? null : "QA_REVIEW_REQUIRED",
            attempt: 0,
          });
          return;
        }
      }
    } catch (error) {
      const code =
        error instanceof Error && /^[A-Z_]+$/.test(error.message)
          ? error.message
          : "PRODUCTION_STEP_FAILED";
      if (code === "JOB_LEASE_LOST" || leaseLost) return;
      if (job.status === "SUBMITTING") {
        await this.finish(job, {
          status: "FAILED",
          error_code: "SUBMISSION_UNCERTAIN",
          error_message: "Pengiriman KIE belum dapat dipastikan; tidak dikirim ulang otomatis.",
        });
        return;
      }
      const terminal = [
        "STORYBOARD_SUPERSEDED",
        "BRIEF_SUPERSEDED",
        "SOURCE_PHOTO_CHANGED",
        "UNSOURCED_STORYBOARD_CLAIM",
        "INVALID_SCENE_TIMING",
        "UNSUPPORTED_VIDEO_PLAN",
        "PROVIDER_GENERATION_FAILED",
        "PROVIDER_TIMEOUT",
      ].includes(code);
      const attempt = job.attempt + 1;
      await this.finish(
        job,
        {
          status: terminal || attempt >= 5 ? "FAILED" : job.status,
          attempt,
          error_code: code,
          error_message: "Tahap produksi belum berhasil. Detail tersimpan pada status job.",
        },
        Math.min(300000, 10000 * 2 ** attempt),
      );
    } finally {
      clearInterval(heartbeat);
    }
  }
  private finish(job: ProductionJob, values: Partial<ProductionJob>, delay = 0) {
    return this.jobs.update(job, {
      ...values,
      lease_owner: null,
      lease_until: null,
      next_attempt_at: new Date(Date.now() + delay).toISOString(),
    });
  }
}
