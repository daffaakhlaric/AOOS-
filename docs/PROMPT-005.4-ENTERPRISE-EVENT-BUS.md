# PROMPT 005.4 — Enterprise Event Bus (archived source prompt)

> Archived verbatim (structure preserved) before implementation, per the established
> pattern for every numbered Engineering Task prompt in this repository.

## Scope Boundary (given before the prompt itself)

Scope 005.4 hanya boleh mengerjakan:

- ✅ Event Contract
- ✅ Event Runtime
- ✅ Event Dispatcher
- ✅ Event Publisher
- ✅ Event Subscriber
- ✅ Event Store Interface
- ✅ Event Validation
- ✅ Event Retry
- ✅ Event DLQ Interface
- ✅ Event Metrics
- ✅ Event Trace
- ✅ Event Replay Interface
- ❌ Tidak boleh membuat Workflow Runtime
- ❌ Tidak boleh membuat Scheduler
- ❌ Tidak boleh membuat Agent Runtime
- ❌ Tidak boleh membuat Tool Runtime
- ❌ Tidak boleh membuat Memory Engine

## Role

Principal Distributed Systems Engineer, Principal Runtime Architect, Distinguished
Event-Driven Architecture Engineer, building the AOS Enterprise Event Platform.

"INI BUKAN EventEmitter. INI BUKAN Pub/Sub sederhana. INI ADALAH CORE EVENT
INFRASTRUCTURE untuk seluruh Autonomous Operating System (AOS)."

## Wajib Membaca

docs/001-ENGINEERING-CONSTITUTION.md, docs/002-ENTERPRISE-ARCHITECTURE.md,
docs/003-DOMAIN-DRIVEN-DESIGN.md, docs/003.5-CONTRACT-FIRST-DESIGN.md,
docs/004-TECHNOLOGY-SELECTION-RECORD.md, docs/004A-COST-SCALING-STRATEGY.md, plus the
005.1/005.2/005.3/005.3A implementations.

## Objective

Implementasikan Enterprise Event Bus — komunikasi utama seluruh Runtime. Semua komponen
Runtime WAJIB menggunakan Event Bus, tidak boleh saling memanggil langsung.

## Jangan Membuat

Workflow Runtime, Scheduler, Planner, Reasoner, Reflection, Tool Runtime, AI Gateway,
Agent Runtime, Memory Engine, Simulation Runtime.

## Package Baru

`packages/event-bus`

## Module

contracts, dispatcher, publisher, subscriber, broker, validator, serializer, router,
filter, retry, dead-letter, replay, metrics, tracing, health, monitoring, buffer,
priority, store-interface, events, errors, config, bootstrap, utils, test.

## Event Contract

Base Event, Domain Event, System Event, Infrastructure Event, Lifecycle Event, Audit
Event, Monitoring Event, Simulation Event.

## Setiap Event Memiliki

Event ID, Correlation ID, Causation ID, Tenant ID, Source, Producer, Timestamp, Priority,
Version, Schema Version, Payload, Metadata, Trace ID.

## Event Validation

Schema Validation, Version Validation, Payload Validation, Tenant Validation, Permission
Validation (interface).

## Publisher

Publish, PublishAsync, PublishBatch, Delayed Publish (interface only), Scheduled Publish
(interface only).

## Subscriber

Subscribe, Unsubscribe, Wildcard Subscription, Namespace Subscription, Priority
Subscription.

## Routing

Support: Namespace, Topic, Pattern, Tenant, Category, Priority.

## Event Namespace

`agent.*`, `workflow.*`, `tool.*`, `registry.*`, `scheduler.*`, `memory.*`, `planning.*`,
`reasoning.*`, `reflection.*`, `analytics.*`, `simulation.*`, `tenant.*`, `system.*`,
`audit.*`, `monitoring.*`.

## Retry

Exponential Backoff, Linear Backoff, Retry Policy Interface, Retry Count, Retry Metadata.

## Dead Letter

Interface only. Belum persistence.

## Replay

Interface only. Belum storage.

## Buffer

Memory Buffer, Priority Queue, Batch Queue.

## Event Priority

Critical, High, Normal, Low, Background.

## Filter

Tenant Filter, Capability Filter, Namespace Filter, Type Filter, Version Filter.

## Tracing

Correlation ID, Trace ID, Span Metadata, OpenTelemetry ready.

## Metrics

Published, Delivered, Dropped, Retried, Rejected, Latency, Queue Depth, Subscriber Count.

## Health

Publisher Health, Subscriber Health, Dispatcher Health, Router Health, Broker Health.

## Store

Buat interface saja. Belum implementasi database.

## Serializer

JSON. Future: MessagePack, Avro.

## Security

Tenant Isolation, Event Signature Interface, Payload Validation.

## Test

Minimal 95% Coverage — Publisher Test, Subscriber Test, Routing Test, Validation Test,
Retry Test, Filtering Test, Tracing Test, Metrics Test, Namespace Test, Priority Test.

## Output

Implementasikan seluruh package. Bukan pseudo code. Bukan contoh.

## Verifikasi

`pnpm lint`, `pnpm build`, `pnpm test`, `pnpm typecheck` — semua harus lolos.

## Setelah Selesai — Laporan

1. Architecture
2. Event Flow
3. Event Lifecycle
4. Dispatcher Diagram
5. Routing Diagram
6. Retry Flow
7. DLQ Flow
8. Replay Flow
9. Metrics
10. Technical Debt
11. Known Limitation
12. Checklist ENGINEERING TASK 005.5 Scheduler

Jangan membuat Scheduler.

## Tambahan 1 — Event Sourcing Readiness

Karena target adalah AI Organization, Event Bus sejak awal harus mendukung Event
Sourcing meskipun implementasinya belum dibuat. Tambahkan interface: `IEventStore`,
`IEventSnapshotStore`, `IEventReplayProvider`, `IEventArchiveProvider`. Belum ada
implementasi database — hanya kontrak (interface). Ini memungkinkan nantinya: replay
seluruh aktivitas AI Agent, audit keputusan AI, simulasi ulang skenario, dan
melatih/mengevaluasi ulang strategi agent berdasarkan histori event.

## Tambahan 2 — Capability Namespace

Tambahkan namespace `capability.*` (contoh: `capability.resolved`, `capability.failed`,
`capability.deprecated`), karena Capability akan menjadi bahasa utama seluruh Agent dan
Tool Runtime — menyiapkan namespace ini sejak Event Bus membuat integrasi pada 005.8 Tool
SDK lebih bersih tanpa perubahan kontrak Event Bus lagi.
