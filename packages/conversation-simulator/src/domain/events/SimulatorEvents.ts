import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { HandoffReached } from "./HandoffReached.js";
import type { SimulationCompleted } from "./SimulationCompleted.js";
import type { SimulationFailed } from "./SimulationFailed.js";
import type { SimulationStarted } from "./SimulationStarted.js";
import type { TurnCompleted } from "./TurnCompleted.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for this package's 5 named events, mirroring
 * `@aos/sales-agent`'s `JessyAgentEvents` / `@aos/branch-manager`'s `BranchManagerEvents`
 * convention exactly.
 */
export class SimulatorEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/conversation-simulator",
  ) {}

  async publishSimulationStarted(payload: SimulationStarted): Promise<void> {
    await this.publish(
      "aaos.simulator.simulation.started",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishTurnCompleted(payload: TurnCompleted): Promise<void> {
    await this.publish(
      "aaos.simulator.turn.completed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishHandoffReached(payload: HandoffReached): Promise<void> {
    await this.publish(
      "aaos.simulator.handoff.reached",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishSimulationCompleted(payload: SimulationCompleted): Promise<void> {
    await this.publish(
      "aaos.simulator.simulation.completed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishSimulationFailed(payload: SimulationFailed): Promise<void> {
    await this.publish(
      "aaos.simulator.simulation.failed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  private async publish<T>(
    type: string,
    payload: T,
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.DOMAIN,
      payload,
      source: this.source,
      producer: "@aos/conversation-simulator",
      tenantId,
      correlationId,
      version: "1.0.0",
    });
  }
}
