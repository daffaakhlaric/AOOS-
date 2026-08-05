# scripts/

Repository-level automation. Every script is a thin, auditable wrapper around `pnpm`/`turbo` — no script contains business logic, matching the Foundation phase's scope.

| Script         | Purpose                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `setup.sh`     | One-time/repeatable bootstrap: checks pnpm is installed, runs `pnpm install`, then `pnpm build`.      |
| `clean.sh`     | Removes `dist/`, `coverage/`, `.turbo/`, and `*.tsbuildinfo` across every package.                    |
| `build.sh`     | `pnpm turbo run build` (dependency-ordered).                                                          |
| `lint.sh`      | `pnpm turbo run lint`.                                                                                |
| `format.sh`    | `prettier --write` across the whole repo.                                                             |
| `test.sh`      | `pnpm turbo run test`.                                                                                |
| `typecheck.sh` | `pnpm turbo run typecheck` (no emit).                                                                 |
| `dev.sh`       | Reserved entry point for `pnpm dev` once the first app exists under `apps/` (Engineering Task 005.2). |

Root `package.json` scripts (`pnpm build`, `pnpm lint`, etc.) call Turborepo directly rather than these shell scripts for day-to-day use; these scripts exist for CI and for anyone who prefers an explicit, readable entry point over remembering Turborepo flags.
