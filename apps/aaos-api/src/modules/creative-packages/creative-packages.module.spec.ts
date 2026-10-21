import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";

import { CreativeHandoffController } from "./creative-handoff.controller.js";
import { CreativePackagesController } from "./creative-packages.controller.js";
import { CreativePackagesModule } from "./creative-packages.module.js";
import { CreativeHandoffRepository } from "./infrastructure/creative-handoff.repository.js";
import { CreativeLogRepository } from "./infrastructure/creative-log.repository.js";
import { CreativePackageRepository } from "./infrastructure/creative-package.repository.js";
import { KieWebhookController } from "./kie-webhook.controller.js";

interface FactoryProvider {
  readonly provide?: unknown;
  readonly useFactory?: (...args: never[]) => unknown;
  readonly inject?: readonly unknown[];
}

function providers(): readonly FactoryProvider[] {
  return Reflect.getMetadata("providers", CreativePackagesModule) as readonly FactoryProvider[];
}

describe("CreativePackagesModule", () => {
  it("registers handoff before dynamic package routes and retains the webhook", () => {
    const metadata = Reflect.getMetadata("controllers", CreativePackagesModule) as unknown[];
    expect(metadata).toEqual([
      CreativeHandoffController,
      CreativePackagesController,
      KieWebhookController,
    ]);
  });

  it("builds both repositories from the SHARED SUPABASE_CLIENT (not a second connection)", () => {
    const client = createFakeSupabaseClient();
    for (const token of [
      CreativePackageRepository,
      CreativeLogRepository,
      CreativeHandoffRepository,
    ]) {
      const provider = providers().find((candidate) => candidate.provide === token);
      expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
      const built = (provider?.useFactory as (c: unknown) => unknown)(client);
      expect(built).toBeInstanceOf(token);
    }
  });

  it("no longer provides any in-memory package store", () => {
    const tokens = providers().map((provider) => String(provider.provide ?? ""));
    expect(tokens.some((token) => token.includes("CREATIVE_PACKAGE_STORE"))).toBe(false);
  });
});
