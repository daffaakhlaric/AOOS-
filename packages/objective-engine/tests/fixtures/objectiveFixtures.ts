import { ObjectiveBuilder } from "../../src/builders/ObjectiveBuilder.js";
import type { Objective } from "../../src/domain/entities/Objective.js";
import { ObjectiveId } from "../../src/domain/value-objects/ObjectiveId.js";
import { ObjectivePeriod } from "../../src/domain/value-objects/ObjectivePeriod.js";
import { ObjectiveStatus } from "../../src/domain/value-objects/ObjectiveStatus.js";
import { unwrap } from "../helpers/result.js";

/** A fixed August 2026 `ObjectivePeriod`, paired with `TestClock` "2026-08-09..." dates used throughout the test suite for deterministic days-elapsed/days-remaining math. */
export function augustPeriod(): ObjectivePeriod {
  return unwrap(ObjectivePeriod.create({ month: 8, year: 2026 }));
}

/** An `ACTIVE` Objective for August 2026: target 50 hot leads, Rp 30jt budget, matching the spec's worked example. */
export function buildActiveObjectiveFixture(overrides?: { readonly id?: string }): Objective {
  return unwrap(
    new ObjectiveBuilder()
      .withId(overrides?.id ? unwrap(ObjectiveId.create(overrides.id)) : ObjectiveId.generate())
      .withPeriod(augustPeriod())
      .withStatus(ObjectiveStatus.ACTIVE)
      .withActivatedAt(new Date("2026-08-01T00:00:00.000Z"))
      .withCreatedAt(new Date("2026-08-01T00:00:00.000Z"))
      .build(),
  );
}
