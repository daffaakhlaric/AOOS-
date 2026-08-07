import { describe, expect, it } from "vitest";

import { DuplicateEmbeddingEntryException } from "../../src/errors/duplicate-embedding-entry-exception.js";
import { EmbeddingCheckException } from "../../src/errors/embedding-check-exception.js";
import { EmbeddingConfigurationException } from "../../src/errors/embedding-configuration-exception.js";
import { EmbeddingManagerException } from "../../src/errors/embedding-manager-exception.js";
import { EmbeddingModelException } from "../../src/errors/embedding-model-exception.js";
import { EmbeddingNamespaceException } from "../../src/errors/embedding-namespace-exception.js";
import { EmbeddingNotFoundException } from "../../src/errors/embedding-not-found-exception.js";
import { EmbeddingOperationException } from "../../src/errors/embedding-operation-exception.js";
import { EmbeddingProviderException } from "../../src/errors/embedding-provider-exception.js";
import { EmbeddingSessionException } from "../../src/errors/embedding-session-exception.js";
import { EmbeddingVersionException } from "../../src/errors/embedding-version-exception.js";
import { IllegalEmbeddingTransitionException } from "../../src/errors/illegal-embedding-transition-exception.js";
import { InvalidEmbeddingMetadataException } from "../../src/errors/invalid-embedding-metadata-exception.js";

const classes = [
  EmbeddingNotFoundException,
  DuplicateEmbeddingEntryException,
  IllegalEmbeddingTransitionException,
  InvalidEmbeddingMetadataException,
  EmbeddingCheckException,
  EmbeddingOperationException,
  EmbeddingConfigurationException,
  EmbeddingSessionException,
  EmbeddingProviderException,
  EmbeddingModelException,
  EmbeddingVersionException,
  EmbeddingNamespaceException,
];

describe("error hierarchy", () => {
  it("EmbeddingManagerException is an Error with the message set", () => {
    const error = new EmbeddingManagerException("boom");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("boom");
  });

  it.each(classes)("%s extends EmbeddingManagerException", (ErrorClass) => {
    const error = new ErrorClass("boom");
    expect(error).toBeInstanceOf(EmbeddingManagerException);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("boom");
  });

  it.each(classes)("%s carries an optional cause", (ErrorClass) => {
    const cause = new Error("root cause");
    const error = new ErrorClass("boom", { cause });
    expect(error.cause).toBe(cause);
  });

  it.each(classes)("%s carries an optional context", (ErrorClass) => {
    const error = new ErrorClass("boom", { context: { extra: { key: "value" } } });
    expect(error).toBeInstanceOf(ErrorClass);
  });
});
