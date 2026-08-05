# PROMPT 005.1 — Core Runtime Foundation (Monorepo)

> Archived source prompt for the Foundation-phase monorepo scaffold. Kept for traceability of why the repository is structured the way it is.

## ROLE

Distinguished Software Engineer, Principal Software Architect, Staff Backend Engineer, Platform Engineer, Runtime Engineer, Monorepo Architect, DevOps Architect, AI Runtime Engineer, NestJS Architect, TypeScript Expert — building the Autonomous Operating System (AOS) Enterprise Agentic AI Platform.

## MANDATORY READING BEFORE CODING

[`001-ENGINEERING-CONSTITUTION.md`](./001-ENGINEERING-CONSTITUTION.md), [`002-ENTERPRISE-ARCHITECTURE.md`](./002-ENTERPRISE-ARCHITECTURE.md), [`003-DOMAIN-DRIVEN-DESIGN.md`](./003-DOMAIN-DRIVEN-DESIGN.md), [`003.5-CONTRACT-FIRST-DESIGN.md`](./003.5-CONTRACT-FIRST-DESIGN.md), [`004-TECHNOLOGY-SELECTION-RECORD.md`](./004-TECHNOLOGY-SELECTION-RECORD.md), [`004A-COST-SCALING-STRATEGY.md`](./004A-COST-SCALING-STRATEGY.md).

## OBJECTIVE

Begin AOS implementation — **Foundation only**. No business logic, no AI Agent, no Workflow, no Dashboard, no tenant-specific ("Mitsubishi") code.

## GOAL

A production-ready, installable/lintable/buildable/testable repository. `pnpm install`, `pnpm lint`, `pnpm build`, `pnpm test`, `docker compose config` must all succeed without error.

## TECH STACK (binding, per TSR — no improvisation)

TypeScript, Node 22 LTS, pnpm, Turborepo, NestJS (reserved for future apps), Docker, Docker Compose, PostgreSQL, Valkey, NATS JetStream, Temporal, MinIO, Qdrant, Drizzle ORM (reserved), OpenTelemetry, Vitest, Playwright (reserved), ESLint, Prettier, Husky, lint-staged.

## STRUCTURE

`apps/`, `packages/`, `configs/`, `docker/`, `scripts/`, `docs/`, `tests/`, `.github/`.

## PACKAGES (Foundation only, no Runtime)

`packages/common`, `packages/config`, `packages/logger`, `packages/types`, `packages/errors`, `packages/utils`, `packages/telemetry`, `packages/sdk` (interfaces only, no AI implementation), `packages/testing`. Every package: README, package.json, tsconfig.json, eslint config, vitest config, `src/`, `test/`, `index.ts` barrel export, dependency graph note, architecture note.

## EXPLICITLY FORBIDDEN AT THIS STAGE

Runtime, Registry, Workflow, Memory, Event Bus, Scheduler, Planner, Reasoner, Reflection, AI Agent, Business Module, Dashboard, tenant-specific API/integration code.

## DELIVERABLE

Real files, not illustrative examples. Automated verification of install/lint/build/test/docker-compose-config. A closing report: file list, dependency graph, package graph, architecture summary, known limitations, and a recommendation for Engineering Task 005.2 — **not implemented here**.
