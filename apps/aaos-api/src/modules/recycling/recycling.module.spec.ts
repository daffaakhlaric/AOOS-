import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { BroadcastLogRepository } from "./infrastructure/broadcast-log.repository.js";
import { BroadcastTemplateRepository } from "./infrastructure/broadcast-template.repository.js";
import { RecyclingSettingsRepository } from "./infrastructure/recycling-settings.repository.js";
import { RecyclingReplyListener } from "./recycling-reply-listener.js";
import { RecyclingController } from "./recycling.controller.js";
import { RecyclingModule } from "./recycling.module.js";
import { RecyclingService } from "./recycling.service.js";

type FactoryProvider = {
  provide?: unknown;
  useFactory?: (...args: never[]) => unknown;
  inject?: unknown[];
};

describe("RecyclingModule", () => {
  it("registers RecyclingController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", RecyclingModule) as unknown[];
    expect(metadata).toEqual([RecyclingController]);
  });

  it("registers RecyclingService, RecyclingReplyListener, and ApiKeyGuard as class providers", () => {
    const metadata = Reflect.getMetadata("providers", RecyclingModule) as unknown[];
    expect(metadata).toContain(RecyclingService);
    expect(metadata).toContain(RecyclingReplyListener);
    expect(metadata).toContain(ApiKeyGuard);
  });

  it("exports RecyclingService so SchedulerModule can inject it", () => {
    const metadata = Reflect.getMetadata("exports", RecyclingModule) as unknown[];
    expect(metadata).toEqual([RecyclingService]);
  });

  it.each([
    ["BroadcastTemplateRepository", BroadcastTemplateRepository],
    ["BroadcastLogRepository", BroadcastLogRepository],
    ["RecyclingSettingsRepository", RecyclingSettingsRepository],
  ])("provides %s from the SHARED SUPABASE_CLIENT (not a second connection)", (_name, klass) => {
    const metadata = Reflect.getMetadata("providers", RecyclingModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === klass);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
    const fakeClient = { from: () => undefined, channel: () => undefined } as never;
    expect(provider?.useFactory?.(fakeClient)).toBeInstanceOf(
      klass as new (...args: never[]) => unknown,
    );
  });
});
