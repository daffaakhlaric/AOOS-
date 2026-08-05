# Validation Rules — Consolidated Index (VAL-001 – VAL-216)

Governs: [`docs/003.5-CONTRACT-FIRST-DESIGN.md`](../docs/003.5-CONTRACT-FIRST-DESIGN.md) §24
Total rules: **216** (exceeds the 200-rule minimum). All rules verified present and uniquely numbered across the 18 per-contract files below (`VAL-001` through `VAL-216`, no gaps, no duplicates).

| Range             | Contract   | File                                                     |
| ----------------- | ---------- | -------------------------------------------------------- |
| VAL-001 – VAL-012 | Agent      | [`agent.validation.md`](./agent.validation.md)           |
| VAL-013 – VAL-024 | Tool       | [`tool.validation.md`](./tool.validation.md)             |
| VAL-025 – VAL-036 | Workflow   | [`workflow.validation.md`](./workflow.validation.md)     |
| VAL-037 – VAL-048 | Planner    | [`planner.validation.md`](./planner.validation.md)       |
| VAL-049 – VAL-060 | Reasoner   | [`reasoner.validation.md`](./reasoner.validation.md)     |
| VAL-061 – VAL-072 | Reflection | [`reflection.validation.md`](./reflection.validation.md) |
| VAL-073 – VAL-084 | Memory     | [`memory.validation.md`](./memory.validation.md)         |
| VAL-085 – VAL-096 | Knowledge  | [`knowledge.validation.md`](./knowledge.validation.md)   |
| VAL-097 – VAL-108 | Event      | [`event.validation.md`](./event.validation.md)           |
| VAL-109 – VAL-120 | Queue      | [`queue.validation.md`](./queue.validation.md)           |
| VAL-121 – VAL-132 | Scheduler  | [`scheduler.validation.md`](./scheduler.validation.md)   |
| VAL-133 – VAL-144 | Registry   | [`registry.validation.md`](./registry.validation.md)     |
| VAL-145 – VAL-156 | Model      | [`model.validation.md`](./model.validation.md)           |
| VAL-157 – VAL-168 | Permission | [`permission.validation.md`](./permission.validation.md) |
| VAL-169 – VAL-180 | Analytics  | [`analytics.validation.md`](./analytics.validation.md)   |
| VAL-181 – VAL-192 | Logging    | [`logging.validation.md`](./logging.validation.md)       |
| VAL-193 – VAL-204 | Health     | [`health.validation.md`](./health.validation.md)         |
| VAL-205 – VAL-216 | Simulation | [`simulation.validation.md`](./simulation.validation.md) |

## How to Use This Index

- **CI/Registry enforcement (§25 Acceptance Criteria):** every rule tagged `Blocking` in the per-contract files above MUST be wired as an automated check in the Registry publish pipeline before a Contract instance can transition `state`/`status` to `active`.
- **Review tooling:** rules tagged `Warning` surface for human acknowledgment but do not hard-block publication.
- **Cross-reference discipline:** every rule cites its governing source (a Constitution `RULE-###`, an Architecture `§`-section, or a DDD `BR-###`/section) — do not add a rule without a traceable source, per the Contract Philosophy (§1.5 of the master document).
- **Numbering is permanent:** like Constitution `RULE-###` and DDD `BR-###`, a `VAL-###` id is never reused, even if the rule is later deprecated; deprecated rules are marked `[DEPRECATED]` in place.

## Verification Record

- All 18 `validation/<name>.validation.md` files present.
- All 72 `.json` files under `schemas/` and `examples/` parsed successfully (`JSON.parse` clean) as of the last verification pass in this session.
- Unique `VAL-###` id count confirmed at 216 via automated grep across all 18 files, with no gaps and no duplicate ids.
