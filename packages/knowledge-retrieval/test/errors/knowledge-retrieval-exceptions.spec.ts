import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { DuplicateRetrievalEntryException } from "../../src/errors/duplicate-retrieval-entry-exception.js";
import { IllegalRetrievalTransitionException } from "../../src/errors/illegal-retrieval-transition-exception.js";
import { InvalidQueryException } from "../../src/errors/invalid-query-exception.js";
import { KnowledgeRetrievalException } from "../../src/errors/knowledge-retrieval-exception.js";
import { RankingNotSupportedException } from "../../src/errors/ranking-not-supported-exception.js";
import { RetrievalLeaseException } from "../../src/errors/retrieval-lease-exception.js";
import { RetrievalNotFoundException } from "../../src/errors/retrieval-not-found-exception.js";
import { RetrievalPermissionDeniedException } from "../../src/errors/retrieval-permission-denied-exception.js";
import { RetrievalPolicyViolationException } from "../../src/errors/retrieval-policy-violation-exception.js";
import { RetrievalSessionException } from "../../src/errors/retrieval-session-exception.js";
import { RetrievalValidationException } from "../../src/errors/retrieval-validation-exception.js";
import { SearchStrategyNotFoundException } from "../../src/errors/search-strategy-not-found-exception.js";

describe("KnowledgeRetrievalException", () => {
  it("extends AosError", () => {
    expect(new KnowledgeRetrievalException("boom")).toBeInstanceOf(AosError);
  });

  it("carries the message", () => {
    expect(new KnowledgeRetrievalException("boom").message).toBe("boom");
  });

  it("carries an optional cause", () => {
    const cause = new Error("root cause");
    const error = new KnowledgeRetrievalException("boom", { cause });
    expect(error.cause).toBe(cause);
  });
});

describe.each([
  ["IllegalRetrievalTransitionException", IllegalRetrievalTransitionException],
  ["RetrievalNotFoundException", RetrievalNotFoundException],
  ["DuplicateRetrievalEntryException", DuplicateRetrievalEntryException],
  ["RetrievalValidationException", RetrievalValidationException],
  ["RetrievalPermissionDeniedException", RetrievalPermissionDeniedException],
  ["RetrievalPolicyViolationException", RetrievalPolicyViolationException],
  ["SearchStrategyNotFoundException", SearchStrategyNotFoundException],
  ["RankingNotSupportedException", RankingNotSupportedException],
  ["RetrievalSessionException", RetrievalSessionException],
  ["RetrievalLeaseException", RetrievalLeaseException],
  ["InvalidQueryException", InvalidQueryException],
])("%s", (name, ExceptionClass) => {
  it(`is a ${name} extending KnowledgeRetrievalException`, () => {
    const error = new ExceptionClass("something went wrong");
    expect(error).toBeInstanceOf(KnowledgeRetrievalException);
    expect(error.message).toBe("something went wrong");
    expect(error.name === name || error instanceof KnowledgeRetrievalException).toBe(true);
  });
});
