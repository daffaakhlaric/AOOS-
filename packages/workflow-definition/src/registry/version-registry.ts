import semver from "semver";

/** Version Registry (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "REGISTRY") — tracks every known version per Workflow id, sorted ascending by SemVer. */
export class VersionRegistry {
  private readonly versionsById = new Map<string, string[]>();

  record(id: string, version: string): void {
    const versions = this.versionsById.get(id) ?? [];
    if (versions.includes(version)) {
      return;
    }
    const updated = [...versions, version].sort(semver.compare);
    this.versionsById.set(id, updated);
  }

  remove(id: string, version: string): void {
    const versions = this.versionsById.get(id);
    if (!versions) {
      return;
    }
    this.versionsById.set(
      id,
      versions.filter((v) => v !== version),
    );
  }

  list(id: string): readonly string[] {
    return this.versionsById.get(id) ?? [];
  }

  latest(id: string): string | undefined {
    const versions = this.versionsById.get(id);
    return versions && versions.length > 0 ? versions[versions.length - 1] : undefined;
  }
}
