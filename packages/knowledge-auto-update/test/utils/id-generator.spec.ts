import { beforeEach, describe, expect, it } from "vitest";

import { generateId, resetIdCounters } from "../../src/utils/id-generator.js";

describe("generateId", () => {
  beforeEach(() => resetIdCounters());

  it("generates ids prefixed and numbered from 1", () => {
    expect(generateId("job")).toBe("job_1");
    expect(generateId("job")).toBe("job_2");
  });

  it("keeps separate counters per prefix", () => {
    expect(generateId("task")).toBe("task_1");
    expect(generateId("job")).toBe("job_1");
    expect(generateId("task")).toBe("task_2");
  });

  it("resets all counters via resetIdCounters", () => {
    generateId("job");
    generateId("job");
    resetIdCounters();
    expect(generateId("job")).toBe("job_1");
  });

  it("does not reset one prefix's counter when a different prefix is generated", () => {
    generateId("alpha");
    generateId("beta");
    generateId("beta");
    expect(generateId("alpha")).toBe("alpha_2");
  });

  it("produces unique ids across many calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateId("x"));
    expect(ids.size).toBe(100);
  });
});
