import { describe, expect, it } from "vitest";

import { GraphAuthorizationException } from "../../src/errors/graph-authorization-exception.js";
import { runAuthorizationStage } from "../../src/pipeline/authorization-stage.js";
import type { GraphOperationDescriptor } from "../../src/pipeline/graph-operation-descriptor.js";
import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";
import { buildResolvedConfiguration } from "../helpers/configuration-fixture.js";

function descriptor(overrides: Partial<GraphOperationDescriptor<unknown>> = {}) {
  return {
    operation: GraphOperationType.CreateNode,
    validate: () => undefined,
    execute: () => undefined,
    ...overrides,
  } as GraphOperationDescriptor<unknown>;
}

describe("runAuthorizationStage", () => {
  it("passes when the checker authorizes the request", () => {
    expect(() => runAuthorizationStage(descriptor(), buildResolvedConfiguration())).not.toThrow();
  });

  it("throws GraphAuthorizationException when the checker denies the request", () => {
    const configuration = buildResolvedConfiguration({
      authorizationChecker: { isAuthorized: () => false },
    });
    expect(() => runAuthorizationStage(descriptor(), configuration)).toThrow(
      GraphAuthorizationException,
    );
  });

  it("passes the operation/actor/graphId through to the checker", () => {
    let received: unknown;
    const configuration = buildResolvedConfiguration({
      authorizationChecker: {
        isAuthorized: (request) => {
          received = request;
          return true;
        },
      },
    });
    runAuthorizationStage(descriptor({ actor: "alice", graphId: "g1" }), configuration);
    expect(received).toEqual({
      operation: GraphOperationType.CreateNode,
      actor: "alice",
      graphId: "g1",
    });
  });
});
