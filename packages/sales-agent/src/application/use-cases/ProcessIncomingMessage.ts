import type { Result } from "@aos/common";

import type { AgentError } from "../../domain/errors/AgentError.js";
import type {
  ClaraAgentService,
  ProcessMessageInput,
  ProcessMessageOutcome,
} from "../services/ClaraAgentService.js";
import type { Tracer } from "../tracer.js";

/** Main entry point (spec "Core Flow: ProcessIncomingMessage"): perceives, reasons, acts, and returns a prepared reply — never sends it directly. */
export class ProcessIncomingMessage {
  constructor(
    private readonly claraAgentService: ClaraAgentService,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: ProcessMessageInput): Promise<Result<ProcessMessageOutcome, AgentError>> {
    return this.tracer.startActiveSpan(
      "sales-agent.process-incoming-message",
      async (span: { end: () => void }) => {
        try {
          return await this.claraAgentService.processMessage(input);
        } finally {
          span.end();
        }
      },
    );
  }
}
