import type { Lifetime, Token } from "../types/index.js";

export type Factory<T> = (container: IServiceContainer) => T | Promise<T>;

export interface RegisterOptions {
  readonly lifetime?: Lifetime;
}

/** The Service Container port — Kernel's dependency injection contract (Interface First). */
export interface IServiceContainer {
  register<T>(token: Token<T>, factory: Factory<T>, options?: RegisterOptions): void;
  registerValue<T>(token: Token<T>, value: T): void;
  resolve<T>(token: Token<T>): Promise<T>;
  isRegistered(token: Token): boolean;
  createScope(): IServiceContainer;
}
