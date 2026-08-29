import type { Result } from "@aos/common";

import type { AgentError } from "../../domain/errors/AgentError.js";
import type {
  ProcessMessageInput,
  ProcessMessageOutcome,
  PropertyClaraAgentService,
} from "../services/PropertyClaraAgentService.js";
import type { Tracer } from "../tracer.js";

/** PROPERTY-vertical sibling to `ProcessIncomingMessage` — a thin, traced wrapper over `PropertyClaraAgentService.processMessage`. */
export class PropertyProcessIncomingMessage {
  constructor(
    private readonly claraAgentService: PropertyClaraAgentService,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: ProcessMessageInput): Promise<Result<ProcessMessageOutcome, AgentError>> {
    return this.tracer.startActiveSpan(
      "sales-agent.process-incoming-message.property",
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
