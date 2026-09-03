import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { AgentConfigModule } from "../agent-config/agent-config.module.js";
import { AgentRunsModule } from "../agent-runs/agent-runs.module.js";
import { LlmModule } from "../llm/llm.module.js";

import { SandboxModule } from "./sandbox.module.js";
import { SandboxService } from "./sandbox.service.js";

describe("SandboxModule", () => {
  it("imports AgentRunsModule, LlmModule, and AgentConfigModule (so SandboxService injects the SAME real services every other consumer uses)", () => {
    const metadata = Reflect.getMetadata("imports", SandboxModule) as unknown[];
    expect(metadata).toContain(AgentRunsModule);
    expect(metadata).toContain(LlmModule);
    expect(metadata).toContain(AgentConfigModule);
  });

  it("registers SandboxService and a JudgeResultRepository factory as providers", () => {
    const metadata = Reflect.getMetadata("providers", SandboxModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toContain(SandboxService);
  });

  it("exports SandboxService", () => {
    const metadata = Reflect.getMetadata("exports", SandboxModule) as unknown[];
    expect(metadata).toEqual([SandboxService]);
  });
});
