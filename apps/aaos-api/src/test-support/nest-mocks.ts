import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Observable } from "rxjs";
import { of, throwError } from "rxjs";

/** A minimal fake `FastifyRequest`, typed loosely enough for the handful of fields this app's guards/interceptors/filter actually read. */
export function buildFakeRequest(
  overrides: Partial<FastifyRequest> & { rawBody?: Buffer } = {},
): FastifyRequest & { rawBody?: Buffer } {
  return {
    method: "GET",
    url: "/test",
    headers: {},
    ...overrides,
  } as FastifyRequest & { rawBody?: Buffer };
}

export interface FakeReply {
  statusCode: number;
  readonly body: unknown[];
  readonly headers: Record<string, string>;
  status(code: number): FakeReply;
  type(contentType: string): FakeReply;
  send(payload?: unknown): FakeReply;
}

export function buildFakeReply(): FakeReply {
  const reply: FakeReply = {
    statusCode: 200,
    body: [],
    headers: {},
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    type(contentType: string) {
      reply.headers["content-type"] = contentType;
      return reply;
    },
    send(payload?: unknown) {
      reply.body.push(payload);
      return reply;
    },
  };
  return reply;
}

export function buildFakeExecutionContext(
  request: FastifyRequest,
  reply: FakeReply | FastifyReply = buildFakeReply() as unknown as FastifyReply,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: <T>() => request as unknown as T,
      getResponse: <T>() => reply as unknown as T,
      getNext: <T>() => undefined as unknown as T,
    }),
    getClass: () => Object,
    getHandler: () => (): void => undefined,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => {
      throw new Error("not implemented");
    },
    switchToWs: () => {
      throw new Error("not implemented");
    },
    getType: () => "http",
  } as unknown as ExecutionContext;
}

export function buildFakeCallHandler(value: unknown = { ok: true }): CallHandler {
  return { handle: (): Observable<unknown> => of(value) };
}

export function buildThrowingCallHandler(error: unknown): CallHandler {
  return { handle: (): Observable<unknown> => throwError(() => error) };
}

export function buildFakeArgumentsHost(
  request: FastifyRequest,
  reply: FakeReply,
): {
  switchToHttp: () => { getRequest: <T>() => T; getResponse: <T>() => T };
} {
  return {
    switchToHttp: () => ({
      getRequest: <T>() => request as unknown as T,
      getResponse: <T>() => reply as unknown as T,
    }),
  };
}
