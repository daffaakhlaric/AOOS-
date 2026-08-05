import type { IPlugin } from "./i-plugin.js";

/** The Plugin Loader port. Loads/unloads plugins and reports what is currently loaded. */
export interface IPluginLoader {
  register(plugin: IPlugin): void;
  load(name: string): Promise<void>;
  loadAll(): Promise<void>;
  unload(name: string): Promise<void>;
  get(name: string): IPlugin | undefined;
  list(): readonly IPlugin[];
  readonly loadedCount: number;
}
