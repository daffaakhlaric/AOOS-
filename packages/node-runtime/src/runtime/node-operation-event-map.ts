import { NodeRuntimeEventType } from "../events/node-runtime-event-type.js";

/** Maps the Lifecycle operations that have a dedicated `NodeRuntimeEventType` — `pause`/`resume`/`validate`/`prepare` have none (only 8 event types are specified; `state.changed` still fires for any operation that actually changes state). */
export const NodeOperationEventMap: Readonly<Partial<Record<string, NodeRuntimeEventType>>> = {
  initialize: NodeRuntimeEventType.INITIALIZED,
  start: NodeRuntimeEventType.STARTED,
  complete: NodeRuntimeEventType.COMPLETED,
  fail: NodeRuntimeEventType.FAILED,
  cancel: NodeRuntimeEventType.CANCELLED,
  timeout: NodeRuntimeEventType.TIMEOUT,
};
