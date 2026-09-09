import { describe, expect, it } from "vitest";

import { EncryptionService, EncryptionServiceError } from "./encryption.service.js";

// A fixed, obviously-fake 64-hex-char (32-byte) test key — never a real secret.
const TEST_KEY = "0123456789abcdef".repeat(4);

describe("EncryptionService", () => {
  describe("construction", () => {
    it("constructs successfully with no TOKEN_ENCRYPTION_KEY configured (dev/test default)", () => {
      expect(() => new EncryptionService({ TOKEN_ENCRYPTION_KEY: "" })).not.toThrow();
    });

    it("isConfigured() is false when no key is set", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: "" });
      expect(service.isConfigured()).toBe(false);
    });

    it("constructs successfully with a valid 64-hex-char key", () => {
      expect(() => new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY })).not.toThrow();
    });

    it("isConfigured() is true when a valid key is set", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
      expect(service.isConfigured()).toBe(true);
    });

    it("throws loudly at construction when the key is set but too short", () => {
      expect(() => new EncryptionService({ TOKEN_ENCRYPTION_KEY: "abcd" })).toThrow(
        EncryptionServiceError,
      );
    });

    it("throws loudly at construction when the key is set but not valid hex", () => {
      const notHex = "zz".repeat(32);
      expect(() => new EncryptionService({ TOKEN_ENCRYPTION_KEY: notHex })).toThrow(
        EncryptionServiceError,
      );
    });
  });

  describe("encrypt/decrypt round trip", () => {
    it("decrypts back to the exact original plaintext", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
      const plaintext = "EAAG-a-real-looking-meta-access-token-1234567890";
      const ciphertext = service.encrypt(plaintext);
      expect(service.decrypt(ciphertext)).toBe(plaintext);
    });

    it("round-trips an empty string", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
      expect(service.decrypt(service.encrypt(""))).toBe("");
    });

    it("round-trips unicode content", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
      const plaintext = "token-with-emoji-🔒-and-unicode-テスト";
      expect(service.decrypt(service.encrypt(plaintext))).toBe(plaintext);
    });

    it("produces the 'iv:authTag:encrypted' hex envelope shape", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
      const ciphertext = service.encrypt("some-token");
      const parts = ciphertext.split(":");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(24); // 12 bytes IV -> 24 hex chars
      expect(parts[1]).toHaveLength(32); // 16 bytes auth tag -> 32 hex chars
      expect(parts.every((part) => /^[0-9a-f]+$/.test(part))).toBe(true);
    });

    it("produces a DIFFERENT ciphertext for the same plaintext across calls (random IV)", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
      const plaintext = "same-plaintext-every-time";
      const first = service.encrypt(plaintext);
      const second = service.encrypt(plaintext);
      expect(first).not.toBe(second);
      expect(service.decrypt(first)).toBe(plaintext);
      expect(service.decrypt(second)).toBe(plaintext);
    });
  });

  describe("decrypt failure modes", () => {
    it("throws loudly when the ciphertext's auth tag has been tampered with", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
      const ciphertext = service.encrypt("a-real-token");
      const [iv, authTag, encrypted] = ciphertext.split(":");
      const tamperedAuthTag = (authTag![0] === "0" ? "f" : "0") + authTag!.slice(1);
      const tampered = `${iv}:${tamperedAuthTag}:${encrypted}`;
      expect(() => service.decrypt(tampered)).toThrow(EncryptionServiceError);
    });

    it("throws loudly when the encrypted payload has been tampered with", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
      const ciphertext = service.encrypt("a-real-token");
      const [iv, authTag, encrypted] = ciphertext.split(":");
      const tamperedEncrypted = (encrypted![0] === "0" ? "f" : "0") + encrypted!.slice(1);
      const tampered = `${iv}:${authTag}:${tamperedEncrypted}`;
      expect(() => service.decrypt(tampered)).toThrow(EncryptionServiceError);
    });

    it("throws loudly when decrypting with the wrong key", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
      const otherKey = "fedcba98".repeat(8);
      const otherService = new EncryptionService({ TOKEN_ENCRYPTION_KEY: otherKey });
      const ciphertext = service.encrypt("a-real-token");
      expect(() => otherService.decrypt(ciphertext)).toThrow(EncryptionServiceError);
    });

    it("throws on a malformed envelope (wrong number of segments)", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
      expect(() => service.decrypt("not-a-valid-envelope")).toThrow(EncryptionServiceError);
    });

    it("throws on a malformed envelope (non-hex segment)", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
      expect(() => service.decrypt("zz:zz:zz")).toThrow(EncryptionServiceError);
    });
  });

  describe("no key configured", () => {
    it("encrypt() throws an explicit error naming the missing configuration", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: "" });
      expect(() => service.encrypt("anything")).toThrow(EncryptionServiceError);
    });

    it("decrypt() throws an explicit error naming the missing configuration", () => {
      const service = new EncryptionService({ TOKEN_ENCRYPTION_KEY: "" });
      expect(() => service.decrypt("aa:bb:cc")).toThrow(EncryptionServiceError);
    });
  });
});
