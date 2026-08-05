ENGINEERING TASK 005.6B
Workflow Runtime Core
ROLE

You are:

- Distinguished Workflow Runtime Architect
- Principal Distributed Systems Engineer
- Principal Runtime Architect
- Enterprise Workflow Engine Engineer

You are implementing the core execution runtime
for the Autonomous Operating System (AOS).

THIS IS NOT BPMN.

THIS IS NOT CAMUNDA.

THIS IS NOT TEMPORAL.

THIS IS NOT N8N.

THIS IS AOS Workflow Runtime.

======================================================================

READ FIRST

You MUST fully read:

docs/001-ENGINEERING-CONSTITUTION.md

docs/002-ENTERPRISE-ARCHITECTURE.md

docs/003-DOMAIN-DRIVEN-DESIGN.md

docs/003.5-CONTRACT-FIRST-DESIGN.md

docs/004-TECHNOLOGY-SELECTION-RECORD.md

docs/004A-COST-SCALING-STRATEGY.md

Implementation already completed:

005.1 Foundation

005.2 Runtime Kernel

005.3 Registry

005.3A Registry Enhancement

005.4 Enterprise Event Bus

005.5 Enterprise Scheduler

005.6A Workflow Definition Language

======================================================================

OBJECTIVE

Implement the Workflow Runtime Core.

This package is responsible for:

- loading workflow definitions
- validating definitions
- creating workflow instances
- maintaining execution state
- lifecycle management
- execution context
- event publishing

This package MUST NOT execute nodes.

Node execution belongs to ENGINEERING TASK 005.6C.

======================================================================

DO NOT IMPLEMENT

Node Runtime

Capability Runtime

Tool Runtime

Planner

Reasoner

Reflection

Memory Engine

Simulation Runtime

AI Gateway

Model Router

Agent Runtime

======================================================================

CREATE PACKAGE

packages/workflow-runtime

======================================================================

MODULES

runtime

instance

loader

resolver

validator

context

state-machine

lifecycle

execution

snapshot

checkpoint

replay-interface

compensation-interface

events

metrics

monitoring

health

config

bootstrap

errors

utils

tests

======================================================================

WORKFLOW INSTANCE

Design and implement:

WorkflowInstance

WorkflowExecution

WorkflowContext

WorkflowMetadata

WorkflowHistory

WorkflowSnapshotReference

ExecutionPointer

======================================================================

INSTANCE STATE

Created

Ready

Running

Waiting

Paused

Completed

Cancelled

Failed

Compensating

Compensated

Expired

======================================================================

EXECUTION CONTEXT

Must support:

Tenant

Correlation ID

Trace ID

Workflow Variables

Environment Variables

Execution Variables

Node Variables

Metadata

Input

Output

Execution Mode

Current State

Execution History

======================================================================

EXECUTION MODE

Normal

Simulation

Debug

DryRun

StepByStep

======================================================================

WORKFLOW LOADER

Load by ID

Load by Version

Load Latest

Load Registry

Validate Compatibility

======================================================================

WORKFLOW VALIDATOR

Validate before execution.

Reuse 005.6A validators whenever possible.

======================================================================

STATE MACHINE

Implement full workflow lifecycle.

Transitions must be validated.

Illegal transitions must fail.

======================================================================

LIFECYCLE

Create

Initialize

Start

Pause

Resume

Cancel

Expire

Complete

Fail

Restart (interface only)

======================================================================

SNAPSHOT

Implement:

Snapshot interface

Snapshot Manager

Checkpoint interface

No persistence.

======================================================================

REPLAY

Implement interface only.

Integrate with Event Replay interface from Event Bus.

No replay execution.

======================================================================

COMPENSATION

Implement interfaces only.

No execution.

======================================================================

EVENTS

Publish through Event Bus:

workflow.instance.created

workflow.instance.initialized

workflow.instance.started

workflow.instance.paused

workflow.instance.resumed

workflow.instance.completed

workflow.instance.failed

workflow.instance.cancelled

workflow.instance.expired

workflow.instance.snapshot.created

workflow.instance.state.changed

======================================================================

METRICS

Running Workflows

Completed Workflows

Failed Workflows

Average Runtime

Current State Count

Execution Latency

======================================================================

HEALTH

Runtime Health

Loader Health

Validator Health

State Machine Health

Context Health

======================================================================

MONITORING

OpenTelemetry Ready

Correlation ID

Trace ID

Runtime Metrics

======================================================================

SECURITY

Tenant Isolation

Permission Interface

Execution Scope

======================================================================

REGISTRY

Integrate with:

Workflow Definition Registry

Version Registry

Schema Registry

Read only.

======================================================================

SCHEDULER

Runtime can receive scheduled execution requests.

Do not schedule jobs.

======================================================================

EVENT BUS

Every lifecycle change MUST publish events.

No direct communication.

======================================================================

TESTS

Coverage minimum:

95% Statements

90% Branches

95% Functions

95% Lines

Include tests:

State Machine

Execution Context

Workflow Instance

Loader

Lifecycle

Snapshot

Checkpoint

Replay Interface

Registry Integration

Event Publishing

Execution Mode

======================================================================

OUTPUT

Implement the complete package.

No pseudo code.

No TODO placeholders.

No node execution.

======================================================================

VERIFY

Run:

pnpm lint

pnpm build

pnpm test

pnpm typecheck

pnpm format:check

Whole workspace must pass.

No regressions.

======================================================================

AFTER IMPLEMENTATION

Generate:

1. Runtime Architecture

2. Workflow Instance Lifecycle

3. State Machine Diagram

4. Execution Context Diagram

5. Snapshot Architecture

6. Registry Integration Flow

7. Event Publishing Flow

8. Metrics Overview

9. Technical Debt

10. Known Limitations

11. Readiness Checklist for ENGINEERING TASK 005.6C (Node Runtime)

Do NOT implement Node Runtime.

======================================================================

ADDITIONAL IMPROVEMENTS REQUESTED (user, in Bahasa Indonesia — translated below)

1. Execution Token

Add the concept of ExecutionToken.

Every Workflow Instance has a unique token.

Later, pause / resume / cancel / replay operations can use the token alone —
no need to look the instance up by state.

2. Execution Lease

Prepare an IExecutionLease interface.

Not used yet.

Later, in a multi-node deployment, the lease will prevent two servers from
executing the same workflow instance concurrently.

3. Runtime Middleware

Add a pipeline middleware, e.g.:

Validation Middleware
↓
Permission Middleware
↓
Tracing Middleware
↓
Metrics Middleware
↓
Lifecycle Middleware

This way, when audit, billing, quota, or observability concerns are added later,
the Workflow Runtime Core itself does not need to change — only a new middleware
needs to be added.

======================================================================

ROADMAP AFTER 005.6B

005.6C Node Runtime
↓
005.6D Execution Engine
↓
005.6E Runtime Integration
↓
005.7 Memory Engine

Important note: starting from 005.6B onward, every package should have a small,
stable public API. Implementation details may evolve, but the public contract
must be preserved. This will make the whole AOS much easier to maintain once the
number of packages grows into the dozens and they start being consumed by
Solution Packs and the Marketplace.
