import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ConfigurationException } from "../../src/errors/index.js";
import { ConfigurationService } from "../../src/startup/configuration-service.js";

describe("ConfigurationService", () => {
  it("throws if get() is called before load()", () => {
    const service = new ConfigurationService();
    expect(() => service.get()).toThrow(ConfigurationException);
  });

  it("load() parses the environment against the default baseConfigSchema", async () => {
    const service = new ConfigurationService({
      loadDotEnvFiles: false,
      envSource: () => ({ SERVICE_NAME: "runtime-kernel-test", NODE_ENV: "test" }),
    });

    const config = await service.load();
    expect(config.SERVICE_NAME).toBe("runtime-kernel-test");
    expect(config.NODE_ENV).toBe("test");
    expect(service.isLoaded).toBe(true);
  });

  it("throws ConfigurationException with a descriptive message on invalid config", async () => {
    const service = new ConfigurationService({
      loadDotEnvFiles: false,
      envSource: () => ({}),
    });

    await expect(service.load()).rejects.toThrow(ConfigurationException);
  });

  it("supports a caller-supplied Zod schema instead of the default", async () => {
    const schema = z.object({ FEATURE_FLAG: z.coerce.boolean() });
    const service = new ConfigurationService({
      schema,
      loadDotEnvFiles: false,
      envSource: () => ({ FEATURE_FLAG: "true" }),
    });

    const config = await service.load();
    expect(config.FEATURE_FLAG).toBe(true);
  });

  it("override() layers values on top of the loaded config immediately", async () => {
    const service = new ConfigurationService({
      loadDotEnvFiles: false,
      envSource: () => ({ SERVICE_NAME: "svc" }),
    });
    await service.load();

    service.override({ SERVICE_NAME: "overridden-svc" });
    expect(service.get().SERVICE_NAME).toBe("overridden-svc");
  });

  it("override() applied before load() is still present after loading", async () => {
    const service = new ConfigurationService({
      loadDotEnvFiles: false,
      envSource: () => ({ SERVICE_NAME: "svc" }),
    });
    service.override({ SERVICE_NAME: "pre-load-override" });

    const config = await service.load();
    expect(config.SERVICE_NAME).toBe("pre-load-override");
  });

  it("reload() re-reads the environment source", async () => {
    let name = "first";
    const service = new ConfigurationService({
      loadDotEnvFiles: false,
      envSource: () => ({ SERVICE_NAME: name }),
    });
    await service.load();
    expect(service.get().SERVICE_NAME).toBe("first");

    name = "second";
    await service.reload();
    expect(service.get().SERVICE_NAME).toBe("second");
  });

  it("resolveSecret() delegates to the configured ISecretProvider, defaulting to NullSecretProvider", async () => {
    const service = new ConfigurationService({ loadDotEnvFiles: false, envSource: () => ({}) });
    expect(await service.resolveSecret("ANY_KEY")).toBeUndefined();

    const withProvider = new ConfigurationService({
      loadDotEnvFiles: false,
      envSource: () => ({}),
      secretProvider: { resolve: async (key) => `secret-for-${key}` },
    });
    expect(await withProvider.resolveSecret("API_KEY")).toBe("secret-for-API_KEY");
  });
});
