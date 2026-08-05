# PROMPT 005.6A — Workflow Definition Language (WDL) (archived source prompt)

> Archived verbatim (structure preserved) before implementation, per the established
> pattern for every numbered Engineering Task prompt in this repository.

## Role

Principal Workflow Architect, Principal Runtime Architect, Distinguished DSL Language
Designer, Enterprise Workflow Systems Engineer, designing the internal Workflow
Definition Language for the Autonomous Operating System (AOS).

"THIS IS NOT BPMN. THIS IS NOT CAMUNDA. THIS IS NOT TEMPORAL DSL. THIS IS AOS Workflow
Definition Language (AOS-WDL)."

## Read First

docs/001-ENGINEERING-CONSTITUTION.md, docs/002-ENTERPRISE-ARCHITECTURE.md,
docs/003-DOMAIN-DRIVEN-DESIGN.md, docs/003.5-CONTRACT-FIRST-DESIGN.md,
docs/004-TECHNOLOGY-SELECTION-RECORD.md, docs/004A-COST-SCALING-STRATEGY.md, plus the
005.1/005.2/005.3/005.3A/005.4/005.5 implementations.

## Objective

Design and implement the Workflow Definition Language (AOS-WDL). This engineering task
ONLY defines: workflow contracts, workflow schema, node schema, transition schema,
validation, parser, serializer, versioning, execution metadata. DO NOT execute
workflows. DO NOT build runtime.

## Do Not Implement

Workflow Runtime, Workflow Executor, Agent Runtime, Tool Runtime, Planner, Reasoner,
Reflection, Simulation Runtime, Memory Engine, AI Gateway.

## Create Package

`packages/workflow-definition`

## Modules

contracts, schemas, parser, serializer, validator, builder, registry, versioning,
metadata, variables, expressions, transitions, nodes, events, errors, config, bootstrap,
utils, tests.

## Design AOS-WDL

Human readable, YAML, JSON, Strongly typed, Versioned, Contract First, Capability
Driven, Event Driven.

## Workflow Root

Workflow ID, Version, Namespace, Display Name, Description, Labels, Tags, Tenant Scope,
Metadata, Variables, Input, Output, Nodes, Transitions, Error Handling, Compensation,
Retry, Timeout, Events, Permissions.

## Node Types

Start, End, Task, Capability, Condition, Decision, Parallel, Merge, Loop, Delay, Wait,
Human, SubWorkflow. Future: Event, AI, Script.

## Node Contract

ID, Name, Type, Description, Capability, Input, Output, Variables, Retry, Timeout,
Compensation, Metadata.

## Transitions

Next, Condition, Parallel, Merge, Loop, Retry, Failure, Timeout, Compensation.

## Variables

Workflow Variables, Node Variables, Global Variables, Temporary Variables, Environment
Variables.

## Expression Engine

Design expression interfaces only. No execution. Support: Comparison, Boolean,
Arithmetic, String, Date, Variable reference, Capability reference.

## Validation

Workflow Validation, Node Validation, Transition Validation, Variable Validation,
Expression Validation, Loop Detection, Cycle Detection, Duplicate Detection, Version
Validation.

## Versioning

Workflow V1, Workflow V2, Workflow V3, Migration Interface, Compatibility Checker.

## Serialization

YAML, JSON, Import, Export. Future: BPMN Import Adapter.

## Events

`workflow.definition.created`, `workflow.definition.updated`,
`workflow.definition.deleted`, `workflow.definition.validated`,
`workflow.definition.versioned`.

## Registry

Workflow Definition Registry, Schema Registry, Version Registry.

## Builder API

WorkflowBuilder, NodeBuilder, TransitionBuilder, VariableBuilder, ValidationBuilder.

## Security

Tenant Isolation, Permission Contract, Signature Interface.

## Test

Minimum Coverage: 95% Statement, 90% Branch, 95% Function, 95% Line. Include tests for:
Parser, Serializer, Validation, Versioning, Builder, Expressions, Variables, Registry,
Cycle Detection, Duplicate Detection.

## Output

Implement the complete package. No runtime. No execution engine. No scheduler. No agent.
No tool runtime.

## Verify

`pnpm lint`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`. Everything
must pass. No regressions.

## After Implementation

1. WDL Architecture
2. Schema Diagram
3. Node Hierarchy
4. Transition Diagram
5. Variable Model
6. Versioning Strategy
7. Validation Flow
8. Import/Export Flow
9. Builder API Diagram
10. Technical Debt
11. Known Limitations
12. Readiness Checklist for ENGINEERING TASK 005.6B Workflow Runtime Core

Do NOT implement Workflow Runtime.
