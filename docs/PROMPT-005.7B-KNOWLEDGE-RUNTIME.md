# ENGINEERING TASK 005.7B

Enterprise Knowledge Runtime

---

# Background

The Enterprise Knowledge Engine (005.7A) has been completed.

Knowledge Engine defines the domain model.

Knowledge Runtime executes and manages Knowledge during runtime.

This package MUST NOT implement:

- Embedding
- Vector Search
- RAG
- Retrieval
- Chunking
- Synchronization
- AI
- LLM
- Search Engine

Those belong to later roadmap phases.

Knowledge Runtime is responsible only for runtime lifecycle management.

---

# Package

packages/knowledge-runtime

package name

@aos/knowledge-runtime

---

# Goal

Create the runtime layer that manages enterprise knowledge during execution.

Knowledge Runtime is the bridge between:

Knowledge Engine

↓

Workflow Runtime

↓

Memory

↓

Prompt Intelligence

↓

Capability Runtime

↓

Agent Runtime

It never performs AI operations.

It only manages runtime state.

---

# Public API

KnowledgeRuntime

KnowledgeRuntimeSystem

KnowledgeRuntimeContext

KnowledgeRuntimeInstance

KnowledgeRuntimeSession

KnowledgeRuntimeManager

KnowledgeRuntimeRegistry

KnowledgeRuntimeResolver

KnowledgeRuntimeLoader

KnowledgeRuntimeValidator

KnowledgeRuntimeStateMachine

KnowledgeRuntimeLifecycle

KnowledgeRuntimeMiddleware

KnowledgeRuntimeEvents

KnowledgeRuntimeMetrics

KnowledgeRuntimeHealth

KnowledgeRuntimeMonitor

KnowledgeRuntimeFactory

---

# Runtime Domain

Design aggregates

KnowledgeRuntimeInstance

KnowledgeRuntimeExecution

KnowledgeRuntimeContext

KnowledgeRuntimeSnapshot

KnowledgeRuntimeHistory

KnowledgeRuntimeState

KnowledgeRuntimeCursor

KnowledgeRuntimeScope

KnowledgeRuntimeLease

KnowledgeRuntimeToken

KnowledgeRuntimeCacheReference

KnowledgeRuntimeMetadata

KnowledgeRuntimeStatistics

KnowledgeRuntimeCheckpoint (interface only)

KnowledgeRuntimeReplay (interface only)

KnowledgeRuntimeCompensation (interface only)

---

# Runtime Lifecycle

Created

Loading

Loaded

Validating

Ready

Running

Suspended

Resuming

Completed

Failed

Cancelled

Expired

Destroyed

---

# Runtime State Machine

Implement a strict finite-state machine.

No illegal transitions.

Reuse architecture pattern from Workflow Runtime.

---

# Runtime Context

Contains

KnowledgeId

RuntimeId

ExecutionToken

TenantId

WorkspaceId

OrganizationId

DepartmentId

SessionId

TraceId

CorrelationId

Environment

Language

Metadata

Permission

Policy

Variables

ExecutionScope

---

# Runtime Session

KnowledgeSession

Supports

Open

Close

Suspend

Resume

Renew

Expire

Destroy

No persistence.

---

# Runtime Loader

Loads Knowledge Assets from:

Knowledge Registry

Knowledge Repository

Knowledge Catalog

Read-only only.

---

# Runtime Resolver

Resolve

Knowledge Asset

Relationships

Dependencies

References

Namespaces

Policies

Permissions

Versions

Templates

No retrieval.

No indexing.

---

# Runtime Registry

Maintain runtime instances.

Register

Unregister

Lookup

Snapshot

Health

Metrics

Lifecycle

---

# Runtime Middleware

Create middleware pipeline

Validation

Permission

Policy

Tracing

Metrics

Lifecycle

Logging

Context

Custom Middleware

runtime.use()

Extensible.

---

# Runtime Validator

Validation pipeline

Runtime State

Context

Permission

Policy

Lifecycle

