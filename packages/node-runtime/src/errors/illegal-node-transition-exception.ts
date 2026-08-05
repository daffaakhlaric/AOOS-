import {
  NodeRuntimeException,
  type NodeRuntimeExceptionOptions,
} from "./node-runtime-exception.js";

/** Thrown by `lifecycle/node-state-machine.ts` when a requested Node State transition is not present in `NODE_STATE_TRANSITIONS`. */
export class IllegalNodeTransitionException extends NodeRuntimeException {
  constructor(message: string, options: NodeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
