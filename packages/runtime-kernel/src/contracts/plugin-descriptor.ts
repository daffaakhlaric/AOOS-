/**
 * The structural identity of a Plugin — data only, no behavior. IPlugin (interfaces/i-plugin.ts)
 * extends this with the optional `register` method a real plugin implements.
 *
 * No concrete Plugin exists in this package — this is the mechanism Tool/AI/Workflow plugins
 * will implement against in later Engineering Tasks (explicitly out of scope here).
 */
export interface PluginDescriptor {
  readonly name: string;
  readonly version: string;
  /** Free-form category tag (e.g. "tool", "channel") — not validated by the Kernel itself. */
  readonly category?: string;
}
