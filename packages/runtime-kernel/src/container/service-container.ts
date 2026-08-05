import { AsyncLocalStorage } from "node:async_hooks";

import { DependencyException } from "../errors/index.js";
import type {
  Factory,
  IServiceContainer,
  RegisterOptions,
} from "../interfaces/i-service-container.js";
import { Lifetime, tokenToString, type Token } from "../types/index.js";

interface Registration<T = unknown> {
  readonly factory: Factory<T>;
  readonly lifetime: Lifetime;
}

/**
 * Tracks the chain of tokens currently being resolved, scoped per independent resolution
 * call tree via AsyncLocalStorage — this is what makes circular dependency detection correct
 * even under concurrent, interleaved `resolve()` calls (a plain instance array would not be).
 */
const resolutionStack = new AsyncLocalStorage<readonly Token[]>();

/**
 * The Kernel's Service Container — a minimal, dependency-free, token-based DI container.
 * Implements register/resolve/singleton/scoped/transient lifetimes, lazy resolution
 * (factories run only when first resolved), and circular dependency detection.
 */
export class ServiceContainer implements IServiceContainer {
  private readonly registrations = new Map<Token, Registration>();
  private readonly singletonInstances = new Map<Token, unknown>();
  private readonly scopedInstances = new Map<Token, unknown>();
  private readonly parent: ServiceContainer | undefined;

  constructor(parent?: ServiceContainer) {
    this.parent = parent;
  }

  register<T>(token: Token<T>, factory: Factory<T>, options: RegisterOptions = {}): void {
    if (this.registrations.has(token)) {
      throw new DependencyException(`Token "${tokenToString(token)}" is already registered`);
    }
    this.registrations.set(token, { factory, lifetime: options.lifetime ?? Lifetime.TRANSIENT });
  }

  registerValue<T>(token: Token<T>, value: T): void {
    this.register(token, () => value, { lifetime: Lifetime.SINGLETON });
    this.getRoot().singletonInstances.set(token, value);
  }

  isRegistered(token: Token): boolean {
    return this.registrations.has(token) || (this.parent?.isRegistered(token) ?? false);
  }

  async resolve<T>(token: Token<T>): Promise<T> {
    const currentStack = resolutionStack.getStore() ?? [];
    if (currentStack.includes(token)) {
      const chain = [...currentStack, token].map(tokenToString).join(" → ");
      throw new DependencyException(`Circular dependency detected: ${chain}`);
    }

    const { owner, registration: rawRegistration } = this.findRegistration(token);
    const registration = rawRegistration as Registration<T>;

    return resolutionStack.run([...currentStack, token], async () => {
      switch (registration.lifetime) {
        case Lifetime.SINGLETON:
          return this.resolveSingleton(token, owner, registration);
        case Lifetime.SCOPED:
          return this.resolveScoped(token, registration);
        case Lifetime.TRANSIENT:
        default:
          return (await registration.factory(this)) as T;
      }
    });
  }

  createScope(): IServiceContainer {
    return new ServiceContainer(this);
  }

  private async resolveSingleton<T>(
    token: Token<T>,
    owner: ServiceContainer,
    registration: Registration<T>,
  ): Promise<T> {
    const root = owner.getRoot();
    if (root.singletonInstances.has(token)) {
      return root.singletonInstances.get(token) as T;
    }
    const instance = await registration.factory(this);
    root.singletonInstances.set(token, instance);
    return instance;
  }

  private async resolveScoped<T>(token: Token<T>, registration: Registration<T>): Promise<T> {
    if (this.scopedInstances.has(token)) {
      return this.scopedInstances.get(token) as T;
    }
    const instance = await registration.factory(this);
    this.scopedInstances.set(token, instance);
    return instance;
  }

  private findRegistration(token: Token): { owner: ServiceContainer; registration: Registration } {
    if (this.registrations.has(token)) {
      return { owner: this, registration: this.registrations.get(token)! };
    }
    if (this.parent) {
      return this.parent.findRegistration(token);
    }
    throw new DependencyException(`No registration found for token "${tokenToString(token)}"`);
  }

  private getRoot(): ServiceContainer {
    return this.parent ? this.parent.getRoot() : this;
  }
}
