import { ModuleException } from "../errors/index.js";
import type { IPluginLoader } from "../interfaces/i-plugin-loader.js";
import type { IPlugin } from "../interfaces/i-plugin.js";
import type { IServiceContainer } from "../interfaces/i-service-container.js";

export interface PluginLoaderOptions {
  readonly container: IServiceContainer;
  readonly onLoaded?: (plugin: IPlugin) => void;
}

/**
 * Plugin Loader mechanics — register/load/unload tracking, invoking each plugin's optional
 * `register(container)` hook. No concrete Tool/AI/Workflow Plugin ships in this package; see
 * interfaces/i-plugin.ts.
 */
export class PluginLoader implements IPluginLoader {
  private readonly plugins = new Map<string, IPlugin>();
  private readonly loaded = new Set<string>();

  constructor(private readonly options: PluginLoaderOptions) {}

  register(plugin: IPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new ModuleException(`Plugin "${plugin.name}" is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  async load(name: string): Promise<void> {
    if (this.loaded.has(name)) {
      return;
    }
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new ModuleException(`Plugin "${name}" is not registered`);
    }
    await plugin.register?.(this.options.container);
    this.loaded.add(name);
    this.options.onLoaded?.(plugin);
  }

  async loadAll(): Promise<void> {
    for (const name of this.plugins.keys()) {
      await this.load(name);
    }
  }

  async unload(name: string): Promise<void> {
    if (!this.loaded.has(name)) {
      throw new ModuleException(`Plugin "${name}" is not loaded`);
    }
    this.loaded.delete(name);
  }

  get(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  list(): readonly IPlugin[] {
    return Array.from(this.loaded).map((name) => this.plugins.get(name)!);
  }

  get loadedCount(): number {
    return this.loaded.size;
  }
}
