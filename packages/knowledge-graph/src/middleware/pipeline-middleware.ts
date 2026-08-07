import type { GraphOperationDescriptor } from "../pipeline/graph-operation-descriptor.js";

/**
 * Cross-cutting behavior wrapped around an entire `GraphOperationPipeline.execute` call (all 7
 * stages), in the classic "onion" middleware shape: a middleware may run code before calling
 * `next()`, after it, or both, and may short-circuit by not calling `next()` at all.
 */
export interface PipelineMiddleware {
  around<T>(descriptor: GraphOperationDescriptor<T>, next: () => T): T;
}
