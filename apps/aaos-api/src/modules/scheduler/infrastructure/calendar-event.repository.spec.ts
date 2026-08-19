import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  CalendarEventRepository,
  CalendarEventRepositoryError,
  type CreateCalendarEventInput,
} from "./calendar-event.repository.js";

const BASE_INPUT: CreateCalendarEventInput = {
  id: "11111111-1111-1111-1111-111111111111",
  tenantId: "dss-motor",
  eventType: "SCRAPER_RUN",
  title: "Scrape Foto Mobix",
  scheduledAt: "2026-08-19T06:00:00.000Z",
  recurrence: "ONCE",
};

describe("CalendarEventRepository", () => {
  it("create persists a PENDING row with defaults", async () => {
    const repo = new CalendarEventRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);

    expect(created.id).toBe(BASE_INPUT.id);
    expect(created.status).toBe("PENDING");
    expect(created.timezone).toBe("Asia/Jakarta");
    expect(created.createdBy).toBe("system");
  });

  it("create honors explicit recurrence/metadata/target fields", async () => {
    const repo = new CalendarEventRepository(createFakeSupabaseClient());
    const created = await repo.create({
      ...BASE_INPUT,
      recurrence: "WEEKLY",
      recurrenceDays: [1, 4],
      recurrenceTime: "08:00",
      metadata: { branch: "BINTARO" },
      targetId: "t1",
      targetName: "Target Satu",
      createdBy: "manager",
    });

    expect(created.recurrenceDays).toEqual([1, 4]);
    expect(created.recurrenceTime).toBe("08:00");
    expect(created.metadata).toEqual({ branch: "BINTARO" });
    expect(created.targetId).toBe("t1");
    expect(created.targetName).toBe("Target Satu");
    expect(created.createdBy).toBe("manager");
  });

  it("findById returns undefined for an unknown id", async () => {
    const repo = new CalendarEventRepository(createFakeSupabaseClient());
    expect(await repo.findById("nope")).toBeUndefined();
  });

  it("findById returns the stored row", async () => {
    const repo = new CalendarEventRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    const found = await repo.findById(BASE_INPUT.id);
    expect(found?.title).toBe("Scrape Foto Mobix");
  });

  it("listByRange filters by tenant and scheduled_at bounds, earliest first", async () => {
    const repo = new CalendarEventRepository(createFakeSupabaseClient());
    await repo.create({ ...BASE_INPUT, id: "a", scheduledAt: "2026-08-20T06:00:00.000Z" });
    await repo.create({ ...BASE_INPUT, id: "b", scheduledAt: "2026-08-19T06:00:00.000Z" });
    await repo.create({ ...BASE_INPUT, id: "c", scheduledAt: "2026-09-01T06:00:00.000Z" });
    await repo.create({
      ...BASE_INPUT,
      id: "d",
      tenantId: "someone-else",
      scheduledAt: "2026-08-19T07:00:00.000Z",
    });

    const listed = await repo.listByRange(
      "dss-motor",
      "2026-08-18T00:00:00.000Z",
      "2026-08-25T23:59:59.000Z",
    );
    expect(listed.map((event) => event.id)).toEqual(["b", "a"]);
  });

  it("listDuePending only returns PENDING rows within the window", async () => {
    const repo = new CalendarEventRepository(createFakeSupabaseClient());
    await repo.create({ ...BASE_INPUT, id: "due", scheduledAt: "2026-08-19T06:00:00.000Z" });
    const other = await repo.create({
      ...BASE_INPUT,
      id: "done-already",
      scheduledAt: "2026-08-19T06:00:00.000Z",
    });
    await repo.markDone(other.id, "2026-08-19T06:01:00.000Z", 1000, { summary: "ok" });

    const due = await repo.listDuePending(
      "dss-motor",
      "2026-08-19T05:59:00.000Z",
      "2026-08-19T06:00:00.000Z",
    );
    expect(due.map((event) => event.id)).toEqual(["due"]);
  });

  it("markRunning/markDone/markFailed/markSkipped update status and fields", async () => {
    const repo = new CalendarEventRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);

    await repo.markRunning(BASE_INPUT.id, "2026-08-19T06:00:01.000Z");
    expect((await repo.findById(BASE_INPUT.id))?.status).toBe("RUNNING");

    await repo.markDone(BASE_INPUT.id, "2026-08-19T06:01:00.000Z", 59000, {
      summary: "12 unit · 40 foto",
    });
    const done = await repo.findById(BASE_INPUT.id);
    expect(done?.status).toBe("DONE");
    expect(done?.durationMs).toBe(59000);
    expect(done?.result).toEqual({ summary: "12 unit · 40 foto" });

    await repo.create({ ...BASE_INPUT, id: "fail-me" });
    await repo.markFailed("fail-me", "2026-08-19T06:01:00.000Z", 500, "boom");
    const failed = await repo.findById("fail-me");
    expect(failed?.status).toBe("FAILED");
    expect(failed?.errorMessage).toBe("boom");

    await repo.create({ ...BASE_INPUT, id: "skip-me" });
    await repo.markSkipped("skip-me");
    expect((await repo.findById("skip-me"))?.status).toBe("SKIPPED");
  });

  it("update patches only the supplied fields", async () => {
    const repo = new CalendarEventRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    await repo.update(BASE_INPUT.id, { title: "Judul Baru", recurrenceDays: [2, 3] });
    const updated = await repo.findById(BASE_INPUT.id);
    expect(updated?.title).toBe("Judul Baru");
    expect(updated?.recurrenceDays).toEqual([2, 3]);
  });

  it("delete removes the row", async () => {
    const repo = new CalendarEventRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    await repo.delete(BASE_INPUT.id);
    expect(await repo.findById(BASE_INPUT.id)).toBeUndefined();
  });

  it("throws CalendarEventRepositoryError on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CalendarEventRepository(client);
    client.forceErrorOnce("calendar_events", "db down");
    await expect(repo.create(BASE_INPUT)).rejects.toThrow(CalendarEventRepositoryError);
  });
});
