import type { ResolvedGraphConfiguration } from "../domain/graph-configuration.js";
import type { PipelineMiddleware } from "../middleware/pipeline-middleware.js";

import { runAuthorizationStage } from "./authorization-stage.js";
import { runCycleDetectionStage } from "./cycle-detection-stage.js";
import { runEventsStage } from "./events-stage.js";
import { runExecutionStage } from "./execution-stage.js";
import type { GraphOperationDescriptor } from "./graph-operation-descriptor.js";
import { runMetricsStage } from "./metrics-stage.js";
import { runRelationshipValidationStage } from "./relationship-validation-stage.js";
import { runValidationStage } from "./validation-stage.js";

/**
 * The 7-stage Graph Operation Pipeline: Validation -> Authorization -> Relationship Validation ->
 * Cycle Detection -> Execution -> Metrics -> Events. Every Graph Operation exposed by the 5
 * managers runs through exactly one `execute` call, so the guard stages (2-4) are enforced
 * uniformly rather than re-implemented per manager method.
 *
 * `middlewares` wrap the entire 7-stage run (see `middleware/`) for cross-cutting concerns
 * (logging, timing) without the stages themselves knowing about them.
 */
export class GraphOperationPipeline {
  constructor(private readonly middlewares: readonly PipelineMiddleware[] = []) {}

  execute<T>(
    descriptor: GraphOperationDescriptor<T>,
    configuration: ResolvedGraphConfiguration,
  ): T {
    const runStages = (): T => {
      runValidationStage(descriptor);
      runAuthorizationStage(descriptor, configuration);
      runRelationshipValidationStage(descriptor, configuration);
      runCycleDetectionStage(descriptor, configuration);
      const output = runExecutionStage(descriptor);
      runMetricsStage(descriptor, output);
      runEventsStage(descriptor, output);
      return output;
    };

    const chain = this.middlewares.reduceRight<() => T>(
      (next, middleware) => () => middleware.around(descriptor, next),
      runStages,
    );
    return chain();
  }
}
