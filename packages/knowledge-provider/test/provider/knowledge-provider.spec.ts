import { describe, expect, it } from "vitest";

import { KnowledgeProviderState } from "../../src/domain/knowledge-provider-state.js";
import { ProviderNotFoundException } from "../../src/errors/provider-not-found-exception.js";
import { ProviderValidationException } from "../../src/errors/provider-validation-exception.js";
import { KnowledgeProviderEvents } from "../../src/events/knowledge-provider-events.js";
import { KnowledgeProvider } from "../../src/provider/knowledge-provider.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { providerFixture } from "../helpers/provider-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildFacade() {
  const { publisher } = fakePublisher();
  return new KnowledgeProvider({ events: new KnowledgeProviderEvents(publisher) });
}

describe("KnowledgeProvider", () => {
  it("register() runs the full lifecycle to READY", async () => {
    const facade = buildFacade();
    const context = contextFixture();
    const execution = await facade.register(providerFixture(), metadataFixture(), context);
    expect(execution.instance.state).toBe(KnowledgeProviderState.READY);
    expect(execution.instance.connectedAt).toBeDefined();
    expect(execution.instance.readyAt).toBeDefined();
  });

  it("honors a caller-supplied config with a permissionChecker", async () => {
    const { publisher } = fakePublisher();
    const facade = new KnowledgeProvider({
      events: new KnowledgeProviderEvents(publisher),
      config: { permissionChecker: { check: () => false } },
    });
    await expect(
      facade.register(providerFixture(), metadataFixture(), contextFixture()),
    ).rejects.toThrow();
  });

  it("register() rejects invalid metadata and transitions to FAILED", async () => {
    const facade = buildFacade();
    const context = contextFixture({ providerId: "" });
    await expect(
      facade.register(providerFixture(), metadataFixture({ providerId: "" }), context),
    ).rejects.toThrow(ProviderValidationException);
    expect(facade.getExecution(context.token)?.instance.state).toBe(KnowledgeProviderState.FAILED);
  });

  it("registerPolicy() wires a Policy that can deny a Provider's category", async () => {
    const facade = buildFacade();
    facade.registerPolicy({
      id: "policy-1",
      name: "No document",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      deniedCategories: ["document" as never],
      createdAt: new Date().toISOString(),
    });
    await expect(
      facade.register(providerFixture(), metadataFixture(), contextFixture()),
    ).rejects.toThrow();
  });

  it("use() registers custom Middleware — not run automatically by register() alone", async () => {
    const facade = buildFacade();
    let ran = false;
    facade.use(() => {
      ran = true;
    });
    expect(facade.use(() => undefined)).toBe(facade);
    // KnowledgeProvider's own register() does not itself invoke the middleware chain —
    // middleware is exposed for a caller (or 005.7G) to run explicitly around a Provider
    // operation; this test only verifies the registration/chaining API surface.
    expect(ran).toBe(false);
  });

  it("getExecution()/requireExecution() look up a registration by token", async () => {
    const facade = buildFacade();
    const context = contextFixture();
    const execution = await facade.register(providerFixture(), metadataFixture(), context);
    expect(facade.getExecution(execution.instance.token)).toBe(execution);
    expect(facade.requireExecution(execution.instance.token)).toBe(execution);
  });

  it("requireExecution() throws for an unknown token", () => {
    const facade = buildFacade();
    expect(() => facade.requireExecution("missing")).toThrow(ProviderNotFoundException);
  });

  it("disable()/enable() toggle a READY Provider", async () => {
    const facade = buildFacade();
    const context = contextFixture();
    await facade.register(providerFixture(), metadataFixture(), context);
    const disabled = await facade.disable(context.token);
    expect(disabled.instance.state).toBe(KnowledgeProviderState.DISABLED);
    const enabled = await facade.enable(context.token);
    expect(enabled.instance.state).toBe(KnowledgeProviderState.READY);
  });

  it("disconnect()/reconnect() toggle connectivity", async () => {
    const facade = buildFacade();
    const context = contextFixture();
    await facade.register(providerFixture(), metadataFixture(), context);
    const disconnected = await facade.disconnect(context.token);
    expect(disconnected.instance.state).toBe(KnowledgeProviderState.DISCONNECTED);
    const reconnected = await facade.reconnect(context.token);
    expect(reconnected.instance.state).toBe(KnowledgeProviderState.CONNECTED);
  });

  it("destroy() transitions a settled Provider to DESTROYED and unregisters it", async () => {
    const facade = buildFacade();
    const context = contextFixture();
    await facade.register(providerFixture(), metadataFixture(), context);
    await facade.disable(context.token);
    const destroyed = await facade.destroy(context.token);
    expect(destroyed.instance.state).toBe(KnowledgeProviderState.DESTROYED);
    expect(facade.getExecution(context.token)).toBeUndefined();
  });

  it("health()/metrics()/monitorSnapshot() report live state after register()", async () => {
    const facade = buildFacade();
    await facade.register(providerFixture(), metadataFixture(), contextFixture());
    expect(facade.health().status).toBeDefined();
    expect(facade.metrics().registrationCount).toBe(1);
    expect(facade.monitorSnapshot().usage.registrationCount).toBe(1);
  });
});
