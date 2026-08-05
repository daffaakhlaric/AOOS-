import type { RuntimeContext } from "../context/index.js";
import { LifecycleException } from "../errors/index.js";
import type { LifecycleParticipant } from "../interfaces/i-lifecycle-hooks.js";

type LifecyclePhase = keyof LifecycleParticipant;

/**
 * Invokes the six component Lifecycle interfaces (OnBootstrap/OnReady/OnRunning/OnStopping/
 * OnShutdown/OnDispose) across every registered participant (Module/Plugin), in registration
 * order, sequentially — distinct from hooks/hook-registry.ts's Kernel-level cross-cutting hooks.
 */
export class LifecycleManager {
  private readonly participants: LifecycleParticipant[] = [];

  register(participant: LifecycleParticipant): void {
    this.participants.push(participant);
  }

  unregisterAll(): void {
    this.participants.length = 0;
  }

  async runBootstrap(context: RuntimeContext): Promise<void> {
    await this.runPhase("onBootstrap", context);
  }

  async runReady(context: RuntimeContext): Promise<void> {
    await this.runPhase("onReady", context);
  }

  async runRunning(context: RuntimeContext): Promise<void> {
    await this.runPhase("onRunning", context);
  }

  async runStopping(context: RuntimeContext): Promise<void> {
    await this.runPhase("onStopping", context);
  }

  async runShutdown(context: RuntimeContext): Promise<void> {
    await this.runPhase("onShutdown", context);
  }

  async runDispose(context: RuntimeContext): Promise<void> {
    await this.runPhase("onDispose", context);
  }

  get participantCount(): number {
    return this.participants.length;
  }

  private async runPhase(phase: LifecyclePhase, context: RuntimeContext): Promise<void> {
    for (const participant of this.participants) {
      const method = participant[phase];
      if (!method) {
        continue;
      }
      try {
        await method.call(participant, context);
      } catch (error) {
        throw new LifecycleException(`Lifecycle phase "${phase}" failed`, { cause: error });
      }
    }
  }
}
