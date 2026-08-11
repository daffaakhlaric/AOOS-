import type { Result } from "@aos/common";

import type { HandoffError } from "../../domain/errors/HandoffError.js";
import type { HandoffInput, HandoffOutcome, HandoffService } from "../services/HandoffService.js";
import type { Tracer } from "../tracer.js";

/** Explicit entry point for triggering a HOT-lead handoff (spec "TriggerHandoff.ts ← HOT lead → branch-manager") — a thin, traced wrapper over `HandoffService.handoff`. */
export class TriggerHandoff {
  constructor(
    private readonly handoffService: HandoffService,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: HandoffInput): Promise<Result<HandoffOutcome, HandoffError>> {
    return this.tracer.startActiveSpan(
      "sales-agent.trigger-handoff",
      async (span: { end: () => void }) => {
        try {
          return await this.handoffService.handoff(input);
        } finally {
          span.end();
        }
      },
    );
  }
}
