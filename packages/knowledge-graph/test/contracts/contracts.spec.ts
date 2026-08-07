import { describe, expect, it } from "vitest";

import { KnowledgeGraphSystem } from "../../src/bootstrap/knowledge-graph-system.js";
import type { IGraphAuthorizationChecker } from "../../src/contracts/i-graph-authorization-checker.js";
import type { IKnowledgeGraphEventPublisher } from "../../src/contracts/i-knowledge-graph-event-publisher.js";
import type { IKnowledgeGraphModule } from "../../src/contracts/i-knowledge-graph-module.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeGraphEventType } from "../../src/events/knowledge-graph-event-type.js";
import { PermissiveAuthorizationChecker } from "../../src/infrastructure/permissive-authorization-checker.js";
import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";

describe("IGraphAuthorizationChecker — structural contract", () => {
  it("PermissiveAuthorizationChecker satisfies the interface shape", () => {
    const checker: IGraphAuthorizationChecker = new PermissiveAuthorizationChecker();
    expect(checker.isAuthorized({ operation: GraphOperationType.CreateGraph })).toBe(true);
  });

  it("a custom object literal can satisfy the interface (duck typing)", () => {
    const checker: IGraphAuthorizationChecker = {
      isAuthorized: (request) => request.actor === "trusted",
    };
    expect(
      checker.isAuthorized({ operation: GraphOperationType.CreateGraph, actor: "trusted" }),
    ).toBe(true);
    expect(
      checker.isAuthorized({ operation: GraphOperationType.CreateGraph, actor: "other" }),
    ).toBe(false);
  });
});

describe("IKnowledgeGraphEventPublisher — structural contract", () => {
  it("InMemoryEventPublisher satisfies the interface shape", () => {
    const publisher: IKnowledgeGraphEventPublisher = new InMemoryEventPublisher();
    expect(() => publisher.publish(KnowledgeGraphEventType.GraphCreated, {})).not.toThrow();
  });
});

describe("IKnowledgeGraphModule — structural contract", () => {
  it("KnowledgeGraphSystem satisfies the interface shape (id + start + stop)", () => {
    const system: IKnowledgeGraphModule = new KnowledgeGraphSystem();
    expect(typeof system.id).toBe("string");
    expect(typeof system.start).toBe("function");
    expect(typeof system.stop).toBe("function");
  });
});
