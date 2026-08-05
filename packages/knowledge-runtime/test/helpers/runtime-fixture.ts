import type { KnowledgeRuntimeConfig } from "../../src/config/knowledge-runtime-config.js";
import { KnowledgeRuntimeEvents } from "../../src/events/knowledge-runtime-events.js";
import { KnowledgeRuntime } from "../../src/runtime/knowledge-runtime.js";

import { engineFixture, type EngineFixture } from "./engine-fixture.js";
import { fakePublisher } from "./publisher-fixture.js";

export interface RuntimeFixture extends EngineFixture {
  readonly runtime: KnowledgeRuntime;
  readonly publish: ReturnType<typeof fakePublisher>["publish"];
}

export async function runtimeFixture(config?: KnowledgeRuntimeConfig): Promise<RuntimeFixture> {
  const { engine, asset } = await engineFixture();
  const { publisher, publish } = fakePublisher();
  const runtime = new KnowledgeRuntime({
    knowledgeEngine: engine,
    events: new KnowledgeRuntimeEvents(publisher),
    config,
  });
  return { engine, asset, runtime, publish };
}
