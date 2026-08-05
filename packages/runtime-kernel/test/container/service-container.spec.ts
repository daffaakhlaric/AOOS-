import { describe, expect, it, vi } from "vitest";

import { ServiceContainer } from "../../src/container/service-container.js";
import { DependencyException } from "../../src/errors/index.js";
import { Lifetime } from "../../src/types/index.js";

describe("DI Test — ServiceContainer", () => {
  it("registers and resolves a transient service, calling the factory every time", async () => {
    const container = new ServiceContainer();
    const factory = vi.fn(() => ({ id: Math.random() }));
    container.register("thing", factory);

    const a = await container.resolve("thing");
    const b = await container.resolve("thing");

    expect(factory).toHaveBeenCalledTimes(2);
    expect(a).not.toBe(b);
  });

  it("singleton() lifetime returns the same instance across resolutions", async () => {
    const container = new ServiceContainer();
    const factory = vi.fn(() => ({ id: Math.random() }));
    container.register("singleton-thing", factory, { lifetime: Lifetime.SINGLETON });

    const a = await container.resolve("singleton-thing");
    const b = await container.resolve("singleton-thing");

    expect(factory).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("scoped() lifetime returns one instance per scope, distinct across scopes", async () => {
    const container = new ServiceContainer();
    container.register("scoped-thing", () => ({ id: Math.random() }), {
      lifetime: Lifetime.SCOPED,
    });

    const scopeA = container.createScope();
    const scopeB = container.createScope();

    const a1 = await scopeA.resolve("scoped-thing");
    const a2 = await scopeA.resolve("scoped-thing");
    const b1 = await scopeB.resolve("scoped-thing");

    expect(a1).toBe(a2);
    expect(a1).not.toBe(b1);
  });

  it("registerValue() registers a pre-built singleton without calling a factory", async () => {
    const container = new ServiceContainer();
    const value = { fixed: true };
    container.registerValue("fixed-thing", value);

    expect(await container.resolve("fixed-thing")).toBe(value);
  });

  it("supports class constructor tokens directly", async () => {
    class Widget {
      readonly kind = "widget";
    }
    const container = new ServiceContainer();
    container.register(Widget, () => new Widget());

    const instance = await container.resolve(Widget);
    expect(instance).toBeInstanceOf(Widget);
  });

  it("is lazy — the factory is never called until resolve() is invoked", () => {
    const container = new ServiceContainer();
    const factory = vi.fn(() => "value");
    container.register("lazy-thing", factory);
    expect(factory).not.toHaveBeenCalled();
  });

  it("throws DependencyException when registering the same token twice", () => {
    const container = new ServiceContainer();
    container.register("dup", () => 1);
    expect(() => container.register("dup", () => 2)).toThrow(DependencyException);
  });

  it("throws DependencyException when resolving an unregistered token", async () => {
    const container = new ServiceContainer();
    await expect(container.resolve("missing")).rejects.toThrow(DependencyException);
  });

  it("isRegistered reflects both local and inherited (parent scope) registrations", () => {
    const container = new ServiceContainer();
    container.register("in-root", () => 1);
    const scope = container.createScope();
    expect(scope.isRegistered("in-root")).toBe(true);
    expect(scope.isRegistered("not-registered")).toBe(false);
  });

  it("a scope resolves services registered only on the parent (delegated lookup)", async () => {
    const container = new ServiceContainer();
    container.register("parent-thing", () => "from-parent");
    const scope = container.createScope();
    expect(await scope.resolve("parent-thing")).toBe("from-parent");
  });

  it("detects a direct circular dependency (A depends on A)", async () => {
    const container = new ServiceContainer();
    container.register("a", async (c) => {
      await c.resolve("a");
      return "unreachable";
    });

    await expect(container.resolve("a")).rejects.toThrow(/Circular dependency detected/);
  });

  it("detects an indirect circular dependency (A → B → A)", async () => {
    const container = new ServiceContainer();
    container.register("a", async (c) => {
      await c.resolve("b");
      return "a";
    });
    container.register("b", async (c) => {
      await c.resolve("a");
      return "b";
    });

    await expect(container.resolve("a")).rejects.toThrow(/Circular dependency detected: a → b → a/);
  });

  it("does not falsely flag two independent, concurrent resolutions as circular", async () => {
    const container = new ServiceContainer();
    container.register("x", async () => "x-value");
    container.register("y", async () => "y-value");

    const [x, y] = await Promise.all([container.resolve("x"), container.resolve("y")]);
    expect(x).toBe("x-value");
    expect(y).toBe("y-value");
  });

  it("resolves a real dependency chain (non-circular) correctly", async () => {
    const container = new ServiceContainer();
    container.register("base", () => 10, { lifetime: Lifetime.SINGLETON });
    container.register("derived", async (c) => (await c.resolve<number>("base")) * 2);

    expect(await container.resolve("derived")).toBe(20);
  });
});
