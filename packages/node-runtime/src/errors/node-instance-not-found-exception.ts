import {
  NodeRuntimeException,
  type NodeRuntimeExceptionOptions,
} from "./node-runtime-exception.js";

/** Thrown when a Node Instance cannot be resolved by its id — every lifecycle operation looks up state by id, never by scanning. */
export class NodeInstanceNotFoundException extends NodeRuntimeException {
  constructor(message: string, options: NodeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
