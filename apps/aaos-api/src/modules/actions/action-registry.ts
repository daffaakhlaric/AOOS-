import type { ActionType, EntityType } from "./action.types.js";

export type RecommendationRoute =
  | { readonly kind: "META_ACTION"; readonly actionType: ActionType }
  | { readonly kind: "WORKFLOW"; readonly workflow: "REQUEST_KAI_REFRESH" | "CREATE_CAMPAIGN_PLAN" }
  | { readonly kind: "NO_EXECUTION" }
  | { readonly kind: "UNSUPPORTED"; readonly reason: string };

/** Routing is not authorization. A supported action still requires policy and readiness. */
export function routeRecommendation(decision: string, entity: EntityType): RecommendationRoute {
  switch (decision) {
    case "HOLD":
    case "MONITOR":
    case "NO_ACTION":
    case "KEEP":
      return { kind: "NO_EXECUTION" };
    case "SCALE":
      return entity === "CAMPAIGN" || entity === "ADSET"
        ? { kind: "META_ACTION", actionType: "UPDATE_BUDGET" }
        : { kind: "UNSUPPORTED", reason: "BUDGET_ENTITY_REQUIRED" };
    case "PAUSE":
      return {
        kind: "META_ACTION",
        actionType:
          entity === "CAMPAIGN"
            ? "PAUSE_CAMPAIGN"
            : entity === "ADSET"
              ? "PAUSE_ADSET"
              : entity === "AD"
                ? "PAUSE_AD"
                : "PAUSE_CREATIVE",
      };
    case "REFRESH_CREATIVE":
    case "REQUEST_KAI_REFRESH":
      return { kind: "WORKFLOW", workflow: "REQUEST_KAI_REFRESH" };
    case "CREATE_NEW_CAMPAIGN":
      return { kind: "WORKFLOW", workflow: "CREATE_CAMPAIGN_PLAN" };
    default:
      return { kind: "UNSUPPORTED", reason: "RECOMMENDATION_NOT_MAPPED" };
  }
}
