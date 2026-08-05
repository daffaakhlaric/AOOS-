# PROMPT 005.3 — Registry System

> Archived source prompt for `packages/registry`. Kept for traceability of why the Registry System is structured the way it is.

## ROLE

Distinguished Software Engineer, Principal Platform Engineer, Runtime Architect, Registry Architect, Distributed Systems Engineer, TypeScript Architect, NestJS Architect — building the AOS Registry System, the Single Source of Truth metadata layer for the whole platform.

## MANDATORY READING

All of `docs/001` through `docs/004A`, every Contract, every Schema, every Validation Rule, every ADR.

## OBJECTIVE

Implement the Registry System — the platform's metadata center. The Registry does **not** run Agents, does **not** run Workflows, does **not** call Tools. It only knows metadata.

## TARGET CAPABILITIES

Register, Update, Remove, Enable, Disable, Version, Validate, Load, Unload, Discover, Search, Resolve, Cache, Reload, Dependency Check, Schema Validation, Hot Reload.

## PACKAGE

`packages/registry`, with `src/{contracts,entities,interfaces,registry,loaders,validators,cache,resolver,dependency,version,search,events,metrics,errors,utils,bootstrap}/` and `test/`.

## 23 MANDATORY REGISTRIES

Agent, Tool, Workflow, Prompt, Model, Plugin, Event, Queue, Scheduler, Memory Provider, Storage, Knowledge, Capability, Permission, Policy, Integration, Connector, Tenant, Configuration, Feature, Secret Provider, Analytics, Simulation.

## EVERY REGISTRY MUST HAVE

Entity, Contract, Validator, Loader, Resolver, Indexer, Search, Version, Metadata, Dependency Checker, Health, Metrics.

## MANIFEST REVISION (binding)

Every registerable component has a manifest file, e.g.:

```yaml
id: content-manager
version: 1.0.0
category: marketing
capabilities:
  - content_generation
  - image_generation
required_tools:
  - kie
  - postiz
required_models:
  - gpt-5.5
  - kie
permissions:
  - social.publish
memory:
  - campaign_memory
workflows:
  - campaign_creation
```

Consequence: the Agent Runtime (and every other runtime component) never changes when a new Agent/Tool/etc. is added — only a manifest is added, and the Registry recognizes it. This is what makes a Marketplace, third-party Plugins, and Industry Solution Packs viable later.

## FORMAT SUPPORT

YAML, JSON, TypeScript metadata now; Remote Registry reserved for the future (interface only).

## VALIDATION

Schema Validation, Business Validation, Dependency Validation, Version Validation, Permission Validation — all mandatory.

## DEPENDENCY RESOLUTION

Dependency Graph, Circular Dependency Detection, Missing Dependency Detection, Version Compatibility, Capability Check.

## SEARCH

Find By ID, Name, Tag, Capability, Category, Tenant, Version.

## CACHE

Registry/Metadata/Schema/Validation caches, with TTL, Invalidate, Reload.

## HOT RELOAD

The Registry can be reloaded without restarting the Kernel.

## VERSION

Semantic Version, Backward Compatibility Check, Breaking Change Detection, Migration Hook interface.

## EVENTS

RegistryLoaded, RegistryReloaded, RegistryUpdated, RegistryRemoved, ValidationFailed, DependencyFailed.

## METRICS

Registry Count, Validation Time, Load Time, Cache Hit, Cache Miss, Dependency Count.

## ERRORS

RegistryException, ValidationException, DependencyException, SchemaException, VersionException, ResolutionException.

## PERSISTENCE

None yet — everything in-memory. Persistence is a future sprint.

## FORBIDDEN

Workflow Runtime, Memory Engine, Event Bus, Scheduler execution, Planner, Reasoner, Reflection, AI Gateway, Tool SDK, business logic, Dealer module, Dashboard, API.

## VERIFICATION

`pnpm install`, `pnpm lint`, `pnpm build`, `pnpm test` must all succeed. Minimum 95% coverage, covering Schema Validation, Registry Loading, Dependency Resolution, Circular Dependency, Search, Hot Reload, Version, and Cache.

## DELIVERABLE

Real, complete implementation — no pseudocode, no illustrative examples. A closing report: package structure, Registry Graph, Dependency Graph, Validation Flow, Search Flow, Hot Reload Flow, Class Diagram, Known Limitations, Technical Debt, and a readiness checklist for Engineering Task 005.4 (Event Bus) — **not implemented here**.
