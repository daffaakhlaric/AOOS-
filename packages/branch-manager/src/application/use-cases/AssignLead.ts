import type { Result } from "@aos/common";

import type {
  AssignLeadError,
  AssignLeadInput,
  AssignLeadOutcome,
  LeadAssignmentService,
} from "../services/LeadAssignmentService.js";
import type { Tracer } from "../tracer.js";

/** Main entry point: attempt to assign one lead to a branch's sales team. */
export class AssignLead {
  constructor(
    private readonly leadAssignmentService: LeadAssignmentService,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: AssignLeadInput): Promise<Result<AssignLeadOutcome, AssignLeadError>> {
    return this.tracer.startActiveSpan(
      "branch-manager.assign-lead",
      async (span: { end: () => void }) => {
        try {
          return await this.leadAssignmentService.assign(input);
        } finally {
          span.end();
        }
      },
    );
  }
}
