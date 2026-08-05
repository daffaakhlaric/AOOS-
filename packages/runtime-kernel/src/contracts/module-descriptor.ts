/**
 * The structural identity of a Module — data only, no behavior. IModule (interfaces/i-module.ts)
 * extends this with the optional lifecycle methods a real module implements.
 */
export interface ModuleDescriptor {
  readonly name: string;
  readonly version: string;
  /** Names of other modules that must be loaded before this one. */
  readonly dependencies?: readonly string[];
}
