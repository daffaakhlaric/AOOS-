import { describe, expect, it } from "vitest";

import { KnowledgeSourceConfiguration } from "../../src/configuration/knowledge-source-configuration.js";
import { SourceConfigurationException } from "../../src/errors/source-configuration-exception.js";
import { KnowledgeSourceScheduleMode } from "../../src/scheduler/knowledge-source-schedule-mode.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";

describe("KnowledgeSourceConfiguration", () => {
  const configuration = new KnowledgeSourceConfiguration();

  it("accepts a Manual, disabled record", () => {
    expect(configuration.validate(configurationFixture())).toBe(true);
  });

  it("rejects autoSync=true with enabled=false", () => {
    expect(configuration.validate(configurationFixture({ autoSync: true, enabled: false }))).toBe(
      false,
    );
    expect(() =>
      configuration.assertValid(configurationFixture({ autoSync: true, enabled: false })),
    ).toThrow(SourceConfigurationException);
  });

  it("accepts autoSync=true with enabled=true", () => {
    expect(configuration.validate(configurationFixture({ autoSync: true, enabled: true }))).toBe(
      true,
    );
  });

  it("requires schedule.mode to match syncMode", () => {
    const record = configurationFixture({
      syncMode: KnowledgeSourceScheduleMode.CRON,
      schedule: { mode: KnowledgeSourceScheduleMode.INTERVAL, intervalMs: 1000 },
    });
    expect(configuration.validate(record)).toBe(false);
  });

  it("validates the schedule descriptor via KnowledgeSourceScheduler", () => {
    const record = configurationFixture({
      syncMode: KnowledgeSourceScheduleMode.CRON,
      schedule: { mode: KnowledgeSourceScheduleMode.CRON },
    });
    expect(configuration.validate(record)).toBe(false);
  });

  it("accepts a matching, complete schedule descriptor", () => {
    const record = configurationFixture({
      syncMode: KnowledgeSourceScheduleMode.CRON,
      schedule: { mode: KnowledgeSourceScheduleMode.CRON, cronExpression: "* * * * *" },
    });
    expect(configuration.validate(record)).toBe(true);
  });

  it("validateExtraSettings/assertValidExtraSettings reject secret-looking keys", () => {
    expect(configuration.validateExtraSettings({ apiKey: "x" })).toBe(false);
    expect(() => configuration.assertValidExtraSettings({ oauthToken: "x" })).toThrow(
      SourceConfigurationException,
    );
  });

  it("validateExtraSettings accepts benign keys", () => {
    expect(configuration.validateExtraSettings({ region: "us-east-1" })).toBe(true);
    expect(() => configuration.assertValidExtraSettings({ region: "us-east-1" })).not.toThrow();
  });

  it("merge combines base and overrides", () => {
    expect(configuration.merge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });
});
