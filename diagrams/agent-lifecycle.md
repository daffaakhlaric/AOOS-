# Agent Contract Lifecycle & Invocation Flow

## Lifecycle (PlantUML state diagram)

```plantuml
@startuml
[*] --> draft
draft --> active : passes Simulation Contract gate\n+ manifest validation (VAL-001..012)
draft --> quarantined : fails manifest/contract validation
active --> deprecated : new version published
deprecated --> retired : deprecation window elapses
active --> quarantined : runtime contract violation detected
quarantined --> draft : manually fixed and resubmitted
retired --> [*]
@enduml
```

## Invocation Sequence (Mermaid)

```mermaid
sequenceDiagram
    participant WF as Workflow Runtime
    participant AG as Agent (per Agent Contract)
    participant PL as Planner Contract
    participant TM as Tool Manager (per Tool Contract)
    participant RE as Reflection Contract
    participant EV as Event Bus (per Event Contract)

    WF->>AG: invoke(task) [respects timeout, cost_limit, token_limit]
    AG->>PL: create_plan(task, objective)
    PL-->>AG: plan (bounded by toolset allowlist)
    AG->>TM: invoke_tool(step) [only tools in toolset]
    TM-->>AG: result (schema-validated per Tool Contract)
    AG->>RE: reflect(result)
    RE-->>AG: confidence_score
    alt confidence >= threshold
        AG->>EV: publish(events.publishes[...])
    else confidence < threshold
        AG->>EV: publish(agent.escalated)
    end
```

This flow is a contract-level description of _what must be true at each hop_, not an implementation sequence — actual runtime code is out of scope for this document per the Contract-First mandate.
