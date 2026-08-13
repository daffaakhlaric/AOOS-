import { err, ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { GetEmqScore } from "../../../src/application/use-cases/GetEmqScore.js";
import { EmqReport } from "../../../src/domain/entities/EmqReport.js";
import { CapiApiError } from "../../../src/domain/errors/CapiApiError.js";
import { CapiConnectorEvents } from "../../../src/domain/events/CapiConnectorEvents.js";
import { EmqScore } from "../../../src/domain/value-objects/EmqScore.js";
import { buildConfig } from "../../helpers/config.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const capturedAt = new Date("2026-01-01T00:00:00.000Z");
const report = unwrap(
  EmqReport.create({
    pixelId: "pixel-1",
    score: unwrap(EmqScore.create(8.5)),
    eventsReceived: 42,
    capturedAt,
  }),
);

describe("GetEmqScore", () => {
  it("fetches the report and publishes EmqScoreReceived", async () => {
    const client = { sendEvents: vi.fn(), getEmqScore: vi.fn(async () => ok(report)) };
    const publisher = createFakePublisher();
    const events = new CapiConnectorEvents(publisher);
    const config = buildConfig({ tenantId: "dss-motor" });
    const useCase = new GetEmqScore(client as never, config, events);

    const result = unwrap(await useCase.execute({ correlationId: "corr-1" }));
    expect(result).toBe(report);
    expect(publisher.published[0]).toMatchObject({
      type: "aaos.capi-connector.emq.received",
      payload: { pixelId: "pixel-1", score: 8.5, eventsReceived: 42 },
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
  });

  it("propagates a CapiApiError without publishing", async () => {
    const client = {
      sendEvents: vi.fn(),
      getEmqScore: vi.fn(async () => err(new CapiApiError("boom"))),
    };
    const publisher = createFakePublisher();
    const events = new CapiConnectorEvents(publisher);
    const config = buildConfig();
    const useCase = new GetEmqScore(client as never, config, events);

    const error = unwrapErr(await useCase.execute({ correlationId: "corr-1" }));
    expect(error.message).toBe("boom");
    expect(publisher.published).toHaveLength(0);
  });
});
