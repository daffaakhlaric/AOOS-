import {
  NodeRuntimeException,
  type NodeRuntimeExceptionOptions,
} from "./node-runtime-exception.js";

/** Thrown by `registry/node-registry.ts` when a manifest cannot be registered (e.g. a duplicate `NodeType`). */
export class NodeRegistryException extends NodeRuntimeException {
  constructor(message: string, options: NodeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
