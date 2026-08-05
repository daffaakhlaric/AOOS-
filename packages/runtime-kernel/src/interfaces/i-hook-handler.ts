import type { RuntimeContext } from "../context/index.js";

/** A handler registered against a named Kernel Hook (BeforeStart, AfterStop, etc.). */
export type HookHandler = (context: RuntimeContext) => void | Promise<void>;
