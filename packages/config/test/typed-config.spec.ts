import { isErr, isOk } from "@aos/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { baseConfigSchema } from "../src/base-schema.js";
import { parseConfig } from "../src/typed-config.js";

describe("parseConfig", () => {
  it("returns ok() with typed, coerced values for valid input", () => {
    const result = parseConfig(baseConfigSchema, {
      SERVICE_NAME: "aos-core-runtime",
      NODE_ENV: "production",
      PORT: "8080",
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.SERVICE_NAME).toBe("aos-core-runtime");
      expect(result.value.NODE_ENV).toBe("production");
      expect(result.value.PORT).toBe(8080);
      expect(result.value.LOG_LEVEL).toBe("info");
    }
  });

  it("returns err() with a ValidationError for missing required fields", () => {
    const result = parseConfig(baseConfigSchema, {});
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain("SERVICE_NAME");
    }
  });

  it("returns err() for an out-of-enum NODE_ENV value", () => {
    const result = parseConfig(baseConfigSchema, {
      SERVICE_NAME: "x",
      NODE_ENV: "nonexistent-environment",
    });
    expect(isErr(result)).toBe(true);
  });

  it("works against an arbitrary custom schema, not just baseConfigSchema", () => {
    const schema = z.object({ FEATURE_FLAG: z.coerce.boolean() });
    const result = parseConfig(schema, { FEATURE_FLAG: "true" });
    expect(isOk(result) && result.value.FEATURE_FLAG).toBe(true);
  });
});
