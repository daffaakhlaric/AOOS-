/**
 * REAL Meta `GET /search?type=adinterest` rows, captured verbatim from live Graph API calls on
 * 2026-08-18 for the five curated DSS-Motor-relevant search terms. Used as MSW fixtures so no test
 * in this repository ever makes a live Meta call, while still exercising the exact shape the real
 * API returns (including `description: null` vs `description: ""`, and the taxonomy `path`).
 *
 * Do not "tidy" these values — every id and audience-size bound here is real Meta output.
 */
export const REAL_AD_INTEREST_ROWS = {
  automotive: {
    id: "6003304550260",
    name: "Automotive industry (industry)",
    audience_size_lower_bound: 386766403,
    audience_size_upper_bound: 454837290,
    path: ["Interests", "Additional interests", "Automotive industry (industry)"],
    description: null,
    topic: "Hobbies and activities",
  },
  usedCar: {
    id: "6003257869482",
    name: "Used car (vehicle)",
    audience_size_lower_bound: 61362891,
    audience_size_upper_bound: 72162760,
    path: ["Interests", "Additional interests", "Used car (vehicle)"],
    description: null,
    topic: "Business and industry",
  },
  carFinance: {
    id: "6003739713691",
    name: "car finance (credit and lending)",
    audience_size_lower_bound: 8039557,
    audience_size_upper_bound: 9454520,
    path: ["Interests", "Additional interests", "car finance (credit and lending)"],
    description: null,
    topic: "Business and industry",
  },
  vehicles: {
    id: "6003133486214",
    name: "Vehicles (transportation)",
    audience_size_lower_bound: 847249855,
    audience_size_upper_bound: 996365830,
    path: ["Interests", "Vehicles (transportation)"],
    description: "",
    topic: "Technology",
  },
  family: {
    id: "6003476182657",
    name: "Family (social concept)",
    audience_size_lower_bound: 1029906930,
    audience_size_upper_bound: 1211170550,
    path: ["Interests", "Family (social concept)"],
    description: "",
    topic: "Family and relationships",
  },
} as const;
