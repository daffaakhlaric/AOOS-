import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeUpdateReport } from "../../src/entities/knowledge-update-report.js";
import { KnowledgeUpdateResult } from "../../src/entities/knowledge-update-result.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeAutoUpdateEventType } from "../../src/events/knowledge-auto-update-event-type.js";
import { PublishEventsStage } from "../../src/pipeline/stages/publish-events-stage.js";
import { KnowledgeUpdateReportType } from "../../src/types/report-type.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeJob, resetFixtureState } from "../helpers/fixtures.js";
import { makeContext, makePipelineServices } from "../helpers/pipeline-helpers.js";

describe("PublishEventsStage", () => {
  beforeEach(resetFixtureState);

  it("publishes ReportGenerated when context.report is present", () => {
    const publisher = new InMemoryEventPublisher();
    const context = makeContext({ services: makePipelineServices(undefined, publisher) });
    context.report = new KnowledgeUpdateReport({
      id: "r-1",
      type: KnowledgeUpdateReportType.UpdateSummary,
      generatedAt: 0,
      data: {},
    });
    new PublishEventsStage().execute(context);
    expect(
      publisher
        .getHistory()
        .some((e) => e.eventType === KnowledgeAutoUpdateEventType.ReportGenerated),
    ).toBe(true);
  });

  it("does not publish ReportGenerated when context.report is absent", () => {
    const publisher = new InMemoryEventPublisher();
    const context = makeContext({ services: makePipelineServices(undefined, publisher) });
    new PublishEventsStage().execute(context);
    expect(publisher.getHistory()).toHaveLength(0);
  });

  it("publishes KnowledgeRefreshed and records refresh stats for a successful Refresh job", () => {
    const publisher = new InMemoryEventPublisher();
    const job = makeJob({ updateType: KnowledgeUpdateType.Refresh });
    const context = makeContext({ job, services: makePipelineServices(undefined, publisher) });
    context.result = new KnowledgeUpdateResult({
      id: "r-1",
      taskId: "t-1",
      jobId: job.id,
      success: true,
      appliedPayload: {},
      errorMessage: undefined,
      durationMs: 15,
      completedAt: 0,
    });
    new PublishEventsStage().execute(context);
    expect(
      publisher
        .getHistory()
        .some((e) => e.eventType === KnowledgeAutoUpdateEventType.KnowledgeRefreshed),
    ).toBe(true);
    expect(context.statistics.snapshot().refreshDurationsMs).toEqual([15]);
  });

  it("does not publish KnowledgeRefreshed for a failed Refresh job", () => {
    const publisher = new InMemoryEventPublisher();
    const job = makeJob({ updateType: KnowledgeUpdateType.Refresh });
    const context = makeContext({ job, services: makePipelineServices(undefined, publisher) });
    context.result = new KnowledgeUpdateResult({
      id: "r-1",
      taskId: "t-1",
      jobId: job.id,
      success: false,
      appliedPayload: undefined,
      errorMessage: "x",
      durationMs: 0,
      completedAt: 0,
    });
    new PublishEventsStage().execute(context);
    expect(
      publisher
        .getHistory()
        .some((e) => e.eventType === KnowledgeAutoUpdateEventType.KnowledgeRefreshed),
    ).toBe(false);
  });

  it("does not publish KnowledgeRefreshed for a non-Refresh update type", () => {
    const publisher = new InMemoryEventPublisher();
    const job = makeJob({ updateType: KnowledgeUpdateType.Manual });
    const context = makeContext({ job, services: makePipelineServices(undefined, publisher) });
    context.result = new KnowledgeUpdateResult({
      id: "r-1",
      taskId: "t-1",
      jobId: job.id,
      success: true,
      appliedPayload: {},
      errorMessage: undefined,
      durationMs: 0,
      completedAt: 0,
    });
    new PublishEventsStage().execute(context);
    expect(
      publisher
        .getHistory()
        .some((e) => e.eventType === KnowledgeAutoUpdateEventType.KnowledgeRefreshed),
    ).toBe(false);
  });
});
