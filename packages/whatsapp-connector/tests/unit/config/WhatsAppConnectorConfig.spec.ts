import { describe, expect, it } from "vitest";

import { parseWhatsAppConnectorConfig } from "../../../src/config/WhatsAppConnectorConfig.js";
import { ConnectorConfigError } from "../../../src/domain/errors/index.js";
import { makeConfig } from "../../fixtures/waFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("parseWhatsAppConnectorConfig", () => {
  it("accepts a fully-valid config", () => {
    const config = unwrap(parseWhatsAppConnectorConfig(makeConfig()));
    expect(config.wabaAccounts).toHaveLength(4);
    expect(config.rateLimitPerSecond).toBe(100);
  });

  it("applies defaults for rateLimitPerSecond/retryMaxAttempts/retryBaseDelayMs/timeoutMs", () => {
    const {
      rateLimitPerSecond: _rateLimitPerSecond,
      retryMaxAttempts: _retryMaxAttempts,
      retryBaseDelayMs: _retryBaseDelayMs,
      timeoutMs: _timeoutMs,
      ...rest
    } = makeConfig();
    const config = unwrap(parseWhatsAppConnectorConfig(rest));
    expect(config.rateLimitPerSecond).toBe(100);
    expect(config.retryMaxAttempts).toBe(3);
    expect(config.retryBaseDelayMs).toBe(1000);
    expect(config.timeoutMs).toBe(10000);
  });

  it("rejects an empty accessToken", () => {
    const error = unwrapErr(parseWhatsAppConnectorConfig(makeConfig({ accessToken: "" })));
    expect(error).toBeInstanceOf(ConnectorConfigError);
  });

  it("rejects a wrong apiVersion literal", () => {
    const error = unwrapErr(parseWhatsAppConnectorConfig({ ...makeConfig(), apiVersion: "v20.0" }));
    expect(error).toBeInstanceOf(ConnectorConfigError);
  });

  it("rejects an empty wabaAccounts array", () => {
    const error = unwrapErr(parseWhatsAppConnectorConfig(makeConfig({ wabaAccounts: [] })));
    expect(error.message).toContain("wabaAccounts");
  });

  it("rejects a wabaAccount with a non-+62 phoneNumber", () => {
    const config = makeConfig();
    const error = unwrapErr(
      parseWhatsAppConnectorConfig({
        ...config,
        wabaAccounts: [{ ...config.wabaAccounts[0], phoneNumber: "0812345" }],
      }),
    );
    expect(error).toBeInstanceOf(ConnectorConfigError);
  });

  it("rejects a wabaAccount with an invalid branch enum value", () => {
    const config = makeConfig();
    const error = unwrapErr(
      parseWhatsAppConnectorConfig({
        ...config,
        wabaAccounts: [{ ...config.wabaAccounts[0], branch: "PONDOK_BAMBU" }],
      }),
    );
    expect(error).toBeInstanceOf(ConnectorConfigError);
  });

  it("rejects a non-object input", () => {
    const error = unwrapErr(parseWhatsAppConnectorConfig("not-an-object"));
    expect(error).toBeInstanceOf(ConnectorConfigError);
  });
});
