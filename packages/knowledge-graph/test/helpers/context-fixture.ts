import { ConfigurationService } from "../../src/configuration/configuration-service.js";
import type { GraphConfiguration } from "../../src/domain/graph-configuration.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import {
  createGraphSystemContext,
  type GraphSystemContext,
} from "../../src/manager/graph-system-context.js";
import type { PipelineMiddleware } from "../../src/middleware/pipeline-middleware.js";
import { GraphOperationPipeline } from "../../src/pipeline/graph-operation-pipeline.js";
import { DEFAULT_CONFIGURATION_KEY } from "../../src/registry/configuration-registry.js";

/** Builds a fresh `GraphSystemContext` with a resolved default configuration already registered. */
export function buildTestContext(
  configuration: GraphConfiguration = {},
  middlewares: readonly PipelineMiddleware[] = [],
): GraphSystemContext {
  const eventPublisher = new InMemoryEventPublisher();
  const ctx = createGraphSystemContext(eventPublisher, new GraphOperationPipeline(middlewares));
  ctx.configurationRegistry.put(
    DEFAULT_CONFIGURATION_KEY,
    new ConfigurationService().resolve(configuration),
  );
  return ctx;
}

export { DEFAULT_CONFIGURATION_KEY };
