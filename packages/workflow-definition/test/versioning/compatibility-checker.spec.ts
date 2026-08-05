import { describe, expect, it } from "vitest";

import { CompatibilityChecker } from "../../src/versioning/compatibility-checker.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Versioning Test — CompatibilityChecker", () => {
  it("reports compatible for a version bump with no removed fields or nodes", () => {
    const previous = workflowFixture({ version: "1.0.0", input: { in: "x" } });
    const next = workflowFixture({ version: "1.1.0", input: { in: "x", extra: "y" } });
    const result = new CompatibilityChecker().check(previous, next);
    expect(result.compatible).toBe(true);
    expect(result.breakingChanges).toHaveLength(0);
  });

  it("flags a changed workflow id", () => {
    const previous = workflowFixture({ id: "wf-a", version: "1.0.0" });
    const next = workflowFixture({ id: "wf-b", version: "1.1.0" });
    const result = new CompatibilityChecker().check(previous, next);
    expect(result.compatible).toBe(false);
    expect(result.breakingChanges.some((change) => change.includes("id changed"))).toBe(true);
  });

  it("flags an invalid SemVer string on either side", () => {
    const previous = workflowFixture({ version: "not-semver" });
    const next = workflowFixture({ version: "1.1.0" });
    const result = new CompatibilityChecker().check(previous, next);
    expect(result.compatible).toBe(false);
    expect(result.breakingChanges.some((change) => change.includes("not a valid SemVer"))).toBe(
      true,
    );
  });

  it("flags a version that is not strictly greater", () => {
    const previous = workflowFixture({ version: "1.1.0" });
    const next = workflowFixture({ version: "1.0.0" });
    const result = new CompatibilityChecker().check(previous, next);
    expect(result.compatible).toBe(false);
    expect(result.breakingChanges.some((change) => change.includes("is not greater than"))).toBe(
      true,
    );
  });

  it("flags a removed input field", () => {
    const previous = workflowFixture({ version: "1.0.0", input: { in: "x" } });
    const next = workflowFixture({ version: "1.1.0", input: {} });
    const result = new CompatibilityChecker().check(previous, next);
    expect(result.compatible).toBe(false);
    expect(
      result.breakingChanges.some((change) => change.includes('input field "in" was removed')),
    ).toBe(true);
  });

  it("flags a removed node id", () => {
    const previous = workflowFixture({ version: "1.0.0" });
    const next = workflowFixture({
      version: "1.1.0",
      nodes: previous.nodes.filter((node) => node.id !== "task-1"),
      transitions: [],
    });
    const result = new CompatibilityChecker().check(previous, next);
    expect(result.compatible).toBe(false);
    expect(
      result.breakingChanges.some((change) => change.includes('node "task-1" was removed')),
    ).toBe(true);
  });
});
