import { ConflictError, NotFoundError, ValidationError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";

import { SalesHumanRepository } from "./infrastructure/sales-human.repository.js";
import type {
  SupabaseAuthAdminLike,
  SupabaseAuthUserLike,
} from "./infrastructure/supabase-auth-admin.js";
import { SalesHumansService } from "./sales-humans.service.js";

function buildFakeAuthAdmin(): SupabaseAuthAdminLike & {
  users: Map<string, SupabaseAuthUserLike>;
} {
  const users = new Map<string, SupabaseAuthUserLike>();
  let nextId = 1;
  return {
    users,
    auth: {
      admin: {
        createUser: vi.fn(async (input) => {
          if ([...users.values()].some((u) => u.email === input.email)) {
            return {
              data: null,
              error: { message: `A user with this email address has already been registered` },
            };
          }
          const user: SupabaseAuthUserLike = {
            id: `auth-${String(nextId++)}`,
            email: input.email,
            user_metadata: input.user_metadata,
            last_sign_in_at: null,
          };
          users.set(user.id, user);
          return { data: { user }, error: null };
        }),
        updateUserById: vi.fn(async (userId, input) => {
          const existing = users.get(userId);
          if (existing === undefined) {
            return { data: null, error: { message: "user not found" } };
          }
          const updated: SupabaseAuthUserLike = {
            ...existing,
            ...(input.email !== undefined ? { email: input.email } : {}),
            ...(input.user_metadata !== undefined ? { user_metadata: input.user_metadata } : {}),
          };
          users.set(userId, updated);
          return { data: { user: updated }, error: null };
        }),
        getUserById: vi.fn(async (userId) => {
          const existing = users.get(userId);
          return existing === undefined
            ? { data: null, error: { message: "not found" } }
            : { data: { user: existing }, error: null };
        }),
        listUsers: vi.fn(async () => ({ data: { users: [...users.values()] }, error: null })),
        generateLink: vi.fn(async (input) => ({
          data: { properties: { action_link: `https://example.test/verify?email=${input.email}` } },
          error: null,
        })),
      },
    },
  };
}

function buildService() {
  const client = createFakeSupabaseClient();
  const repository = new SalesHumanRepository(client);
  const authAdmin = buildFakeAuthAdmin();
  const service = new SalesHumansService(repository, authAdmin, buildTestConfig());
  return { service, repository, authAdmin, client };
}

describe("SalesHumansService", () => {
  it("create() provisions a Supabase Auth user, inserts the row, and patches salesHumanId onto the user metadata", async () => {
    const { service, authAdmin } = buildService();
    const dto = await service.create({
      name: "Ahmad Fauzi",
      email: "ahmad.fauzi@mobix.id",
      password: "password123",
      branchId: "BINTARO",
      phone: "+62812000001",
    });
    expect(dto.name).toBe("Ahmad Fauzi");
    expect(dto.email).toBe("ahmad.fauzi@mobix.id");
    expect(dto.phone).toBe("+62812000001");
    expect(dto.branchId).toBe("BINTARO");
    expect(dto.status).toBe("ON");

    const authUser = [...authAdmin.users.values()][0];
    expect(authUser?.user_metadata?.["salesHumanId"]).toBe(dto.id);
    expect(authUser?.user_metadata?.["branchId"]).toBe("BINTARO");
  });

  it("create() throws ValidationError for an unknown branchId", async () => {
    const { service } = buildService();
    await expect(
      service.create({
        name: "X",
        email: "x@mobix.id",
        password: "password123",
        branchId: "NOT_A_BRANCH",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("create() throws ConflictError for a duplicate email", async () => {
    const { service } = buildService();
    await service.create({
      name: "A",
      email: "dup@mobix.id",
      password: "password123",
      branchId: "BINTARO",
    });
    await expect(
      service.create({
        name: "B",
        email: "dup@mobix.id",
        password: "password123",
        branchId: "BINTARO",
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("list() joins sales_humans rows with their Supabase Auth email", async () => {
    const { service } = buildService();
    await service.create({
      name: "Ahmad",
      email: "ahmad@mobix.id",
      password: "password123",
      branchId: "BINTARO",
    });
    const list = await service.list("BINTARO");
    expect(list).toHaveLength(1);
    expect(list[0]?.email).toBe("ahmad@mobix.id");
  });

  it("update() sets status = OFF for Nonaktif without touching Supabase Auth", async () => {
    const { service, authAdmin } = buildService();
    const created = await service.create({
      name: "Ahmad",
      email: "ahmad@mobix.id",
      password: "password123",
      branchId: "BINTARO",
    });
    const updateSpy = authAdmin.auth.admin.updateUserById;
    updateSpy.mockClear();
    const updated = await service.update(created.id, { status: "OFF" });
    expect(updated.status).toBe("OFF");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("update() with a new email/password calls supabase.auth.admin.updateUserById", async () => {
    const { service, authAdmin } = buildService();
    const created = await service.create({
      name: "Ahmad",
      email: "ahmad@mobix.id",
      password: "password123",
      branchId: "BINTARO",
    });
    const updated = await service.update(created.id, { email: "new@mobix.id" });
    expect(updated.email).toBe("new@mobix.id");
    expect(authAdmin.auth.admin.updateUserById).toHaveBeenCalled();
  });

  it("update() throws NotFoundError for a missing id", async () => {
    const { service } = buildService();
    await expect(service.update("missing", { status: "OFF" })).rejects.toThrow(NotFoundError);
  });

  it("resetPassword() calls supabase.auth.admin.updateUserById with the new password", async () => {
    const { service, authAdmin } = buildService();
    const created = await service.create({
      name: "Ahmad",
      email: "ahmad@mobix.id",
      password: "password123",
      branchId: "BINTARO",
    });
    await service.resetPassword(created.id, "newpassword123");
    expect(authAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ password: "newpassword123" }),
    );
  });

  it("resetPassword() throws NotFoundError for a missing id", async () => {
    const { service } = buildService();
    await expect(service.resetPassword("missing", "newpassword123")).rejects.toThrow(NotFoundError);
  });
});
