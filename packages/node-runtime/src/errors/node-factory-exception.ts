import {
  NodeRuntimeException,
  type NodeRuntimeExceptionOptions,
} from "./node-runtime-exception.js";

/** Thrown by `factory/node-factory.ts` when a Node Instance cannot be created from a Workflow Definition Node, a Registry manifest, or a Blueprint. */
export class NodeFactoryException extends NodeRuntimeException {
  constructor(message: string, options: NodeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
