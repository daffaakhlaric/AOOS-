import { ModuleException } from "../errors/index.js";
import type { IModuleLoader } from "../interfaces/i-module-loader.js";
import type { IModule } from "../interfaces/i-module.js";

export interface ModuleLoaderOptions {
  readonly onLoaded?: (module: IModule) => void;
}

/**
 * Module Loader mechanics — dependency-ordered loading, cycle detection, load/unload tracking.
 * No concrete business Module ships in this package; see interfaces/i-module.ts.
 */
export class ModuleLoader implements IModuleLoader {
  private readonly modules = new Map<string, IModule>();
  private readonly loaded = new Set<string>();
  private readonly loading = new Set<string>();

  constructor(private readonly options: ModuleLoaderOptions = {}) {}

  register(module: IModule): void {
    if (this.modules.has(module.name)) {
      throw new ModuleException(`Module "${module.name}" is already registered`);
    }
    this.modules.set(module.name, module);
  }

  async load(name: string): Promise<void> {
    if (this.loaded.has(name)) {
      return;
    }
    if (this.loading.has(name)) {
      throw new ModuleException(`Circular module dependency detected at "${name}"`);
    }
    const module = this.modules.get(name);
    if (!module) {
      throw new ModuleException(`Module "${name}" is not registered`);
    }

    this.loading.add(name);
    try {
      for (const dependency of module.dependencies ?? []) {
        if (!this.modules.has(dependency)) {
          throw new ModuleException(
            `Module "${name}" depends on unregistered module "${dependency}"`,
          );
        }
        await this.load(dependency);
      }
      this.loaded.add(name);
      this.options.onLoaded?.(module);
    } finally {
      this.loading.delete(name);
    }
  }

  async loadAll(): Promise<void> {
    for (const name of this.modules.keys()) {
      await this.load(name);
    }
  }

  async unload(name: string): Promise<void> {
    if (!this.loaded.has(name)) {
      throw new ModuleException(`Module "${name}" is not loaded`);
    }
    this.loaded.delete(name);
  }

  get(name: string): IModule | undefined {
    return this.modules.get(name);
  }

  list(): readonly IModule[] {
    return Array.from(this.loaded).map((name) => this.modules.get(name)!);
  }

  get loadedCount(): number {
    return this.loaded.size;
  }
}
