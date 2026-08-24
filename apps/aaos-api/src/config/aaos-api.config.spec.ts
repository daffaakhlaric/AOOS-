import { describe, expect, it } from "vitest";

import { buildTestEnv } from "../test-support/fixtures.js";

import { parseAaosApiConfig } from "./aaos-api.config.js";

describe("parseAaosApiConfig", () => {
  it("parses a complete, valid env record", () => {
    const result = parseAaosApiConfig(buildTestEnv());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.PORT).toBe(3000);
      expect(result.value.NODE_ENV).toBe("test");
      expect(result.value.API_KEY).toBe("test-api-key");
      expect(result.value.META_AD_ACCOUNT_IDS).toEqual([
        "act_752604553578354",
        "act_999999999999999",
      ]);
    }
  });

  it("defaults PORT to 3000 when omitted", () => {
    const env = buildTestEnv();
    delete env.PORT;
    const result = parseAaosApiConfig(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.PORT).toBe(3000);
    }
  });

  it("coerces a numeric PORT string", () => {
    const result = parseAaosApiConfig(buildTestEnv({ PORT: "4567" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.PORT).toBe(4567);
    }
  });

  it("defaults NODE_ENV to development when omitted", () => {
    const env = buildTestEnv();
    delete env.NODE_ENV;
    const result = parseAaosApiConfig(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.NODE_ENV).toBe("development");
    }
  });

  it("trims and filters empty entries out of META_AD_ACCOUNT_IDS", () => {
    const result = parseAaosApiConfig(
      buildTestEnv({ META_AD_ACCOUNT_IDS: " act_111111111111111 , act_222222222222222 ,, " }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.META_AD_ACCOUNT_IDS).toEqual([
        "act_111111111111111",
        "act_222222222222222",
      ]);
    }
  });

  it("rejects a missing API_KEY", () => {
    const env = buildTestEnv();
    delete env.API_KEY;
    const result = parseAaosApiConfig(env);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("API_KEY");
    }
  });

  it("rejects an invalid NODE_ENV", () => {
    const result = parseAaosApiConfig(buildTestEnv({ NODE_ENV: "staging" }));
    expect(result.ok).toBe(false);
  });

  it("rejects an empty META_AD_ACCOUNT_IDS", () => {
    const result = parseAaosApiConfig(buildTestEnv({ META_AD_ACCOUNT_IDS: "" }));
    expect(result.ok).toBe(false);
  });

  it("rejects META_AD_ACCOUNT_IDS containing only commas/whitespace", () => {
    const result = parseAaosApiConfig(buildTestEnv({ META_AD_ACCOUNT_IDS: " , , " }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("META_AD_ACCOUNT_IDS");
    }
  });

  it("rejects a missing AAOS_TENANT_ID", () => {
    const env = buildTestEnv();
    delete env.AAOS_TENANT_ID;
    const result = parseAaosApiConfig(env);
    expect(result.ok).toBe(false);
  });

  it("defaults to process.env when no source is supplied", () => {
    const originalApiKey = process.env.API_KEY;
    const testEnv = buildTestEnv({ API_KEY: "from-process-env" });
    for (const [key, value] of Object.entries(testEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }
    try {
      const result = parseAaosApiConfig();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.API_KEY).toBe("from-process-env");
      }
    } finally {
      for (const key of Object.keys(testEnv)) {
        if (key === "API_KEY") {
          if (originalApiKey === undefined) {
            delete process.env.API_KEY;
          } else {
            process.env.API_KEY = originalApiKey;
          }
        } else {
          delete process.env[key];
        }
      }
    }
  });

  it("rejects a missing WHATSAPP_ACCESS_TOKEN", () => {
    const env = buildTestEnv();
    delete env.WHATSAPP_ACCESS_TOKEN;
    const result = parseAaosApiConfig(env);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("WHATSAPP_ACCESS_TOKEN");
    }
  });

  it("rejects a missing WABA_ID_BINTARO", () => {
    const env = buildTestEnv();
    delete env.WABA_ID_BINTARO;
    const result = parseAaosApiConfig(env);
    expect(result.ok).toBe(false);
  });

  it("defaults OPENAI_API_KEY to an empty string when omitted (AI features degrade gracefully, config never fails to boot)", () => {
    const env = buildTestEnv();
    delete env.OPENAI_API_KEY;
    const result = parseAaosApiConfig(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.OPENAI_API_KEY).toBe("");
    }
  });

  it("accepts a configured OPENAI_API_KEY", () => {
    const result = parseAaosApiConfig(buildTestEnv({ OPENAI_API_KEY: "sk-real-key" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.OPENAI_API_KEY).toBe("sk-real-key");
    }
  });

  it("defaults AAOS_SIMULATOR_BASE_URL to an empty string when omitted (Jessy/Judge stage degrades gracefully, config never fails to boot)", () => {
    const env = buildTestEnv();
    delete env.AAOS_SIMULATOR_BASE_URL;
    const result = parseAaosApiConfig(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.AAOS_SIMULATOR_BASE_URL).toBe("");
    }
  });

  it("accepts a configured AAOS_SIMULATOR_BASE_URL", () => {
    const result = parseAaosApiConfig(
      buildTestEnv({ AAOS_SIMULATOR_BASE_URL: "http://localhost:4100" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.AAOS_SIMULATOR_BASE_URL).toBe("http://localhost:4100");
    }
  });

  it("defaults META_APP_ID/META_APP_SECRET/AAOS_API_BASE_URL to empty strings when omitted (AAOS-SOSMED-AUTOMATION Phase 4 — the whole app must still boot with no Meta OAuth App configured)", () => {
    const env = buildTestEnv();
    delete env.META_APP_ID;
    delete env.META_APP_SECRET;
    delete env.AAOS_API_BASE_URL;
    const result = parseAaosApiConfig(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.META_APP_ID).toBe("");
      expect(result.value.META_APP_SECRET).toBe("");
      expect(result.value.AAOS_API_BASE_URL).toBe("");
    }
  });

  it("accepts configured META_APP_ID/META_APP_SECRET/AAOS_API_BASE_URL", () => {
    const result = parseAaosApiConfig(
      buildTestEnv({
        META_APP_ID: "1234567890",
        META_APP_SECRET: "real-app-secret",
        AAOS_API_BASE_URL: "https://api.aaos.id",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.META_APP_ID).toBe("1234567890");
      expect(result.value.META_APP_SECRET).toBe("real-app-secret");
      expect(result.value.AAOS_API_BASE_URL).toBe("https://api.aaos.id");
    }
  });
});
