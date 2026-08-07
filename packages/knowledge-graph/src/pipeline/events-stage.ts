import type { GraphOperationDescriptor } from "./graph-operation-descriptor.js";

/** Stage 7 — Events. Publishes domain events for the operation's outcome, when the descriptor supplies an emitter. */
export function runEventsStage<T>(descriptor: GraphOperationDescriptor<T>, output: T): void {
  descriptor.emitEvents?.(output);
}
