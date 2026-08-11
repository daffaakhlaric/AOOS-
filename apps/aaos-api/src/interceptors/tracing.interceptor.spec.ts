import { describe, expect, it } from "vitest";

import {
  buildFakeCallHandler,
  buildFakeExecutionContext,
  buildFakeRequest,
  buildThrowingCallHandler,
} from "../test-support/nest-mocks.js";

import { TracingInterceptor } from "./tracing.interceptor.js";

describe("TracingInterceptor", () => {
  it("passes through the handler's emitted value on success", async () => {
    const interceptor = new TracingInterceptor();
    const request = buildFakeRequest({ method: "GET", url: "/health" });
    const context = buildFakeExecutionContext(request);

    const result$ = interceptor.intercept(context, buildFakeCallHandler({ status: "ok" }));
    const value = await new Promise((resolve) => {
      result$.subscribe({ next: resolve });
    });

    expect(value).toEqual({ status: "ok" });
  });

  it("re-throws an Error raised downstream after recording it on the span", async () => {
    const interceptor = new TracingInterceptor();
    const request = buildFakeRequest({ method: "POST", url: "/api/v1/verdicts" });
    const context = buildFakeExecutionContext(request);

    const result$ = interceptor.intercept(
      context,
      buildThrowingCallHandler(new Error("span failure")),
    );
    await expect(
      new Promise((_resolve, reject) => {
        result$.subscribe({ error: reject });
      }),
    ).rejects.toThrow("span failure");
  });

  it("re-throws a non-Error value raised downstream without recording an exception", async () => {
    const interceptor = new TracingInterceptor();
    const request = buildFakeRequest();
    const context = buildFakeExecutionContext(request);

    const result$ = interceptor.intercept(context, buildThrowingCallHandler("not-an-error"));
    await expect(
      new Promise((_resolve, reject) => {
        result$.subscribe({ error: reject });
      }),
    ).rejects.toBe("not-an-error");
  });
});
