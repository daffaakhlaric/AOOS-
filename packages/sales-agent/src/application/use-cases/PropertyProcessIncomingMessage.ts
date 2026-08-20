import type { Result } from "@aos/common";

import type { AgentError } from "../../domain/errors/AgentError.js";
import type {
  ProcessMessageInput,
  ProcessMessageOutcome,
  PropertyJessyAgentService,
} from "../services/PropertyJessyAgentService.js";
import type { Tracer } from "../tracer.js";

/** PROPERTY-vertical sibling to `ProcessIncomingMessage` — a thin, traced wrapper over `PropertyJessyAgentService.processMessage`. */
export class PropertyProcessIncomingMessage {
  constructor(
    private readonly jessyAgentService: PropertyJessyAgentService,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: ProcessMessageInput): Promise<Result<ProcessMessageOutcome, AgentError>> {
    return this.tracer.startActiveSpan(
      "sales-agent.process-incoming-message.property",
      async (span: { end: () => void }) => {
        try {
          return await this.jessyAgentService.processMessage(input);
        } finally {
          span.end();
        }
      },
    );
  }
}
