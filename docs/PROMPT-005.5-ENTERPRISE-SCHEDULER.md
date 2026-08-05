# PROMPT 005.5 — Enterprise Scheduler (archived source prompt)

> Archived verbatim (structure preserved) before implementation, per the established
> pattern for every numbered Engineering Task prompt in this repository.

## Role

Principal Distributed Systems Engineer, Principal Runtime Architect, Distinguished
Scheduling System Engineer, Enterprise Infrastructure Architect, building the AOS
Enterprise Scheduler.

"INI BUKAN CRON. INI BUKAN NODE-CRON. INI BUKAN BULLMQ SCHEDULER. INI ADALAH CORE
SCHEDULING PLATFORM untuk seluruh Autonomous Operating System (AOS)."

## Wajib Membaca

docs/001-ENGINEERING-CONSTITUTION.md, docs/002-ENTERPRISE-ARCHITECTURE.md,
docs/003-DOMAIN-DRIVEN-DESIGN.md, docs/003.5-CONTRACT-FIRST-DESIGN.md,
docs/004-TECHNOLOGY-SELECTION-RECORD.md, docs/004A-COST-SCALING-STRATEGY.md, plus the
005.1/005.2/005.3/005.3A/005.4 implementations.

## Objective

Implementasikan Enterprise Scheduler. Scheduler bertanggung jawab menentukan KAPAN sebuah
Job dijalankan. Scheduler TIDAK mengetahui Workflow/Agent/Tool/Planner/Reasoner/Memory —
Scheduler hanya menerbitkan Event.

## Jangan Membuat

Workflow Runtime, Planner (execution planner), Reasoner, Reflection, Tool Runtime, Memory
Engine, Simulation Runtime, Agent Runtime, AI Gateway.

## Package Baru

`packages/scheduler`

## Module

contracts, entities, scheduler, planner, timer, trigger, dispatcher, clock, calendar,
policy, queue, retry, store-interface, validator, serializer, events, metrics,
monitoring, health, config, bootstrap, errors, utils, test.

## Scheduler Entity

Job, Schedule, Trigger, Execution Window, Retry Policy, Business Hour Policy, Holiday
Policy, Clock, Queue.

## Supported Schedule

One Time, Recurring, Interval, Cron Expression, Calendar Schedule, Delayed Schedule,
Dependency Schedule, Manual Trigger. Future: Event Trigger.

## Supported Time

UTC, Timezone, DST Ready, Tenant Timezone.

## Clock

Implementasikan Interface `IClockProvider`. Implementasi: System Clock, Mock Clock. Belum
membuat Simulation Clock.

## Schedule Store

Implementasikan Interface `IScheduleStore`. Implementasi: In Memory. Belum membuat
PostgreSQL. Belum membuat Redis.

## Trigger

Time Trigger, Manual Trigger, Dependency Trigger, Retry Trigger.

## Retry

Exponential Backoff, Linear Backoff, Maximum Retry, Retry Metadata, Retry Strategy
Interface.

## Queue

Priority Queue, Ready Queue, Delayed Queue, Retry Queue.

## Job Priority

Critical, High, Normal, Low, Background.

## Job State

Pending, Waiting, Ready, Running, Completed, Failed, Retrying, Paused, Cancelled,
Expired.

## Business Hours

Implementasikan Interface. Support: Working Hour, Lunch Break, Weekend. Belum
implementasi penuh.

## Holiday

Implementasikan Interface `IHolidayProvider`. Belum implementasi negara. Belum
implementasi API.

## Multi Tenant

Support: Tenant Timezone, Tenant Business Hours, Tenant Holiday, Tenant Concurrency,
Tenant Quota.

## Event Bus

Semua perubahan Job WAJIB Publish Event. Namespace: `scheduler.job.created`,
`scheduler.job.updated`, `scheduler.job.deleted`, `scheduler.job.ready`,
`scheduler.job.started`, `scheduler.job.completed`, `scheduler.job.failed`,
`scheduler.job.retry`, `scheduler.job.paused`, `scheduler.job.resumed`,
`scheduler.job.cancelled`, `scheduler.job.expired`.

## Validation

Schedule Validation, Cron Validation, Timezone Validation, Business Hour Validation,
Retry Validation, Dependency Validation, Tenant Validation.

## Dependency

Support: Job Dependency, Chain Dependency, Cycle Detection.

## Metrics

Job Created, Job Running, Job Success, Job Failed, Retry Count, Execution Delay,
Schedule Drift, Queue Depth, Scheduler Latency.

## Health

Scheduler Health, Clock Health, Queue Health, Trigger Health, Dispatcher Health.

## Monitoring

OpenTelemetry Ready, Trace ID, Correlation ID, Metrics Interface.

## Serializer

JSON. Future: MessagePack.

## Security

Tenant Isolation, Permission Interface, Audit Event.

## Larangan

Jangan membuat: Workflow Runtime, Workflow Engine, Tool Runtime, Memory Runtime, Planner
(execution), Reasoner, AI Runtime, Simulation Runtime.

## Test

Minimal: 95% Statement, 90% Branch, 95% Function, 95% Line. Tambahkan: Clock Test, Retry
Test, Dependency Test, Priority Test, Timezone Test, Business Hour Test, Holiday Test,
Queue Test, State Machine Test, Cron Parser Test, Validation Test, Metrics Test.

## Output

Implementasikan package lengkap. Jangan pseudo code. Jangan contoh. Jangan TODO kosong.

## Verifikasi

Pastikan `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm format:check`
seluruh workspace berhasil. Tidak boleh ada regression.

## Setelah Selesai — Laporan Implementasi

1. Scheduler Architecture
2. Module Diagram
3. Job Lifecycle
4. Trigger Flow
5. Queue Flow
6. Retry Flow
7. Dependency Flow
8. Event Publishing Flow
9. Clock Architecture
10. Schedule Validation Flow
11. Health Check
12. Metrics
13. Technical Debt
14. Known Limitation
15. Checklist kesiapan ENGINEERING TASK 005.6 Workflow Runtime

Jangan mengimplementasikan Workflow Runtime.

## Tambahan 1 — Scheduler Policy Engine

Selain `BusinessHourPolicy`, buat fondasi `ISchedulerPolicy`. Contoh kebijakan masa
depan: Maximum concurrent jobs per tenant, Blackout window (misalnya tidak boleh kirim
kampanye saat maintenance), Rate limiting per tenant, Daily execution quota. Sekarang
cukup interface dan pipeline kebijakannya, implementasi aturan bisa menyusul.

## Tambahan 2 — Distributed Lock Interface

Walaupun sekarang Scheduler masih single-node, siapkan kontrak `ISchedulerLockProvider`,
dengan implementasi awal `InMemoryLockProvider`. Nanti pada deployment multi-node bisa
ditambahkan Redis Lock, PostgreSQL Advisory Lock, Kubernetes Lease, tanpa mengubah logika
Scheduler.
