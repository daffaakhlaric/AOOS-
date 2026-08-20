import type { Result } from "@aos/common";

import type { HandoffError } from "../../domain/errors/HandoffError.js";
import type {
  PropertyHandoffInput,
  PropertyHandoffOutcome,
  PropertyHandoffService,
} from "../services/PropertyHandoffService.js";
import type { Tracer } from "../tracer.js";

/** PROPERTY-vertical sibling to `TriggerHandoff` — a thin, traced wrapper over `PropertyHandoffService.handoff`. */
export class PropertyTriggerHandoff {
  constructor(
    private readonly handoffService: PropertyHandoffService,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: PropertyHandoffInput,
  ): Promise<Result<PropertyHandoffOutcome, HandoffError>> {
    return this.tracer.startActiveSpan(
      "sales-agent.trigger-handoff.property",
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
