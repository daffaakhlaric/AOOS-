import { beforeEach, describe, expect, it } from "vitest";

import { InvalidKnowledgeItemException } from "../../../src/errors/invalid-knowledge-item-exception.js";
import type { PipelineContext } from "../../../src/pipeline/pipeline-stage.js";
import { CollectKnowledgeStage } from "../../../src/pipeline/stages/collect-knowledge-stage.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../../helpers/fixtures.js";
import { makeServices } from "../../helpers/pipeline-helpers.js";

describe("CollectKnowledgeStage", () => {
  beforeEach(() => resetFixtureState());

  function makeContext(items: ReturnType<typeof makeItem>[]): PipelineContext {
    const clock = makeClock(0);
    return { items, runId: "run-1", ...makeServices(clock, makeConfig()) };
  }

  it("passes through a valid, unique-id item set", () => {
    const stage = new CollectKnowledgeStage();
    const context = makeContext([makeItem({ id: "a" }), makeItem({ id: "b" })]);
    expect(stage.execute(context)).toBe(context);
  });

  it("throws for an empty item id", () => {
    const stage = new CollectKnowledgeStage();
    const context = makeContext([makeItem({ id: " " })]);
    expect(() => stage.execute(context)).toThrow(InvalidKnowledgeItemException);
  });

  it("throws for duplicate item ids", () => {
    const stage = new CollectKnowledgeStage();
    const context = makeContext([makeItem({ id: "dup" }), makeItem({ id: "dup" })]);
    expect(() => stage.execute(context)).toThrow(InvalidKnowledgeItemException);
  });

  it("accepts an empty item set", () => {
    const stage = new CollectKnowledgeStage();
    expect(() => stage.execute(makeContext([]))).not.toThrow();
  });
});
