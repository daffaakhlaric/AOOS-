# docker/

Local development infrastructure for AOS — **Phase 1 "Simulation"** per [`docs/004A-COST-SCALING-STRATEGY.md`](../docs/004A-COST-SCALING-STRATEGY.md) §2: everything the Core Runtime will eventually depend on, running as a single `docker compose` stack on one machine. No application containers are defined here yet — only the infrastructure dependencies, since no Runtime/app exists in the Foundation phase.

## Services

| Service       | Image                                  | Purpose                                                                                                                            | Port(s)                              |
| ------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `postgres`    | `postgres:16-alpine`                   | Primary OLTP store (TSR §3.4) — also backs Temporal's persistence                                                                  | `5432`                               |
| `valkey`      | `valkey/valkey:8-alpine`               | Cache / Working Memory store (TSR §3.6)                                                                                            | `6379`                               |
| `nats`        | `nats:2.10-alpine` (JetStream enabled) | Event Bus / job queue substrate (TSR §3.7/§3.8)                                                                                    | `4222` (client), `8222` (monitoring) |
| `temporal`    | `temporalio/auto-setup:1.24`           | Workflow Engine (TSR §3.9), auto-provisions its schema against `postgres`                                                          | `7233`                               |
| `temporal-ui` | `temporalio/ui:2.31.2`                 | Local Temporal Web UI                                                                                                              | `8080`                               |
| `minio`       | `minio/minio:latest`                   | S3-compatible object storage stand-in for R2/S3 in local dev (TSR §3.13)                                                           | `9000` (API), `9001` (console)       |
| `qdrant`      | `qdrant/qdrant:v1.11.0`                | Vector database escape-hatch stand-in (TSR §3.12) — `pgvector` itself lives inside `postgres` once a Runtime enables the extension | `6333` (HTTP), `6334` (gRPC)         |

## Usage

```bash
docker compose -f docker/docker-compose.yml up -d       # start everything
docker compose -f docker/docker-compose.yml config       # validate the compose file
docker compose -f docker/docker-compose.yml ps            # check health status
docker compose -f docker/docker-compose.yml down           # stop (keep volumes)
docker compose -f docker/docker-compose.yml down -v         # stop and wipe all local data
```

Default local credentials (development only — never used beyond a developer's own machine, per `docs/004A-COST-SCALING-STRATEGY.md` §1's Phase 1 scope): `aos` / `aos_dev_password` for Postgres, `aos_minio` / `aos_dev_password` for MinIO.

## Known Limitation (Foundation Phase)

No application container (Core Runtime, Dashboard, etc.) is defined in this compose file — none exists yet. `pgvector` and Qdrant are both listed here (matching TSR §3.12's default + escape-hatch pattern) but neither is populated with any schema/collection until a Runtime exists to create one.
