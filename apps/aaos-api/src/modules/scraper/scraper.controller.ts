import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import { concat, defer, from, interval, type Observable } from "rxjs";
import { distinctUntilChanged, map, switchMap, takeWhile } from "rxjs/operators";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  GetStockQuerySchema,
  RunScrapeBodySchema,
  type GetStockQueryDto,
  type RunScrapeBodyDto,
  type RunScrapeResponseDto,
  type ScrapedUnitDto,
  type ScrapeJobDto,
  type ScraperStatusResponseDto,
  type StockListResponseDto,
} from "./dto/scraper.dto.js";
import { ScraperService } from "./scraper.service.js";

/** How often the SSE stream re-reads the job's persisted state. Exported so the spec drives it with fake timers rather than real waits. */
export const STREAM_POLL_INTERVAL_MS = 1000;

/**
 * `GET/POST /api/v1/scraper*` — `x-api-key` auth (same discipline as `SimulationController`).
 *
 * Route order matters for Nest's matcher: the literal `stock`/`jobs` segments and their `:param`
 * children are declared before anything that could shadow them, and `jobs/:jobId/stream` is declared
 * before `jobs/:jobId` so the 3-segment SSE route is matched first.
 */
@Controller("api/v1/scraper")
@UseGuards(ApiKeyGuard)
export class ScraperController {
  constructor(private readonly service: ScraperService) {}

  @Get("status")
  async status(): Promise<ScraperStatusResponseDto> {
    return this.service.getStatus();
  }

  @Get("stock")
  async stock(
    @Query(new ZodValidationPipe(GetStockQuerySchema)) query: GetStockQueryDto,
  ): Promise<StockListResponseDto> {
    return this.service.getStock(query);
  }

  @Get("stock/:unitId")
  async unit(@Param("unitId") unitId: string): Promise<ScrapedUnitDto> {
    return this.service.getUnit(unitId);
  }

  @Post("run")
  @HttpCode(202)
  async run(
    @Body(new ZodValidationPipe(RunScrapeBodySchema)) body: RunScrapeBodyDto,
  ): Promise<RunScrapeResponseDto> {
    return this.service.run(body);
  }

  @Get("jobs")
  async jobs(): Promise<readonly ScrapeJobDto[]> {
    return this.service.listJobs();
  }

  /**
   * Real Server-Sent Events progress stream — the FIRST `@Sse()` route in this codebase (nothing
   * existed to copy from beyond NestJS itself). Nest's `@Sse()` support works under the Fastify
   * adapter because `RouterResponseController.sse` is handed `reply.raw`/`request.raw` (the native
   * `ServerResponse`/`IncomingMessage`), not Fastify's wrapper objects — verified against
   * `@nestjs/core`'s `router-execution-context.js`, and exercised end-to-end by
   * `test/scraper.e2e.spec.ts` over a real HTTP socket.
   *
   * The stream is a projection of the SAME persisted job state `GET .../jobs/:jobId` returns
   * (`scrape_jobs` + `scrape_job_logs`), re-read on an interval — deliberately NOT an in-process
   * event emitter the scrape pipeline pushes into. That choice is what makes this correct across a
   * restart or a second replica: any instance can serve the stream for a job another instance is
   * running, because the source of truth is the database, not this process's memory.
   *
   * Emits the current snapshot immediately (so a client attaching late isn't stuck on an empty
   * stream), then only on genuine change (`distinctUntilChanged` over the serialized snapshot), and
   * completes once the job is no longer `RUNNING` — at which point Nest ends the response and the
   * browser's `EventSource` sees a normal close.
   *
   * NOTE: the browser never connects here directly — `EventSource` cannot set the `x-api-key` header
   * `ApiKeyGuard` requires. `apps/aaos-dashboard`'s own
   * `/api/scraper/jobs/[jobId]/stream` route proxies this server-side with the real key.
   */
  @Sse("jobs/:jobId/stream")
  stream(@Param("jobId") jobId: string): Observable<MessageEvent> {
    const snapshot = defer(() => from(this.service.getJob(jobId)));
    return concat(snapshot, interval(STREAM_POLL_INTERVAL_MS).pipe(switchMap(() => snapshot))).pipe(
      // `takeWhile(..., true)` keeps the FINAL non-RUNNING snapshot — without the inclusive flag the
      // client would never receive the terminal DONE/ERROR state it is waiting for.
      takeWhile((job) => job.status === "RUNNING", true),
      distinctUntilChanged((previous, next) => JSON.stringify(previous) === JSON.stringify(next)),
      map((job): MessageEvent => ({ data: job })),
    );
  }

  @Get("jobs/:jobId")
  async job(@Param("jobId") jobId: string): Promise<ScrapeJobDto> {
    return this.service.getJob(jobId);
  }
}
