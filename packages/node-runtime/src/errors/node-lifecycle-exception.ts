import {
  NodeRuntimeException,
  type NodeRuntimeExceptionOptions,
} from "./node-runtime-exception.js";

/** Thrown by `lifecycle/` for a lifecycle operation that cannot proceed for a reason other than an illegal state transition (e.g. an unknown operation name, or `compensate()` — interface only, never implemented in this package). */
export class NodeLifecycleException extends NodeRuntimeException {
  constructor(message: string, options: NodeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
