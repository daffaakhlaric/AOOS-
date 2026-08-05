import {
  NodeRuntimeException,
  type NodeRuntimeExceptionOptions,
} from "./node-runtime-exception.js";

/** Thrown by `resolver/`/`registry/` when a Node Type cannot be resolved from the built-in `NodeManifest` catalog. */
export class NodeNotFoundException extends NodeRuntimeException {
  constructor(message: string, options: NodeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
