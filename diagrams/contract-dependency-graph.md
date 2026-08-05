# Contract Dependency Graph

Governs: [`003.5-CONTRACT-FIRST-DESIGN.md`](../docs/003.5-CONTRACT-FIRST-DESIGN.md) §22

## Mermaid

```mermaid
graph TD
    Agent[Agent Contract] --> Planner[Planner Contract]
    Agent --> Reasoner[Reasoner Contract]
    Agent --> Reflection[Reflection Contract]
    Agent --> Memory[Memory Contract]
    Agent --> Knowledge[Knowledge Contract]
    Agent --> Tool[Tool Contract]
    Agent --> Permission[Permission Contract]
    Agent --> Scheduler[Scheduler Contract]
    Agent --> Health[Health Contract]
    Agent --> Logging[Logging Contract]
    Agent --> Event[Event Contract]
    Agent --> Model[Model Contract]

    Workflow[Workflow Contract] --> Agent
    Workflow --> Tool
    Workflow --> Event
    Workflow --> Queue[Queue Contract]
    Workflow --> Scheduler

    Planner --> Model
    Reasoner --> Model
    Reflection --> Model
    Reflection --> Memory

    Tool --> Permission
    Tool --> Health
    Tool --> Logging

    Event --> Queue
    Queue --> Scheduler

    Registry[Registry Contract] --> Agent
    Registry --> Tool
    Registry --> Workflow
    Registry --> Model
    Registry --> Permission
    Registry --> Knowledge
    Registry --> Memory

    Analytics[Analytics Contract] --> Event
    Logging --> Event
    Health --> Event

    Simulation[Simulation Contract] --> Agent
    Simulation --> Workflow
    Simulation --> Tool
    Simulation --> Event

    Permission --> Identity[(Tenant / Identity — DDD §6)]
```

## ASCII (fallback view)

```
                         Registry Contract
                                │
        ┌───────────┬──────────┼───────────┬────────────┐
        ▼           ▼          ▼           ▼            ▼
      Agent ◄──── Workflow   Model     Permission     Knowledge
        │           │          ▲           ▲
        ├─▶ Planner ┤          │           │
        ├─▶ Reasoner┼──────────┘           │
        ├─▶ Reflection                     │
        ├─▶ Memory                         │
        ├─▶ Tool ───────────────────────────┘
        ├─▶ Scheduler ──▶ Queue ──▶ Event
        ├─▶ Health ──▶ Event
        ├─▶ Logging ──▶ Event
        └─▶ Metrics (Analytics Contract) ◄── Event

  Simulation Contract (sandboxed, read-only) ──▶ Agent, Workflow, Tool, Event
```

**Reading order for implementers:** Registry → Permission/Identity → Model → Memory/Knowledge → Tool → Planner/Reasoner/Reflection → Agent → Workflow → Event/Queue/Scheduler → Health/Logging/Analytics → Simulation. This is also the recommended Core Runtime build order referenced in §31 of the DDD document and the TSR roadmap in the master Contract document.
