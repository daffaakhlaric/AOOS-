import { KernelException } from "../errors/index.js";
import { KERNEL_STATE_TRANSITIONS, KernelState } from "../types/index.js";

/** Enforces the Kernel State Machine's valid transition graph — the single source of truth for "what can happen next." */
export class KernelStateMachine {
  private currentState: KernelState = KernelState.CREATED;

  get state(): KernelState {
    return this.currentState;
  }

  canTransitionTo(target: KernelState): boolean {
    return KERNEL_STATE_TRANSITIONS[this.currentState].includes(target);
  }

  transitionTo(target: KernelState): void {
    if (!this.canTransitionTo(target)) {
      throw new KernelException(
        `Invalid Kernel state transition: "${this.currentState}" → "${target}"`,
      );
    }
    this.currentState = target;
  }
}
