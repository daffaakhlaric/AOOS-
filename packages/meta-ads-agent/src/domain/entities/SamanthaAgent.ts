import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import { AgentState } from "../value-objects/AgentState.js";

export interface SamanthaAgentProps {
  readonly id: string;
  readonly tenantId: string;
  readonly name: "Samantha";
  readonly state: AgentState;
  readonly createdAt: Date;
  readonly lastCycleAt?: Date;
  readonly cycleCount: number;
}

/** The agent itself — Samantha's identity and lifecycle state across `RunOptimizationCycle` calls. */
export class SamanthaAgent {
  private constructor(private readonly props: SamanthaAgentProps) {}

  static create(props: SamanthaAgentProps): Result<SamanthaAgent, ValidationError> {
    if (typeof props.tenantId !== "string" || props.tenantId.trim().length === 0) {
      return err(new ValidationError("SamanthaAgent.tenantId must be a non-empty string"));
    }
    if (!Object.values(AgentState).includes(props.state)) {
      return err(
        new ValidationError(
          `SamanthaAgent.state must be a valid AgentState, received: ${String(props.state)}`,
        ),
      );
    }
    if (!Number.isInteger(props.cycleCount) || props.cycleCount < 0) {
      return err(
        new ValidationError(
          `SamanthaAgent.cycleCount must be a non-negative integer, received: ${String(props.cycleCount)}`,
        ),
      );
    }
    return ok(new SamanthaAgent({ ...props }));
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get name(): "Samantha" {
    return this.props.name;
  }

  get state(): AgentState {
    return this.props.state;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get lastCycleAt(): Date | undefined {
    return this.props.lastCycleAt;
  }

  get cycleCount(): number {
    return this.props.cycleCount;
  }

  /** Returns a new SamanthaAgent transitioned to `state` — never mutates `this`. */
  transitionTo(state: AgentState): SamanthaAgent {
    return new SamanthaAgent({ ...this.props, state });
  }

  /** Returns a new SamanthaAgent recording a completed cycle: increments `cycleCount`, stamps `lastCycleAt`, and returns to IDLE. */
  completeCycle(at: Date): SamanthaAgent {
    return new SamanthaAgent({
      ...this.props,
      state: AgentState.IDLE,
      lastCycleAt: at,
      cycleCount: this.props.cycleCount + 1,
    });
  }
}
