const DEFAULT_SIGNALS: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

/**
 * Opt-in OS signal wiring — the Kernel never registers this automatically (a test process,
 * or an embedding host with its own signal handling, must not have listeners forced on it).
 * Call `kernel` composition code's own `registerSignalHandlers()` explicitly when desired.
 */
export class SignalHandler {
  private handler: (() => void) | undefined;

  constructor(private readonly signals: readonly NodeJS.Signals[] = DEFAULT_SIGNALS) {}

  register(callback: () => void | Promise<void>): void {
    if (this.handler) {
      throw new Error("Signal handler is already registered");
    }
    this.handler = () => {
      void callback();
    };
    for (const signal of this.signals) {
      process.on(signal, this.handler);
    }
  }

  unregister(): void {
    if (!this.handler) {
      return;
    }
    for (const signal of this.signals) {
      process.off(signal, this.handler);
    }
    this.handler = undefined;
  }

  get isRegistered(): boolean {
    return this.handler !== undefined;
  }
}
