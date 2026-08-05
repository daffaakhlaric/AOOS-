import {
  NodeRuntimeException,
  type NodeRuntimeExceptionOptions,
} from "./node-runtime-exception.js";

/** Thrown by `middleware/permission-middleware.ts` when a Node Instance's Context violates Tenant Isolation or a supplied `INodePermissionChecker`. */
export class NodePermissionException extends NodeRuntimeException {
  constructor(message: string, options: NodeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
