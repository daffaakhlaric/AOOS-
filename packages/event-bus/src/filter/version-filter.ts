import semver from "semver";

import type { BaseEventShape } from "../contracts/base-event.js";

import type { IEventFilter } from "./i-filter.js";

/** Version Filter — accepts only events whose `version` satisfies the given SemVer range. */
export class VersionFilter implements IEventFilter {
  readonly name = "version";

  constructor(private readonly range: string) {}

  accepts(event: BaseEventShape): boolean {
    return semver.valid(event.version) !== null && semver.satisfies(event.version, this.range);
  }
}
