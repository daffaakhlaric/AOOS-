import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../config/aaos-api.config.js";

const ALGORITHM = "aes-256-gcm";
/** GCM's recommended IV length — 12 bytes (96 bits), NOT the CBC-era 16 bytes. */
const IV_LENGTH_BYTES = 12;
/** GCM's standard auth-tag length — 16 bytes (128 bits). */
const AUTH_TAG_LENGTH_BYTES = 16;
/** 32 raw bytes, hex-encoded = 64 characters. */
const KEY_LENGTH_HEX_CHARS = 64;
const HEX_PATTERN = /^[0-9a-fA-F]+$/;

export class EncryptionServiceError extends Error {}

/**
 * EYVRA-META-OAUTH-WHATSAPP-SETUP (Sprint 1 — Foundation) — real AES-256-GCM encrypt/decrypt for
 * sensitive third-party tokens this app stores (a tenant's OAuth-obtained Meta access token, the
 * global Meta App's client secret). Genuinely new — no encryption of any kind exists anywhere in
 * `apps/aaos-api/src` before this.
 *
 * Ciphertext wire format: `"<iv-hex>:<authTag-hex>:<encrypted-hex>"`, all hex, matching the
 * pasted spec's own real (and correct) approach — 12-byte IV, 16-byte GCM auth tag, random IV
 * per call so the SAME plaintext never produces the same ciphertext twice.
 *
 * Key source: `TOKEN_ENCRYPTION_KEY` (64 hex chars = 32 bytes), read via the real, already-
 * established `AaosApiConfig` typed-config pattern (never `process.env` directly, matching every
 * other cross-cutting service in this app). Deliberately does NOT throw at construction when the
 * var is simply unset (empty string) — that would break app boot/tests on any deployment that
 * hasn't provisioned an encryption key yet, the same graceful-degradation discipline
 * `KIE_AI_API_KEY`/`META_APP_ID`/etc. already establish in this codebase. It DOES throw loudly at
 * construction when the var IS set but malformed (wrong length / not hex) — a real production
 * misconfiguration should fail fast, not silently produce broken ciphertext later. Calling
 * `encrypt`/`decrypt` with no key configured throws an explicit, named error rather than a
 * confusing low-level crypto failure.
 *
 * Never logs a raw plaintext, ciphertext, or the key itself — every thrown error message here is
 * a fixed, static string, deliberately never interpolating the plaintext/ciphertext/key value.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer | undefined;

  constructor(config: Pick<AaosApiConfig, "TOKEN_ENCRYPTION_KEY">) {
    const raw = config.TOKEN_ENCRYPTION_KEY;
    if (raw.length === 0) {
      this.key = undefined;
      return;
    }
    if (raw.length !== KEY_LENGTH_HEX_CHARS || !HEX_PATTERN.test(raw)) {
      throw new EncryptionServiceError(
        `EncryptionService: TOKEN_ENCRYPTION_KEY must be exactly ${KEY_LENGTH_HEX_CHARS} hex characters (32 bytes) — got a value of length ${raw.length}`,
      );
    }
    this.key = Buffer.from(raw, "hex");
  }

  /** Whether a valid key is configured — lets a caller check before attempting encrypt/decrypt (e.g. to report an honest "encryption not configured" state instead of catching a thrown error). */
  isConfigured(): boolean {
    return this.key !== undefined;
  }

  private requireKey(): Buffer {
    if (this.key === undefined) {
      throw new EncryptionServiceError(
        "EncryptionService: TOKEN_ENCRYPTION_KEY is not configured — cannot encrypt or decrypt",
      );
    }
    return this.key;
  }

  /** Encrypts `plaintext`, returning `"<iv-hex>:<authTag-hex>:<encrypted-hex>"`. A fresh random IV is generated on every call — the same plaintext never yields the same ciphertext twice. */
  encrypt(plaintext: string): string {
    const key = this.requireKey();
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  /** Decrypts a value produced by `encrypt`. Throws `EncryptionServiceError` loudly (never returns a fabricated/partial result) on a malformed envelope OR a tampered ciphertext / wrong key (GCM auth-tag mismatch). */
  decrypt(ciphertext: string): string {
    const key = this.requireKey();
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      throw new EncryptionServiceError(
        "EncryptionService.decrypt: malformed ciphertext — expected the 'iv:authTag:encrypted' format",
      );
    }
    const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];
    if (
      ivHex.length !== IV_LENGTH_BYTES * 2 ||
      authTagHex.length !== AUTH_TAG_LENGTH_BYTES * 2 ||
      !HEX_PATTERN.test(ivHex) ||
      !HEX_PATTERN.test(authTagHex) ||
      // `encryptedHex` legitimately CAN be empty (encrypting an empty-string plaintext yields a
      // zero-byte ciphertext) — only reject it when non-empty and not valid hex.
      (encryptedHex.length > 0 && !HEX_PATTERN.test(encryptedHex))
    ) {
      throw new EncryptionServiceError(
        "EncryptionService.decrypt: malformed ciphertext — iv/authTag/encrypted segments are not valid hex of the expected length",
      );
    }
    try {
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
      decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, "hex")),
        decipher.final(),
      ]);
      return decrypted.toString("utf8");
    } catch {
      // Deliberately never interpolates the underlying Node crypto error (it can echo back raw
      // buffer bytes in some engines) — a fixed, static message is enough to diagnose "tampered
      // ciphertext or wrong key" without ever risking a secret fragment reaching a log line.
      throw new EncryptionServiceError(
        "EncryptionService.decrypt: authentication failed — ciphertext was tampered with or the wrong key was used",
      );
    }
  }
}
