import { KernelException } from "../errors/index.js";

export type ShutdownStep = () => Promise<void>;

/**
 * Runs a sequence of shutdown steps with an overall timeout — if the steps have not all
 * completed within `timeoutMs`, the shutdown is considered failed (the caller decides whether
 * to force-exit) rather than hanging forever on a stuck dependency.
 */
export class ShutdownSequence {
  constructor(private readonly timeoutMs: number = 10_000) {}

  async run(steps: readonly ShutdownStep[]): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new KernelException(`Shutdown exceeded ${this.timeoutMs}ms timeout`));
      }, this.timeoutMs);
    });

    try {
      await Promise.race([this.runSteps(steps), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async runSteps(steps: readonly ShutdownStep[]): Promise<void> {
    for (const step of steps) {
      await step();
    }
  }
}
