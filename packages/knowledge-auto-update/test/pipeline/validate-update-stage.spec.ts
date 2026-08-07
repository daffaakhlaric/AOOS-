import { beforeEach, describe, expect, it } from "vitest";

import { ValidationFailedException } from "../../src/errors/validation-failed-exception.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeAutoUpdateEventType } from "../../src/events/knowledge-auto-update-event-type.js";
import { ValidateUpdateStage } from "../../src/pipeline/stages/validate-update-stage.js";
import { makeJob, resetFixtureState } from "../helpers/fixtures.js";
import { makeContext, makePipelineServices } from "../helpers/pipeline-helpers.js";

describe("ValidateUpdateStage", () => {
  beforeEach(resetFixtureState);

  it("passes through and records validation stats for a well-formed job", () => {
    const context = makeContext();
    const result = new ValidateUpdateStage().execute(context);
    expect(result.statistics.snapshot().validationDurationsMs).toEqual([0]);
  });

  it("publishes UpdateValidated", () => {
    const publisher = new InMemoryEventPublisher();
    const context = makeContext({ services: makePipelineServices(undefined, publisher) });
    new ValidateUpdateStage().execute(context);
    expect(
      publisher
        .getHistory()
        .some((e) => e.eventType === KnowledgeAutoUpdateEventType.UpdateValidated),
    ).toBe(true);
  });

  it("throws ValidationFailedException for a structurally invalid job", () => {
    const job = makeJob({ targetId: "" });
    const context = makeContext({ job });
    expect(() => new ValidateUpdateStage().execute(context)).toThrow(ValidationFailedException);
  });
});
