import type { PluginDescriptor } from "../contracts/plugin-descriptor.js";

import type { IServiceContainer } from "./i-service-container.js";

/**
 * The interface a real Plugin implements. No concrete Plugin (Tool, AI, Workflow) ships in
 * this package — this is the mechanism, exercised in tests with fakes.
 */
export interface IPlugin extends PluginDescriptor {
  /** Optional hook to register the plugin's own services into the Kernel's Service Container. */
  register?(container: IServiceContainer): void | Promise<void>;
}
