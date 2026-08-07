import type { GraphOperationDescriptor } from "./graph-operation-descriptor.js";

/** Stage 5 — Execution. Performs the real operation and returns its result. */
export function runExecutionStage<T>(descriptor: GraphOperationDescriptor<T>): T {
  return descriptor.execute();
}
