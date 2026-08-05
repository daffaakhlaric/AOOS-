import type { IModule } from "./i-module.js";

/** The Module Loader port. Loads/unloads modules and reports what is currently loaded. */
export interface IModuleLoader {
  register(module: IModule): void;
  load(name: string): Promise<void>;
  loadAll(): Promise<void>;
  unload(name: string): Promise<void>;
  get(name: string): IModule | undefined;
  list(): readonly IModule[];
  readonly loadedCount: number;
}
