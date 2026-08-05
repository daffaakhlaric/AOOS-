import { NodeRuntime, NodeRuntimeEventPublisher } from "@aos/node-runtime";

import { fakePublisher } from "./publisher-fixture.js";

/** A real `NodeRuntime` (from `@aos/node-runtime`), with its own fake `IPublisher`. */
export function nodeRuntimeFixture(): NodeRuntime {
  const { publisher } = fakePublisher();
  return new NodeRuntime({ eventPublisher: new NodeRuntimeEventPublisher(publisher) });
}
