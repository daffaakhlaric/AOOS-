# ENGINEERING TASK 005.7K — Enterprise Knowledge Generator AI

---

# Objective

Implement the Enterprise Knowledge Generator AI Platform.

Package:

packages/knowledge-generator

Package Name:

@aos/knowledge-generator

The Knowledge Generator AI Platform is responsible for orchestrating AI-assisted generation of enterprise knowledge assets.

This package owns ONLY the orchestration, lifecycle, validation pipeline, provider abstraction, generation metadata, prompt references, and generation workflow.

It MUST NOT implement LLM providers directly.

It MUST NEVER contain OpenAI, Claude, Gemini, Ollama, or provider-specific logic.

Generation is delegated through provider interfaces ONLY.

---

# Architecture Requirements

Must fully comply with:

- docs/001-ENGINEERING-CONSTITUTION.md
- docs/002-ENTERPRISE-ARCHITECTURE.md
- docs/003-DOMAIN-DRIVEN-DESIGN.md
- docs/003.5-CONTRACT-FIRST-DESIGN.md
- docs/004-TECHNOLOGY-SELECTION-RECORD.md

Architecture MUST remain identical to every completed AOS package.

---

# Allowed Dependencies

Core

- @aos/kernel
- @aos/shared
- @aos/events

Knowledge

- @aos/knowledge-engine
- @aos/knowledge-policy
- @aos/knowledge-versioning

Prompt

- @aos/prompt-runtime (contracts only)

Read contracts ONLY.

Never instantiate another runtime.

Never depend on any provider implementation.

---

# Scope

This package owns ONLY:

- Knowledge Generation
- Generation Sessions
- Generation Jobs
- Generation Requests
- Generation Results
- Generation Metadata
- Prompt References
- Context References
- Output Metadata
- Generation Policies
- Generation Statistics
- Generation Audit

No embeddings.

No vector search.

No quality scoring.

No validation.

No recommendation.

---

# Package Structure

packages/

knowledge-generator/

src/

domain/

contracts/

errors/

context/

token/

session/

state-machine/

lifecycle/

registry/

resolver/

validator/

pipeline/

middleware/

factory/

events/

metrics/

health/

monitoring/

statistics/

manager/

generator/

bootstrap/

config/

index.ts

README.md

---

# Public API

Export ONLY

KnowledgeGenerator

KnowledgeGeneratorManager

KnowledgeGeneratorRegistry

KnowledgeGeneratorResolver

KnowledgeGeneratorValidator

KnowledgeGeneratorPipeline

KnowledgeGeneratorMiddleware

KnowledgeGeneratorFactory

KnowledgeGeneratorContext

KnowledgeGeneratorSession

KnowledgeGeneratorLifecycle

KnowledgeGeneratorStateMachine

KnowledgeGeneratorEvents

KnowledgeGeneratorMetrics

KnowledgeGeneratorHealth

KnowledgeGeneratorMonitoring

KnowledgeGeneratorStatistics

KnowledgeGeneratorSystem

---

# Domain Model

Implement

KnowledgeGeneration

KnowledgeGenerationJob

KnowledgeGenerationSession

KnowledgeGenerationRequest

KnowledgeGenerationResult

KnowledgeGenerationContext

KnowledgeGenerationPromptReference

KnowledgeGenerationMetadata

KnowledgeGenerationConfiguration

KnowledgeGenerationPolicy

KnowledgeGenerationAudit

KnowledgeGenerationStatistics

---

# Knowledge Types

Support metadata for generating

- SOP
- FAQ
- Product Knowledge
- Sales Script
- Marketing Content
- HR Policy
- Job Description
- Documentation
- API Documentation
- Technical Specification
- Business Process
- Workflow Documentation
- User Guide
- Knowledge Base Article
- Meeting Summary
- Research Summary
- Proposal
- Contract Template
- Email Template
- Custom Knowledge

Metadata only.

---

# Generation Providers

Support interface metadata for

- OpenAI
- Claude
- Gemini
- Ollama
- Azure OpenAI
- AWS Bedrock
- Vertex AI
- OpenRouter
- LiteLLM
- Custom Provider

Never implement provider logic.

---

# Generation Modes

Support

- Create
- Rewrite
- Expand
- Summarize
- Improve
- Translate
- Convert
- Explain
- Refactor
- Merge
- Split
- Custom

---

# Lifecycle

Implement strict FSM.

States

Draft

Queued

Preparing

Generating

Reviewing

Completed

Cancelled

