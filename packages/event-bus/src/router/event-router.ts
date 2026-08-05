import type { BaseEventShape } from "../contracts/base-event.js";
import { extractEventNamespace } from "../contracts/event-namespace.js";

import type { IRouter, RouteCriteria } from "./i-router.js";

const PATTERN_CACHE = new Map<string, RegExp>();

/** Converts a glob-style topic pattern (`*` = one segment, `**` = any depth) into a RegExp, memoized. */
function patternToRegExp(pattern: string): RegExp {
  const cached = PATTERN_CACHE.get(pattern);
  if (cached) {
    return cached;
  }
  const segments = pattern
    .split(".")
    .map((segment) => {
      if (segment === "**") {
        return ".*";
      }
      if (segment === "*") {
        return "[^.]+";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("\\.");
  const regExp = new RegExp(`^${segments}$`);
  PATTERN_CACHE.set(pattern, regExp);
  return regExp;
}

/** Routing (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — Namespace/Topic/Pattern/Tenant/Category/Priority). */
export class EventRouter implements IRouter {
  matches(event: BaseEventShape, criteria: RouteCriteria): boolean {
    if (
      criteria.namespace !== undefined &&
      extractEventNamespace(event.type) !== criteria.namespace
    ) {
      return false;
    }
    if (criteria.topic !== undefined && event.type !== criteria.topic) {
      return false;
    }
    if (criteria.pattern !== undefined && !patternToRegExp(criteria.pattern).test(event.type)) {
      return false;
    }
    if (criteria.tenantId !== undefined && event.tenantId !== criteria.tenantId) {
      return false;
    }
    if (criteria.category !== undefined && event.category !== criteria.category) {
      return false;
    }
    if (criteria.priority !== undefined && event.priority !== criteria.priority) {
      return false;
    }
    return true;
  }
}
