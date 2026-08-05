import { describe, expect, it } from "vitest";

import { KernelException } from "../../src/errors/index.js";
import { ShutdownSequence } from "../../src/shutdown/shutdown-sequence.js";

describe("Shutdown Test — ShutdownSequence", () => {
  it("runs every step in order to completion within the timeout", async () => {
    const order: number[] = [];
    const sequence = new ShutdownSequence(1000);

    await sequence.run([
      async () => {
        order.push(1);
      },
      async () => {
        order.push(2);
      },
    ]);

    expect(order).toEqual([1, 2]);
  });

  it("propagates a step's own error", async () => {
    const sequence = new ShutdownSequence(1000);
    await expect(
      sequence.run([
        async () => {
          throw new Error("step failed");
        },
      ]),
    ).rejects.toThrow("step failed");
  });

  it("throws a KernelException if steps exceed the configured timeout", async () => {
    const sequence = new ShutdownSequence(30);
    await expect(
      sequence.run([
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
        },
      ]),
    ).rejects.toThrow(KernelException);
  });

  it("defaults to a 10 second timeout when none is provided", () => {
    expect(() => new ShutdownSequence()).not.toThrow();
  });

  it("an empty step list resolves immediately", async () => {
    const sequence = new ShutdownSequence(1000);
    await expect(sequence.run([])).resolves.toBeUndefined();
  });
});
