import {
  NodeRuntimeException,
  type NodeRuntimeExceptionOptions,
} from "./node-runtime-exception.js";

/** Thrown when `validator/`'s Validation Pipeline rejects a Node Instance before it may proceed through its lifecycle. */
export class NodeValidationException extends NodeRuntimeException {
  constructor(message: string, options: NodeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