Relationships

Namespace

Metadata

Tenant

Workspace

Execution Token

---

# Runtime Events

Publish

knowledge.runtime.created

knowledge.runtime.loaded

knowledge.runtime.ready

knowledge.runtime.started

knowledge.runtime.suspended

knowledge.runtime.resumed

knowledge.runtime.completed

knowledge.runtime.failed

knowledge.runtime.cancelled

knowledge.runtime.destroyed

knowledge.runtime.validation.failed

knowledge.runtime.health.changed

Use @aos/event-bus.

---

# Metrics

Runtime Count

Active Runtime

Failed Runtime

Suspended Runtime

Execution Time

Load Time

Validation Failures

Tenant Usage

Workspace Usage

Lifecycle Statistics

---

# Health

Healthy

Warning

Degraded

Unavailable

Unknown

---

# Monitoring

Runtime Dashboard

Execution Dashboard

Lifecycle Dashboard

Validation Dashboard

Tenant Dashboard

Workspace Dashboard

Performance Dashboard

---

# Extension Points

Create interface-only contracts.

IKnowledgeRuntimeCache

IKnowledgeRuntimeStorage

IKnowledgeRuntimeCheckpoint

IKnowledgeRuntimeReplay

IKnowledgeRuntimeCompensation

IKnowledgeRuntimeObserver

IKnowledgeRuntimeHook

IKnowledgeRuntimeTracer

IKnowledgeRuntimeScheduler

IKnowledgeRuntimeLeaseProvider

No implementation.

---

# Dependency Rules

Allowed

@aos/runtime-kernel

@aos/registry

@aos/event-bus

@aos/scheduler

@aos/workflow-runtime

@aos/workflow-definition

@aos/workflow-execution

@aos/workflow-integration

@aos/knowledge-engine

Forbidden

memory

retrieval

indexing

vector

embedding

agent-runtime

capability-runtime

tool-runtime

connector-runtime

ai-gateway

model-router

experience-layer

Only interface references.

---

# Middleware Architecture

Follow exactly the same architecture pattern used in

Workflow Runtime

Node Runtime

Workflow Integration

Validation

↓

Permission

↓

Policy

↓

Tracing

↓

Metrics

↓

Lifecycle

↓

Logging

↓

Custom Middleware

---

# Runtime Token

Every runtime instance must have

KnowledgeRuntimeToken

Never search runtime instances by scanning collections.

Use token lookup.

---

# Runtime Factory

KnowledgeRuntimeFactory

RuntimeContextFactory

RuntimeSessionFactory

RuntimeSnapshotFactory

RuntimeMetadataFactory

RuntimeTokenFactory

---

# Testing

Target

220+ tests

Coverage

Statements ≥95%

Branches ≥90%

Functions ≥95%

Lines ≥95%

Test

State Machine

Lifecycle

Loader

Resolver

Registry

Middleware

Validator

Events

Metrics

Health

Monitoring

Factory

Public API

Bootstrap

No skipped tests.

---

# Workspace Verification

Run

pnpm -w lint

pnpm -w build

pnpm -w typecheck

pnpm -w test

pnpm -w format:check

Everything must pass.

Zero regressions.

---

# Deliverables

README.md

docs/005.7B-KNOWLEDGE-RUNTIME-REPORT.md

Include

Architecture

Runtime Flow

State Machine

Lifecycle

Registry

Middleware

Validation

Metrics

Health

Monitoring

Technical Debt

Known Limitations

Readiness Checklist for 005.7C Knowledge Indexing

---

# Important

This package is ONLY responsible for runtime lifecycle.

It MUST NOT implement

Vector Search

Embeddings

RAG

Chunking

Retrieval

Search

Synchronization

AI

LLM

Prompting

Memory

Agent Logic

Everything must remain modular, metadata-driven, strongly typed, event-driven, and fully aligned with the AOS Runtime architecture.

No placeholders.

No TODOs.

No demo implementations.

No business logic outside Knowledge Runtime.