Failed

Archived

Destroyed

Destroyed is terminal.

---

# Registry

Buckets

Generation Registry

Session Registry

Job Registry

Prompt Registry

Context Registry

Policy Registry

Statistics Registry

Audit Registry

---

# Resolver

Generation Resolver

Prompt Resolver

Context Resolver

Policy Resolver

Session Resolver

---

# Validator

Implement EXACTLY 12 stages

1 Identity

2 Metadata

3 Request

4 Context

5 Prompt

6 Policy

7 Provider

8 Configuration

9 Lifecycle

10 Dependency

11 Integrity

12 Audit

---

# Pipeline

Implement EXACTLY 10 stages

1 Validation

2 Context Resolution

3 Prompt Resolution

4 Policy Resolution

5 Provider Resolution

6 Metadata

7 Metrics

8 Lifecycle

9 Audit

10 Logging

---

# Middleware

generator.use(...)

Requirements

Koa-style middleware

Transport independent

Ordered execution

Async capable

---

# Factory

Generation Factory

Request Factory

Result Factory

Session Factory

Prompt Factory

Metadata Factory

---

# Events

GenerationCreated

GenerationQueued

GenerationStarted

GenerationCompleted

GenerationFailed

GenerationCancelled

GenerationArchived

GenerationDestroyed

---

# Metrics

Generation Count

Completed Count

Failed Count

Prompt Usage

Context Usage

Policy Usage

Provider Usage

Average Duration

---

# Monitoring

Implement

Metrics

Health

Monitoring

Statistics

---

# Extension Points

Interfaces ONLY

Never implement.

IKnowledgeGenerationProvider

IKnowledgePromptProvider

IKnowledgeContextProvider

IKnowledgeGenerationPolicy

IKnowledgeGenerationOptimizer

IKnowledgeGenerationCache

IKnowledgeGenerationStorage

IKnowledgeGenerationPublisher

IKnowledgeGenerationAuditor

IKnowledgeGenerationScheduler

IKnowledgeGenerationCostProvider

IKnowledgeGenerationStreamingProvider

---

# Future Readiness

Prepare interface-only contracts for

005.7L Knowledge Quality Engine

005.7M Knowledge Validator AI

005.7N Embedding Manager

No implementation.

---

# AI Scope Boundary

This package orchestrates AI.

It MUST NEVER:

- call OpenAI SDK
- call Claude SDK
- call Gemini SDK
- create prompts
- implement inference
- implement embeddings
- implement vector search
- implement memory
- implement workflow execution

Everything is delegated through interfaces.

---

# Testing Requirements

Target

550+ Tests

Coverage

Statements ≥95%

Branches ≥90%

Functions ≥95%

Lines ≥95%

Test

- Domain
- Errors
- Context
- Session
- Token
- Lifecycle
- State Machine
- Registry
- Resolver
- Validator
- Pipeline
- Middleware
- Factory
- Events
- Metrics
- Health
- Monitoring
- Statistics
- Manager
- Bootstrap
- Public API
- Generation Operations
- Session Operations
- Job Operations
- Request Operations
- Result Operations
- Provider Resolution
- Prompt Resolution
- Context Resolution

No skipped tests.

---

# Workspace Validation

Run

pnpm -w lint

pnpm -w build

pnpm -w typecheck

pnpm -w test

pnpm -w format:check

Requirements

- Zero regressions
- Zero lint errors
- Zero type errors
- Zero formatting issues

---

# Deliverables

Create

packages/knowledge-generator/README.md

docs/005.7K-KNOWLEDGE-GENERATOR-AI-REPORT.md

Include

- Architecture
- Domain Model
- Generation Flow
- Provider Abstraction
- Prompt Resolution
- Context Resolution
- Lifecycle
- Registry
- Validation
- Pipeline
- Metrics
- Monitoring
- Statistics
- Known Limitations
- Technical Debt
- Readiness Checklist for 005.7L

---

# Scope Boundaries (STRICT)

This package MUST NOT implement:

- OpenAI SDK
- Claude SDK
- Gemini SDK
- Ollama SDK
- LiteLLM
- Prompt Runtime
- Embedding
- Vector Search
- RAG
- Memory
- Workflow
- Agent Runtime
- Recommendation
- Knowledge Quality
- Knowledge Validation
- Business Logic

This package is the Enterprise Knowledge Generation Orchestrator ONLY.

Maintain identical architecture, package structure, coding standards, testing quality, documentation quality, and runtime independence as every completed AOS package.
