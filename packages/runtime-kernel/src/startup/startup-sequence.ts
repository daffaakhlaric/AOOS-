import { BootstrapException } from "../errors/index.js";
import type { IConfigurationProvider } from "../interfaces/i-configuration-provider.js";
import type { IModuleLoader } from "../interfaces/i-module-loader.js";
import type { IPluginLoader } from "../interfaces/i-plugin-loader.js";

export interface StartupSequenceDependencies {
  readonly configuration: IConfigurationProvider;
  readonly moduleLoader: IModuleLoader;
  readonly pluginLoader: IPluginLoader;
}

/**
 * Orchestrates the LoadingConfiguration → LoadingModules → LoadingPlugins portion of
 * Kernel.start(), wrapping every failure as a BootstrapException so the Kernel's state
 * machine has one consistent failure shape to transition on (→ FAILED).
 */
export class StartupSequence {
  constructor(private readonly deps: StartupSequenceDependencies) {}

  async loadConfiguration(): Promise<void> {
    try {
      await this.deps.configuration.load();
    } catch (error) {
      throw new BootstrapException("Failed to load configuration during startup", { cause: error });
    }
  }

  async loadModules(): Promise<void> {
    try {
      await this.deps.moduleLoader.loadAll();
    } catch (error) {
      throw new BootstrapException("Failed to load modules during startup", { cause: error });
    }
  }

  async loadPlugins(): Promise<void> {
    try {
      await this.deps.pluginLoader.loadAll();
    } catch (error) {
      throw new BootstrapException("Failed to load plugins during startup", { cause: error });
    }
  }
}
