import type { RuntimeContext } from "../context/index.js";
import { LifecycleException } from "../errors/index.js";
import type { HookHandler } from "../interfaces/i-hook-handler.js";
import type { HookName } from "../types/index.js";

/**
 * Named, ordered extension points (BeforeStart, AfterStop, etc.) — distinct from the
 * component Lifecycle interfaces (lifecycle/lifecycle-manager.ts): hooks are Kernel-level
 * cross-cutting subscriptions (logging, metrics, audit), not "things a Module implements."
 */
export class HookRegistry {
  private readonly handlers = new Map<HookName, HookHandler[]>();

  register(hook: HookName, handler: HookHandler): void {
    const existing = this.handlers.get(hook);
    if (existing) {
      existing.push(handler);
    } else {
      this.handlers.set(hook, [handler]);
    }
  }

  unregister(hook: HookName, handler: HookHandler): void {
    const existing = this.handlers.get(hook);
    if (!existing) {
      return;
    }
    const index = existing.indexOf(handler);
    if (index !== -1) {
      existing.splice(index, 1);
    }
  }

  /** Runs every handler registered for `hook`, in registration order, sequentially. */
  async run(hook: HookName, context: RuntimeContext): Promise<void> {
    const handlers = this.handlers.get(hook) ?? [];
    for (const handler of handlers) {
      try {
        await handler(context);
      } catch (error) {
        throw new LifecycleException(`Hook "${hook}" handler failed`, { cause: error });
      }
    }
  }

  count(hook: HookName): number {
    return this.handlers.get(hook)?.length ?? 0;
  }
}
