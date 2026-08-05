# @aos/scheduler

The AOS Enterprise Scheduler — decides **when** a Job runs and publishes `scheduler.job.*`
events onto the Event Bus. **Not Cron. Not node-cron. Not a BullMQ Scheduler.** The
Scheduler knows nothing about Workflow/Agent/Tool/Planner/Reasoner/Memory — see
`docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md` for the explicit scope boundary.

## Quick example

```ts
import { EventBroker } from "@aos/event-bus";
import { Scheduler, SchedulerEventPublisher, ScheduleType } from "@aos/scheduler";

const bus = new EventBroker();
bus.subscribe({
  criteria: { namespace: "scheduler" },
  handler: (event) => console.log(event.type, event.payload),
});

const scheduler = new Scheduler({ eventPublisher: new SchedulerEventPublisher(bus) });

const job = await scheduler.createJob({
  name: "daily-report",
  schedule: { type: ScheduleType.CRON, timezone: "Asia/Jakarta", expression: "0 9 * * *" },
});

// Advance time however the host does (a real interval, a cron trigger, a test clock, ...).
await scheduler.tick(); // publishes scheduler.job.ready for every Job whose time has come
```

## Architecture: Planner → Timer → Trigger → Dispatcher → Event Publisher

`Scheduler` (`scheduler/scheduler.ts`) is the composition root, mirroring `EventBroker`
(`@aos/event-bus`) and `RegistrySystem` (`@aos/registry`):

1. **`createJob()`** runs the Validation Pipeline (Schedule → Cron → Timezone → Retry →
   Dependency → Tenant), then asks the **Planner** (`planner/schedule-planner.ts`) to
   compute the Job's `nextFireAt` — dispatching to a hand-rolled Cron parser/next-fire
   search (`planner/cron-parser.ts`, `planner/cron-next-fire.ts`) for both Cron and
   Recurring schedules (Recurring is converted to an equivalent restricted Cron
   Expression and reuses the same search).
2. **`tick()`** drives the **Timer** (`timer/timer-service.ts`), which promotes every
   `Waiting`/`Retrying` Job whose `nextFireAt` has elapsed to `Ready`, publishing
   `scheduler.job.ready` for each.
3. **`fireManual()`** / a completed dependency / a scheduled retry are the other three
   ways a Job becomes Ready — see `trigger/`.
4. **`dispatchReady()`** hands a Ready Job through the **Policy Pipeline**
   (`policy/policy-pipeline.ts` — Business Hours, Holiday, and the extension point for
   future concurrency/blackout/rate-limit/quota policies) and a **Distributed Lock**
   (`lock/i-scheduler-lock-provider.ts`) before a downstream Runtime is allowed to claim
   it.
5. **`reportStarted()`/`reportCompleted()`/`reportFailed()`** are called by whatever
   Runtime actually executes the Job (out of scope here) to report back. `reportFailed()`
   schedules a retry under the Job's Retry Policy, or expires it once retries are
   exhausted.
6. Every state-changing call ends by publishing the matching `scheduler.job.*` event via
   `SchedulerEventPublisher` — "Scheduler hanya menerbitkan Event."

## Job State Machine

```
pending → waiting → ready → running → completed
             │         │        └──→ failed → retrying → ready (loop until exhausted)
             │         │                  └──→ expired
             ├──→ paused → waiting
             └──→ cancelled / expired (from waiting/ready)
```

See `contracts/job-state.ts`'s `JOB_STATE_TRANSITIONS` for the authoritative table.

## Supported Schedule kinds

One Time, Recurring (`daily`/`weekly`/`monthly` at a fixed `HH:mm`), Interval, Cron
Expression (standard 5-field), Calendar (explicit date list), Delayed, Dependency (Job/
Chain Dependency with Cycle Detection), Manual. Event Trigger is explicitly future work.

## Folder Structure

| Folder             | Contents                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `contracts/`       | Zod schemas for the 8 Schedule kinds, `JobPriority`, `JobState` + transitions, `IRetryPolicy` |
| `entities/`        | `JobRecord`, `CreateJobInput`, `ExecutionRecord`                                              |
| `scheduler/`       | `Scheduler` — the public façade                                                               |
| `planner/`         | Hand-rolled Cron parser + next-fire search, `SchedulePlanner` (dispatches per Schedule kind)  |
| `timer/`           | `TimerService` — the clock-driven Waiting→Ready promotion loop                                |
| `trigger/`         | `TimeTrigger`/`ManualTrigger`/`DependencyTrigger`/`RetryTrigger`                              |
| `dispatcher/`      | `JobDispatcher` — Policy Pipeline + Distributed Lock gating                                   |
| `clock/`           | `IClockProvider`, `SystemClock`, `MockClock`                                                  |
| `calendar/`        | `IHolidayProvider`, `StaticHolidayProvider`                                                   |
| `policy/`          | `ISchedulerPolicy`, `PolicyPipeline`, `BusinessHoursPolicy`, `HolidayPolicy`                  |
| `queue/`           | `MemoryQueue`, `JobPriorityQueue`, `ReadyQueue`, `DelayedQueue`, `RetryQueue`                 |
| `retry/`           | `ExponentialBackoffPolicy`, `LinearBackoffPolicy`, `createRetryPolicy` factory                |
| `lock/`            | `ISchedulerLockProvider`, `InMemoryLockProvider`                                              |
| `store-interface/` | `IScheduleStore`, `InMemoryScheduleStore`                                                     |
| `validator/`       | Schedule/Cron/Timezone/Retry/Dependency/Tenant validators + `ValidationPipeline`              |
| `serializer/`      | `JsonSerializer`                                                                              |
| `events/`          | `SchedulerEventPublisher` — publishes onto `@aos/event-bus`                                   |
| `metrics/`         | `SchedulerMetricsCollector`                                                                   |
| `health/`          | `SchedulerHealth` — Scheduler/Clock/Queue/Trigger/Dispatcher Health                           |
| `monitoring/`      | `SchedulerMonitor` (Metrics + Health) — re-exports `@aos/event-bus`'s Tracing port            |
| `config/`          | `SchedulerConfig`                                                                             |
| `bootstrap/`       | `SchedulerSystem` — implements `@aos/runtime-kernel`'s `IModule`                              |
| `errors/`          | `SchedulerException` + 7 concrete subclasses                                                  |

## Event Bus namespace

`scheduler.job.created`, `.updated`, `.deleted`, `.ready`, `.started`, `.completed`,
`.failed`, `.retry`, `.paused`, `.resumed`, `.cancelled`, `.expired` — every one published
via the real `@aos/event-bus` `IPublisher`, never called directly against a Runtime.

## Persistence

None. `InMemoryScheduleStore` and `InMemoryLockProvider` are the only implementations —
PostgreSQL/Redis-backed stores and locks, and a country-calendar/API-backed
`IHolidayProvider`, are future work behind the same interfaces.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.5-ENTERPRISE-SCHEDULER-REPORT.md` for coverage numbers, known limitations, and
the readiness checklist for Engineering Task 005.6 (Workflow Runtime) — **not implemented
in this package**.
