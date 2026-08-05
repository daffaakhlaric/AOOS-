import { z } from "zod";

/**
 * The fields every manifest carries, regardless of Registry kind — matches the shape from
 * the user's revised manifest example (`id`, `version`, `category`, `capabilities`), plus
 * the cross-cutting fields every Registry kind's operations (dependency graph, search,
 * ownership) need. Per-kind manifests (registry/kinds/*.ts) extend this with domain fields
 * (e.g. Agent's `required_tools`/`required_models`/`permissions`/`memory`/`workflows`).
 */
export const baseManifestSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(
      /^[a-z][a-z0-9_.-]*$/,
      "id must be lowercase, alphanumeric, '_', '.', or '-', starting with a letter (e.g. \"content-manager\", \"gpt-5.5\")",
    ),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be a SemVer string (e.g. 1.0.0)"),
  name: z.string().min(1).optional(),
  /** Human-friendly label, distinct from `name` (e.g. `name: "content-manager"`, `displayName: "Content Manager Agent"`) — 005.3A Registry Manifest Standard. */
  displayName: z.string().min(1).optional(),
  /** Long-form description — 005.3A Registry Manifest Standard. */
  description: z.string().min(1).optional(),
  category: z.string().min(1),
  /** Industry Registry id(s) this component targets (e.g. "automotive") — 005.3A Enhancement 4/8. */
  industry: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  owner: z.string().optional(),
  /** Set only for tenant-specific entries (e.g. a per-tenant override) — absent for global/platform entries. */
  tenantId: z.string().optional(),
  /** IDs of other entries within the SAME Registry kind that must load before this one. */
  dependencies: z.array(z.string()).optional(),
  /** `resource.action` strings this component requires — structurally checked by validators/permission-validator.ts. */
  permissions: z.array(z.string()).optional(),
  /** Free-form extension bag — 005.3A Registry Manifest Standard. Not interpreted by the engine. */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type BaseManifest = z.infer<typeof baseManifestSchema>;
