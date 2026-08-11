import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import { AgentState } from "../value-objects/AgentState.js";

export interface TamaraAgentProps {
  readonly id: string;
  readonly tenantId: string;
  readonly name: "Tamara";
  readonly state: AgentState;
  readonly createdAt: Date;
  readonly lastCycleAt?: Date;
  readonly cycleCount: number;
}

/** The agent itself — Tamara's identity and lifecycle state across `RunOptimizationCycle` calls. */
export class TamaraAgent {
  private constructor(private readonly props: TamaraAgentProps) {}

  static create(props: TamaraAgentProps): Result<TamaraAgent, ValidationError> {
    if (typeof props.tenantId !== "string" || props.tenantId.trim().length === 0) {
      return err(new ValidationError("TamaraAgent.tenantId must be a non-empty string"));
    }
    if (!Object.values(AgentState).includes(props.state)) {
      return err(
        new ValidationError(
          `TamaraAgent.state must be a valid AgentState, received: ${String(props.state)}`,
        ),
      );
    }
    if (!Number.isInteger(props.cycleCount) || props.cycleCount < 0) {
      return err(
        new ValidationError(
          `TamaraAgent.cycleCount must be a non-negative integer, received: ${String(props.cycleCount)}`,
        ),
      );
    }
    return ok(new TamaraAgent({ ...props }));
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get name(): "Tamara" {
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

  /** Returns a new TamaraAgent transitioned to `state` — never mutates `this`. */
  transitionTo(state: AgentState): TamaraAgent {
    return new TamaraAgent({ ...this.props, state });
  }

  /** Returns a new TamaraAgent recording a completed cycle: increments `cycleCount`, stamps `lastCycleAt`, and returns to IDLE. */
  completeCycle(at: Date): TamaraAgent {
    return new TamaraAgent({
      ...this.props,
      state: AgentState.IDLE,
      lastCycleAt: at,
      cycleCount: this.props.cycleCount + 1,
    });
  }
}
