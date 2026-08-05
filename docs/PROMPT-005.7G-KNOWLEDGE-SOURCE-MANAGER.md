# ENGINEERING TASK 005.7G

Enterprise Knowledge Source Manager

---

# Background

The following packages are complete.

005.7A Knowledge Engine

005.7B Knowledge Runtime

005.7C Knowledge Indexing

005.7D Knowledge Retrieval

005.7E Knowledge Synchronization

005.7F Knowledge Provider

Knowledge Source Manager is responsible for managing every configured Knowledge Source instance.

Knowledge Provider defines WHAT a provider is.

Knowledge Source Manager manages ACTUAL configured sources owned by tenants.

Knowledge Source Manager MUST NOT implement

- OAuth
- Connector SDK
- API Clients
- Synchronization
- Retrieval
- Indexing
- Embedding
- AI
- Memory

Those belong to other roadmap phases.

---

# Package

packages/knowledge-source-manager

package

@aos/knowledge-source-manager

---

# Vision

Build a vendor-neutral Enterprise Knowledge Source Management Platform.

A Provider may have unlimited Sources.

Every tenant manages its Knowledge Sources through this package.

---

# Public API

KnowledgeSourceManager

KnowledgeSourceManagerSystem

KnowledgeSource

KnowledgeSourceRegistry

KnowledgeSourceResolver

KnowledgeSourceFactory

KnowledgeSourceContext

KnowledgeSourceSession

KnowledgeSourceValidator

KnowledgeSourcePipeline

KnowledgeSourceLifecycle

KnowledgeSourceStateMachine

KnowledgeSourceMetrics

KnowledgeSourceHealth

KnowledgeSourceMonitor

KnowledgeSourceEvents

KnowledgeSourceStatistics

KnowledgeSourceConfiguration

KnowledgeSourcePolicy

KnowledgeSourcePermission

KnowledgeSourceScheduler

KnowledgeSourceCatalog

---

# Source Lifecycle

Created

Registered

Configured

Validated

Enabled

Disabled

Scheduled

Synchronizing

Paused

Archived

Deleted

Destroyed

---

# Source Categories

Document Source

Repository Source

CMS Source

Storage Source

Database Source

API Source

CRM Source

ERP Source

Filesystem Source

Cloud Source

Knowledge Source

Custom Source

---

# Source Metadata

SourceId

SourceName

SourceDescription

SourceCategory

SourceProvider

ProviderId

ProviderVersion

Namespace

Collection

WorkspaceId

TenantId

OrganizationId

DepartmentId

Labels

Tags

Priority

Policy

Permission

Environment

Owner

CreatedBy

UpdatedBy

CreatedAt

UpdatedAt

---

# Source Configuration

Metadata only.

No OAuth.

No Secret.

No API Client.

Support

Schedule

Namespace

Collection

Policy

Permission

Priority

Sync Mode

Enabled

Auto Sync

Incremental

Versioning

Retention

---

# Source Context

ExecutionToken

SourceId

ProviderId

WorkspaceId

TenantId

OrganizationId

DepartmentId

Environment

Namespace

Policy

Permission

Metadata

TraceId

CorrelationId

---

# Source Pipeline

Validation

↓

Configuration

↓

Policy

↓

Permission

↓

Provider Resolution

↓

Registration

↓

Catalog

↓

Metrics

↓

Events

---

# Source Registry

Register

Sources

Categories

Namespaces

Collections

Policies

Permissions

Statistics

Sessions

Health

---

# Catalog

Maintain

Source Catalog

Source Metadata

Provider Mapping

Namespace Mapping

Collection Mapping

Workspace Mapping

Tenant Mapping

---

# Resolver

Resolve by

Source Id

Provider

Category

Workspace

Tenant

Namespace

Collection

Policy

Permission

Metadata

Priority

---

# Scheduler

Metadata only.

Support

Manual

Cron

Interval

One Time

Future Event

---

# Factory

KnowledgeSourceFactory

KnowledgeSourceContextFactory

KnowledgeSourceSessionFactory

KnowledgeSourceMetadataFactory

