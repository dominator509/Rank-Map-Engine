import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAuth, requireRole } from "./auth.js";

vi.mock("@workspace/db", () => ({
  apiKeysTable: {
    id: "apiKeys.id",
    keyPrefix: "apiKeys.keyPrefix",
    keyHash: "apiKeys.keyHash",
    scopes: "apiKeys.scopes",
    expiresAt: "apiKeys.expiresAt",
    revokedAt: "apiKeys.revokedAt",
  },
  usersTable: {
    id: "users.id",
    tenantId: "users.tenantId",
    email: "users.email",
    fullName: "users.fullName",
    role: "users.role",
  },
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(async () => []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  },
}));

type MockResponse = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

function makeRequest(method: string, user?: NonNullable<Request["session"]["user"]>): Request {
  return {
    method,
    session: user ? { user } : {},
    get: vi.fn(() => undefined),
  } as unknown as Request;
}

function makeResponse(): MockResponse {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as MockResponse;
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

const adminUser: NonNullable<Request["session"]["user"]> = {
  id: 1,
  tenantId: 10,
  email: "admin@example.test",
  fullName: "Admin User",
  role: "agency_admin",
};

const viewerUser: NonNullable<Request["session"]["user"]> = {
  id: 2,
  tenantId: 10,
  email: "viewer@example.test",
  fullName: "Viewer User",
  role: "client_viewer",
};

describe("auth middleware security boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies unauthenticated requests before route handlers can run", async () => {
    const req = makeRequest("GET");
    const res = makeResponse();
    const next = makeNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("denies authenticated users that lack the required role", async () => {
    const req = makeRequest("DELETE", viewerUser);
    const res = makeResponse();
    const next = makeNext();

    await requireRole(["agency_admin", "super_admin"])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  it("allows authenticated users with an accepted role", async () => {
    const req = makeRequest("DELETE", adminUser);
    const res = makeResponse();
    const next = makeNext();

    await requireRole(["agency_admin", "super_admin"])(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("fails closed when an API-key-authenticated session has malformed scopes", async () => {
    const req = makeRequest("GET", { ...adminUser, apiKeyScopes: ["admin"] });
    const res = makeResponse();
    const next = makeNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "API key scope does not allow this request",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("prevents read-only API-key sessions from mutating state", async () => {
    const req = makeRequest("POST", { ...adminUser, apiKeyScopes: ["read"] });
    const res = makeResponse();
    const next = makeNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "API key scope does not allow this request",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("allows read-only API-key sessions to access read endpoints", async () => {
    const req = makeRequest("GET", { ...adminUser, apiKeyScopes: ["read"] });
    const res = makeResponse();
    const next = makeNext();

    await requireAuth(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });
});
