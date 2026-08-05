import type { ZodTypeAny } from "zod";

import type { IModule } from "../interfaces/i-module.js";
import type { IPlugin } from "../interfaces/i-plugin.js";
import type { ISecretProvider } from "../interfaces/i-secret-provider.js";

/** Options accepted by the Kernel Builder (bootstrap/kernel-builder.ts) to compose a Kernel instance. */
export interface KernelOptions {
  readonly name?: string;
  readonly version?: string;
  readonly environment?: string;
  /** Additional Zod schema merged with @aos/config's baseConfigSchema for this Kernel's typed config. */
  readonly configSchema?: ZodTypeAny;
  readonly secretProvider?: ISecretProvider;
  readonly modules?: readonly IModule[];
  readonly plugins?: readonly IPlugin[];
  readonly shutdownTimeoutMs?: number;
}
