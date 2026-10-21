import type { SupabaseClientLike } from "@aos/lead-store";
import { expect, it, vi } from "vitest";

import type { ActivityLogger } from "../activity-log/activity-logger.service.js";
import type { ModeGuardService } from "../mode-guard/mode-guard.service.js";

import { defaultGrowthPolicy } from "./domain/growth-policy.js";
import { growthReadiness } from "./domain/growth-readiness.js";
import { GrowthPolicyService } from "./growth-policy.service.js";
it.each(["AUTONOMOUS", "AUTOPILOT_GUARDED"] as const)(
  "persists %s without pretending incomplete actions are ready",
  async (autonomousMode) => {
    const policy = { ...defaultGrowthPolicy(), autonomousMode };
    const rpc = vi.fn(async () => ({ data: { version: 2 }, error: null }));
    const activity = { start: vi.fn(), complete: vi.fn() };
    const service = new GrowthPolicyService(
      { rpc } as unknown as SupabaseClientLike,
      activity as unknown as ActivityLogger,
      { resolveMode: vi.fn(async () => "LIVE") } as unknown as ModeGuardService,
    );
    vi.spyOn(service, "current").mockResolvedValue({
      policy: defaultGrowthPolicy(),
      version: 1,
      updatedAt: null,
    });
    const readiness = growthReadiness(policy, {
      metaConfigured: true,
      schedulerEnabled: true,
      creativeConfigured: true,
    });
    vi.spyOn(service, "view").mockResolvedValue({
      policy,
      version: 2,
      updatedAt: null,
      defaults: defaultGrowthPolicy(),
      paceProfiles: {} as never,
      readiness,
      estimate: { status: "UNAVAILABLE", reason: "Insufficient data" },
    });
    const result = await service.save("tenant-a", 1, policy, "verified-owner");
    expect(rpc).toHaveBeenCalledWith(
      "save_growth_policy",
      expect.objectContaining({
        p_tenant: "tenant-a",
        p_expected: 1,
        p_policy: expect.objectContaining({ autonomousMode }),
      }),
    );
    expect(result.readiness.actions.find((a) => a.key === "SCALE")?.execution).toBe("BLOCKED");
    expect(activity.complete).toHaveBeenCalled();
  },
);
