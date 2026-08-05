import {
  WorkflowRuntimeException,
  type WorkflowRuntimeExceptionOptions,
} from "./workflow-runtime-exception.js";

/** Thrown by `middleware/permission-middleware.ts` when a Workflow Instance's Execution Context violates Tenant Isolation or a supplied `IPermissionChecker`. */
export class PermissionException extends WorkflowRuntimeException {
  constructor(message: string, options: WorkflowRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
