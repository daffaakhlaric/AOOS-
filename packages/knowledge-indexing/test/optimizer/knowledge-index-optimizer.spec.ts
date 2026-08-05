import { describe, expect, it, vi } from "vitest";

import { IndexOptimizationNotSupportedException } from "../../src/errors/index-optimization-not-supported-exception.js";
import { KnowledgeIndexOptimizer } from "../../src/optimizer/knowledge-index-optimizer.js";

function fakeProvider() {
  return {
    merge: vi.fn(async () => {}),
    split: vi.fn(async () => {}),
    compact: vi.fn(async () => {}),
    vacuum: vi.fn(async () => {}),
    rebuild: vi.fn(async () => {}),
  };
}

describe("Optimizer Test — KnowledgeIndexOptimizer", () => {
  it("throws IndexOptimizationNotSupportedException for every operation when no provider is configured", async () => {
    const optimizer = new KnowledgeIndexOptimizer();
    await expect(optimizer.merge("keyword")).rejects.toThrow(
      IndexOptimizationNotSupportedException,
    );
    await expect(optimizer.split("keyword")).rejects.toThrow(
      IndexOptimizationNotSupportedException,
    );
    await expect(optimizer.compact("keyword")).rejects.toThrow(
      IndexOptimizationNotSupportedException,
    );
    await expect(optimizer.vacuum("keyword")).rejects.toThrow(
      IndexOptimizationNotSupportedException,
    );
    await expect(optimizer.rebuild("keyword")).rejects.toThrow(
      IndexOptimizationNotSupportedException,
    );
  });

  it("delegates every operation to the configured provider", async () => {
    const provider = fakeProvider();
    const optimizer = new KnowledgeIndexOptimizer(provider);
    await optimizer.merge("keyword");
    await optimizer.split("keyword");
    await optimizer.compact("keyword");
    await optimizer.vacuum("keyword");
    await optimizer.rebuild("keyword");
    expect(provider.merge).toHaveBeenCalledWith("keyword");
    expect(provider.split).toHaveBeenCalledWith("keyword");
    expect(provider.compact).toHaveBeenCalledWith("keyword");
    expect(provider.vacuum).toHaveBeenCalledWith("keyword");
    expect(provider.rebuild).toHaveBeenCalledWith("keyword");
  });
});
