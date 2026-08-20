import multipart from "@fastify/multipart";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module.js";
import type { AaosApiConfig } from "./config/aaos-api.config.js";

/** Spec Part 4's "max 10MB/foto" — `ListingsService.addPhoto` re-validates this too (Busboy's limit alone would produce an opaque stream-abort, not the friendly `ValidationError` the Listing Manager UI expects), but capping it here as well means a request can never even buffer more than this into memory. */
const MAX_LISTING_PHOTO_BYTES = 10 * 1024 * 1024;

/**
 * Shared composition entry point used by both `main.ts` (real process bootstrap) and the e2e
 * test bootstrap helper (`test/helpers/bootstrap.ts`) — keeps body-parsing/module wiring
 * identical between "the real app" and "the app under test".
 *
 * `WebhookSignatureGuard` needs the exact bytes Meta signed for HMAC verification — Fastify's
 * default JSON body parser only exposes the already-parsed object, not the original bytes.
 * Rather than hand-rolling a custom `addContentTypeParser` (which would need to fight
 * `@nestjs/platform-fastify`'s own default JSON parser registration — verified empirically: a
 * manual `addContentTypeParser("application/json", ...)` call collided with the framework's own
 * parser and threw "Content type parser already present" at bootstrap, regardless of call
 * order), this uses `@nestjs/platform-fastify`'s own OFFICIALLY SUPPORTED `rawBody: true`
 * application option — `NestFactory.create(AppModule, adapter, { rawBody: true })` — which makes
 * `FastifyAdapter` attach the exact raw bytes to `request.rawBody` for every JSON/urlencoded
 * request, without any extra dependency beyond what the spec's `package.json` already lists.
 */
export async function createApp(config: AaosApiConfig): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter();

  // `abortOnError: false` — Nest's default (`true`) calls `process.abort()`/`process.exit()`
  // internally on a bootstrap failure, bypassing normal error propagation. `main.ts`'s own
  // `bootstrap().catch(...)` already gives this app a proper structured-log-then-`exitCode=1`
  // failure path, so Nest's internal abort is strictly worse there too — and inside a vitest
  // worker (the e2e test bootstrap helper also calls this function), `process.abort()` triggers a
  // native process crash instead of a catchable rejection, taking the whole test file down with
  // an opaque native stack trace. `abortOnError: false` makes any real init failure surface as a
  // normal thrown/rejected error in both places.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(config), adapter, {
    logger: false,
    rawBody: true,
    abortOnError: false,
  });

  // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 — the FIRST real multipart registration in this
  // app (`modules/assets/assets.controller.ts`'s docstring explicitly deferred this: "this app runs
  // on @nestjs/platform-fastify with no multipart parser registered"). `POST
  // /api/v1/listings/:id/photos` (Listing Manager's real drag&drop upload) is the genuine new
  // requirement that finally justifies it — `@fastify/multipart` registered globally, scoped down
  // per-request via `ListingsController`'s own `request.file()` call, not a bespoke body parser.
  await app
    .getHttpAdapter()
    .getInstance()
    .register(multipart, {
      limits: { fileSize: MAX_LISTING_PHOTO_BYTES, files: 1 },
    });

  await app.init();
  // Fastify's own plugin/hook/route registration is asynchronous — `app.init()` resolving does
  // not guarantee Fastify has finished booting. `.ready()` waits for that explicitly; skipping it
  // was observed to occasionally let a request race ahead of full route-context initialization
  // (Fastify's internal `preParsing` hook array reads as `undefined` for such a request).
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
