# @aos/sdk

**Type-only** interfaces mirroring the AOS Contract Specification (`docs/003.5-CONTRACT-FIRST-DESIGN.md`). **No AI implementation, no runtime, no Agent, no Tool Manager, no Workflow Engine, no Event Bus** — this package exists solely so that future code (and future generated SDKs) has a single, correct TypeScript shape to import while the actual Contract-validating Registry Service does not exist yet.

## Contents

- `contracts/agent.ts` — `AgentContract` (mirrors `contracts/agent.contract.md` / `schemas/agent.schema.json`).
- `contracts/tool.ts` — `ToolContract`, `ToolSideEffectClass` (mirrors `contracts/tool.contract.md`).
- `contracts/workflow.ts` — `WorkflowContract`, `WorkflowNode`, `WorkflowEdge` (mirrors `contracts/workflow.contract.md`).
- `contracts/event.ts` — `EventContract<TPayload>` (mirrors `contracts/event.contract.md`).

Field names intentionally match each Contract's JSON Schema exactly (snake_case), not idiomatic TypeScript camelCase — fidelity to the Contract Specification takes precedence over local style convention here, since this package's entire purpose is to be a faithful mirror, not an idiomatic wrapper.

## Dependency Graph

```
@aos/types  ──▶  @aos/common
                       │
                       ▼
                   @aos/sdk
```

## Architecture Note

This package is deliberately the least "real" package in the Foundation phase — it contains zero runtime behavior. It exists to give future implementation work (Engineering Task 005.2 onward) a compile-time-checked starting point that already agrees with the Contract Specification's field names, rather than every future package re-deriving its own ad hoc shape from reading the markdown contracts by hand. When the real Registry Service and schema-validation runtime exist, this package's types should be either generated from `schemas/*.schema.json` directly or continuously verified against them — not maintained by hand indefinitely (see the known limitation noted in `docs/005.1-CORE-RUNTIME-FOUNDATION-REPORT.md`).

## Scripts

`pnpm build` · `pnpm lint` · `pnpm test` · `pnpm typecheck`
