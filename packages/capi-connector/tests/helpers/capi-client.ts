import { err, ok, type Result } from "@aos/common";
import { vi } from "vitest";

import type { ICapiClient, SendEventsResult } from "../../src/contracts/ICapiClient.js";
import { EmqReport } from "../../src/domain/entities/EmqReport.js";
import { CapiApiError } from "../../src/domain/errors/CapiApiError.js";
import { EmqScore } from "../../src/domain/value-objects/EmqScore.js";

export interface FakeCapiClientOptions {
  readonly sendEventsResult?: Result<SendEventsResult, CapiApiError>;
  readonly emqReportResult?: Result<EmqReport, CapiApiError>;
}

/** A spy-based `ICapiClient` test double — for unit tests of `EventBatcherService`/`CapiEventService`/`GetEmqScore` that don't need real HTTP (MSW-mocked `MetaCapiClient` integration tests cover the real HTTP path instead). */
export function createFakeCapiClient(options: FakeCapiClientOptions = {}): ICapiClient & {
  sendEvents: ReturnType<typeof vi.fn>;
  getEmqScore: ReturnType<typeof vi.fn>;
} {
  const defaultEmqReport = EmqReport.create({
    pixelId: "pixel-1",
    score: (EmqScore.create(8) as { ok: true; value: EmqScore }).value,
    eventsReceived: 10,
    capturedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const emqReportResult: Result<EmqReport, CapiApiError> =
    options.emqReportResult ??
    (defaultEmqReport.ok
      ? ok(defaultEmqReport.value)
      : err(new CapiApiError("fixture build failed")));

  return {
    sendEvents: vi.fn(
      async (): Promise<Result<SendEventsResult, CapiApiError>> =>
        options.sendEventsResult ?? ok({ eventsReceived: 1, fbtraceId: "trace-1" }),
    ),
    getEmqScore: vi.fn(async (): Promise<Result<EmqReport, CapiApiError>> => emqReportResult),
  };
}
