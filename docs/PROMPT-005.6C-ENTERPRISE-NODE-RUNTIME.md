ENGINEERING TASK 005.6C — Enterprise Node Runtime
ROLE

You are:

- Distinguished Workflow Runtime Architect
- Principal Distributed Systems Engineer
- Principal Workflow Engine Architect
- Principal Runtime Engineer

You are implementing the Enterprise Node Runtime
for the Autonomous Operating System (AOS).

This is NOT a workflow engine.

This package only manages Nodes.

====================================================================

READ FIRST

Before writing any code, fully read and conform to:

docs/001-ENGINEERING-CONSTITUTION.md

docs/002-ENTERPRISE-ARCHITECTURE.md

docs/003-DOMAIN-DRIVEN-DESIGN.md

docs/003.5-CONTRACT-FIRST-DESIGN.md

docs/004-TECHNOLOGY-SELECTION-RECORD.md

docs/004A-COST-SCALING-STRATEGY.md

Completed Engineering Tasks:

005.1 Foundation

005.2 Runtime Kernel

005.3 Registry

005.3A Registry Enhancement

005.4 Event Bus

005.5 Scheduler

005.6A Workflow Definition Language

005.6B Workflow Runtime Core

====================================================================

OBJECTIVE

Implement the Enterprise Node Runtime.

This package manages every Node type.

It validates Nodes.

Creates Node Instances.

Maintains Node lifecycle.

Provides Node execution interfaces.

Node Runtime DOES NOT execute workflow graphs.

Execution Engine belongs to ENGINEERING TASK 005.6D.

====================================================================

DO NOT IMPLEMENT

Workflow Execution Engine

Capability Runtime

Tool Runtime

Connector Runtime

Planner

Reasoner

Reflection

Memory Engine

Knowledge Engine

AI Gateway

Agent Runtime

Model Router

Simulation Runtime

====================================================================

CREATE PACKAGE

packages/node-runtime

====================================================================

PUBLIC API

Expose ONLY:

NodeRuntime

Everything else internal.

====================================================================

MODULES

contracts

runtime

registry

factory

resolver

validator

instance

context

lifecycle

middleware

events

metrics

health

monitoring

errors

utils

config

bootstrap

tests

====================================================================

NODE CATEGORIES

Implement all categories.

Flow Nodes

Start

End

Condition

Switch

Merge

Fork

Join

Loop

Delay

Timer

Wait

Event

Human

AI

Capability

Knowledge

Memory

Webhook

HTTP

Transform

Variable

Expression

Script (interface only)

Custom

====================================================================

NODE STATE

Created

Ready

Running

Waiting

Paused

Completed

Failed

Cancelled

Skipped

TimedOut

Compensated

====================================================================

NODE INSTANCE

Design:

NodeInstance

NodeExecution

NodeContext

NodeMetadata

NodeHistory

NodeResult

NodeSnapshot

====================================================================

NODE CONTEXT

Must include:

Tenant

Workflow Instance

Node ID

Execution ID

Trace ID

Correlation ID

Input

Output

Variables

Metadata

Execution Mode

====================================================================

NODE LIFECYCLE

Create

Initialize

Validate

Prepare

Start

Pause

Resume

Complete

Fail

Cancel

Timeout

Compensate (interface only)

====================================================================

NODE VALIDATION

Schema

Configuration

Compatibility

Input

Output

Dependency

Version

====================================================================

NODE FACTORY

Create Node from:

Workflow Definition

Registry

Blueprint

====================================================================

NODE RESOLVER

Resolve:

Node Type

Node Version

Node Definition

Registry

====================================================================

NODE REGISTRY

Integrate with existing Registry.

Read-only.

No duplication.

====================================================================

NODE MIDDLEWARE

Implement middleware pipeline.

Validation

Permission

Tracing

Metrics

Logging

Lifecycle

Allow runtime.use()

====================================================================

NODE EXECUTOR

Create ONLY interfaces.

Do NOT implement execution.

Example:

INodeExecutor

INodeExecutionContext

INodeExecutionResult

INodeExecutionStrategy

====================================================================

CAPABILITY

Node never calls Tool.

Node never calls Connector.

Node requests:

Capability

Example:

crm.create

appointment.book

inventory.search

knowledge.search

No implementation.

Only interfaces.

====================================================================

AI NODE

Do NOT call LLM.

Create contracts only.

Example:

IAINodeExecutor

IAIPromptProvider

IAIResponseHandler

====================================================================

KNOWLEDGE NODE

No RAG.

No Vector DB.

Only interface.

IKnowledgeProvider

IKnowledgeRetriever

====================================================================

MEMORY NODE

No memory implementation.

Interfaces only.

IMemoryProvider

IMemoryReader

IMemoryWriter

====================================================================

EVENTS

Publish via Event Bus:

node.created

node.initialized

node.started

node.completed

node.failed

node.cancelled

node.timeout

node.state.changed

====================================================================

SECURITY

Tenant Isolation

Permission Interface

Execution Scope

====================================================================

METRICS

Node Count

Node Success

Node Failure

Node Runtime

Node Type

Execution Latency

====================================================================

HEALTH

Runtime

Registry

Factory

Validator

Resolver

====================================================================

MONITORING

OpenTelemetry Ready

Trace ID

Correlation ID

Metrics

====================================================================

TESTS

Minimum Coverage

95% Statements

90% Branches

95% Functions

95% Lines

Include:

Factory

Registry

Resolver

Lifecycle

Middleware

Validation

Context

Instance

Events

Public API

====================================================================

OUTPUT

Implement complete package.

No TODO.

No pseudo code.

No Workflow Execution.

No Tool Execution.

====================================================================

VERIFY

Run:

pnpm lint

pnpm build

pnpm typecheck

pnpm test

pnpm format:check

Whole workspace must pass.

No regression.

====================================================================

AFTER IMPLEMENTATION

Generate report:

1 Runtime Architecture

2 Node Lifecycle

3 Node State Machine

4 Factory Flow

5 Registry Integration

6 Middleware Flow

7 Event Flow

8 Metrics

9 Known Limitations

10 Technical Debt

11 Readiness Checklist for ENGINEERING TASK 005.6D Workflow Execution Engine

Do NOT implement Execution Engine.

====================================================================

ADDITIONAL REQUEST (user, in Bahasa Indonesia — translated below)

Recommendation: start preparing an AI Native Node System, not just ordinary BPM nodes.

Also design (contracts only, no implementation) the following node categories:

AIPlannerNode

AIReasonNode

AIReflectionNode

AICriticNode

AIDebateNode

AIVotingNode

AIConsensusNode

AISimulationNode

PromptNode

KnowledgeSearchNode

CapabilityNode

HumanApprovalNode

All of these need only be a contract, schema, manifest, registry integration, lifecycle,
and interface — no execution implementation.

This way, when the Agent Runtime (005.14) is built later, the agent won't need complex
logic of its own — it can simply compose a workflow made of these AI-native nodes, while
all orchestration stays inside the Workflow Engine. This will make AOS far more modular,
easier to test, and highly flexible across industries.