KnowledgeSourceConfigurationFactory

KnowledgeSourceStatisticsFactory

---

# Middleware Pipeline

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

Support

source.use()

---

# Events

knowledge.source.created

knowledge.source.updated

knowledge.source.deleted

knowledge.source.enabled

knowledge.source.disabled

knowledge.source.registered

knowledge.source.archived

knowledge.source.metrics.updated

knowledge.source.health.changed

---

# Metrics

Source Count

Provider Count

Workspace Count

Tenant Count

Namespace Count

Collection Count

Sync Enabled Count

Schedule Count

Policy Count

Permission Count

---

# Health

Healthy

Warning

Degraded

Unavailable

Unknown

---

# Monitoring

Source Dashboard

Workspace Dashboard

Tenant Dashboard

Namespace Dashboard

Collection Dashboard

Provider Dashboard

Health Dashboard

Usage Dashboard

---

# Extension Points

Create interface-only contracts.

IKnowledgeSource

IKnowledgeSourceRegistry

IKnowledgeSourceResolver

IKnowledgeSourceFactory

IKnowledgeSourceValidator

IKnowledgeSourceObserver

IKnowledgeSourceHook

IKnowledgeSourcePolicy

IKnowledgeSourcePermission

IKnowledgeSourceScheduler

IKnowledgeSourceCatalog

IKnowledgeSourceTelemetry

IKnowledgeSourceMetrics

Interfaces only.

---

# Dependency Rules

Allowed

@aos/runtime-kernel

@aos/registry

@aos/event-bus

@aos/scheduler

@aos/knowledge-provider

@aos/knowledge-synchronization

@aos/knowledge-engine

@aos/knowledge-runtime

Forbidden

connector-runtime

oauth

secret-manager

tool-runtime

memory

ai-gateway

agent-runtime

Only interface references.

---

# Runtime Token

Every Source must have

SourceToken

Never scan collections.

Lookup by token.

---

# Testing

Target

320+

Coverage

Statements ≥95%

Branches ≥90%

Functions ≥95%

Lines ≥95%

Test

Lifecycle

State Machine

Registry

Resolver

Catalog

Configuration

Metadata

Policy

Permission

Scheduler

Factory

Validator

Pipeline

Middleware

Metrics

Health

Monitoring

Events

Bootstrap

Workspace Verification

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

docs/005.7G-KNOWLEDGE-SOURCE-MANAGER-REPORT.md

Include

Architecture

Source Model

Catalog

Registry

Pipeline

Lifecycle

Configuration

Policy

Permission

Metrics

Health

Monitoring

Technical Debt

Known Limitations

Readiness Checklist for 005.7H Knowledge Versioning

---

# IMPORTANT

This package is ONLY the Enterprise Knowledge Source Management layer.

It MUST NOT implement

OAuth

Secrets

Connector SDK

Google Drive SDK

Notion SDK

SharePoint SDK

GitHub SDK

Synchronization

Retrieval

Indexing

Embedding

Memory

AI

Provider-specific logic

No placeholders.

No TODOs.

No demo implementations.

Everything must remain strongly typed, contract-first, metadata-driven, event-driven, vendor-neutral, modular, and fully aligned with the AOS Runtime architecture.

---

# Target Arsitektur Setelah 005.7G

Setelah modul ini selesai, struktur Knowledge Platform akan menjadi sangat jelas:

```
Google Drive Provider
Notion Provider
GitHub Provider
Database Provider
        │
        ▼
Knowledge Provider (Definition)
        │
        ▼
Knowledge Source Manager (Configured Instances)
        │
        ▼
Knowledge Synchronization
        │
        ▼
Knowledge Engine
        │
        ▼
Knowledge Runtime
        │
        ▼
Knowledge Indexing
        │
        ▼
Knowledge Retrieval
```

Contoh nyata di UI nanti:

Satu Google Drive Provider dapat memiliki banyak Knowledge Source yang dikelola tenant:

```
Provider:
└── Google Drive

Knowledge Sources:
├── Marketing SOP
├── Product Catalog
├── HR Documents
├── Legal Contracts
└── Sales Playbook
```
