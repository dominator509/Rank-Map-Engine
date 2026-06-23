import express, { type Router } from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

type QueueState = {
  select: unknown[][];
  insert: unknown[][];
  update: unknown[][];
};

function tableMock() {
  return new Proxy(
    {},
    {
      get: (_target, prop) => String(prop),
    },
  );
}

function createDbMock(state: QueueState) {
  const select = () => {
    const rows = state.select.shift() ?? [];
    const promise = Promise.resolve(rows);
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: () => promise,
      then: (...args: Parameters<typeof promise.then>) => promise.then(...args),
      catch: (...args: Parameters<typeof promise.catch>) => promise.catch(...args),
    };
    return chain;
  };

  const insert = () => ({
    values: () => {
      const rows = state.insert.shift() ?? [];
      return {
        returning: async () => rows,
        then: (...args: Parameters<Promise<void>["then"]>) => Promise.resolve().then(...args),
      };
    },
  });

  const update = () => ({
    set: () => ({
      where: () => {
        const rows = state.update.shift() ?? [];
        return {
          returning: async () => rows,
          then: (...args: Parameters<Promise<void>["then"]>) => Promise.resolve().then(...args),
        };
      },
    }),
  });

  const del = () => ({
    where: () => Promise.resolve(),
  });

  return { db: { select, insert, update, delete: del } };
}

async function bootRoute(
  routeModule: string,
  state: QueueState,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  vi.resetModules();

  const dbMock = createDbMock(state);
  const usersTable = tableMock();
  const tenantsTable = tableMock();
  const userInvitationsTable = tableMock();
  const clientsTable = tableMock();
  const projectsTable = tableMock();
  const projectScoreSettingsTable = tableMock();
  const keywordsTable = tableMock();
  const keywordClustersTable = tableMock();
  const contentBriefsTable = tableMock();

  vi.doMock("@workspace/db", () => ({
    ...dbMock,
    usersTable,
    tenantsTable,
    userInvitationsTable,
    clientsTable,
    projectsTable,
    projectScoreSettingsTable,
    keywordsTable,
    keywordClustersTable,
    contentBriefsTable,
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: (...args: unknown[]) => args,
    and: (...args: unknown[]) => args,
  }));

  vi.doMock("../middlewares/auth.js", () => ({
    requireAuth: (req: any, _res: any, next: () => void) => {
      req.session = {
        user: {
          id: 1,
          tenantId: 1,
          email: "admin@example.com",
          role: "agency_admin",
          fullName: "Admin",
        },
      };
      next();
    },
    requireRole: () => (_req: any, _res: any, next: () => void) => next(),
  }));

  vi.doMock("../lib/audit.js", () => ({
    audit: async () => undefined,
  }));

  vi.doMock("../lib/ai.js", () => ({
    enqueueAiTask: async () => 1234,
  }));

  vi.doMock("../lib/ai-provider.js", () => ({
    generateBriefWithAI: async () => ({
      sections: [{ heading: "Intro", notes: "Mock notes" }],
      targetWordCount: 900,
      targetKeywords: ["k1", "k2"],
    }),
  }));

  vi.doMock("bcryptjs", () => ({
    default: { hash: async () => "hashed" },
  }));

  const imported = await import(routeModule);
  const router = imported.default as Router;
  const app = express();
  app.use(express.json());
  app.use(router);

  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(0, () => resolve(listener));
    listener.on("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No TCP address");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("whitebox phase 3c - mocked route branch expansion", () => {
  it("covers team route validation and success branches", async () => {
    const state: QueueState = {
      select: [
        [],
        [{ seatsUsed: 1, seatsMax: 3 }],
        [],
        [
          {
            id: 99,
            email: "inv@example.com",
            role: "agency_user",
            token: "tok",
            expiresAt: new Date(),
          },
        ],
      ],
      insert: [
        [
          {
            id: 99,
            email: "inv@example.com",
            role: "agency_user",
            token: "tok",
            expiresAt: new Date(),
          },
        ],
      ],
      update: [],
    };
    const { baseUrl, close } = await bootRoute("./team.ts", state);
    try {
      expect(
        (
          await fetch(`${baseUrl}/team/invite`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "bad\nemail" }),
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await fetch(`${baseUrl}/team/invite`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "ok@example.com", role: "bad-role" }),
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await fetch(`${baseUrl}/team/invite`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "ok@example.com", role: "agency_user" }),
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/team/invitations/accept`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: "tok", fullName: "User", password: "short" }),
          })
        ).status,
      ).toBe(400);
    } finally {
      await close();
    }
  });

  it("covers tenant route white-label guard branches", async () => {
    const state: QueueState = {
      select: [],
      insert: [],
      update: [[{ id: 1, name: "Updated", whiteLabelConfig: { brand: { primary: "#000" } } }]],
    };
    const { baseUrl, close } = await bootRoute("./tenant.ts", state);
    try {
      expect(
        (
          await fetch(`${baseUrl}/tenant`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: 7 }),
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await fetch(`${baseUrl}/tenant`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ whiteLabelConfig: { huge: "x".repeat(10001) } }),
          })
        ).status,
      ).toBe(400);
      let nested: Record<string, unknown> = { x: true };
      for (let i = 0; i < 21; i += 1) nested = { next: nested };
      expect(
        (
          await fetch(`${baseUrl}/tenant`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ whiteLabelConfig: nested }),
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await fetch(`${baseUrl}/tenant`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: "Updated",
              whiteLabelConfig: { brand: { primary: "#000" } },
            }),
          })
        ).status,
      ).toBe(200);
    } finally {
      await close();
    }
  });

  it("covers projects route invalid-id and success update branches", async () => {
    const state: QueueState = {
      select: [[{ id: 1 }]],
      insert: [[{ id: 44, clientId: 1, tenantId: 1, name: "P" }]],
      update: [[{ id: 44, clientId: 1, tenantId: 1, name: "P2" }]],
    };
    const { baseUrl, close } = await bootRoute("./projects.ts", state);
    try {
      expect((await fetch(`${baseUrl}/projects/not-a-number`)).status).toBe(400);
      expect(
        (
          await fetch(`${baseUrl}/projects`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Missing" }),
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await fetch(`${baseUrl}/projects`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              clientId: 1,
              name: "P",
              targetDomain: "p.example",
              locale: "en-US",
            }),
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/projects/44`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "P2" }),
          })
        ).status,
      ).toBe(200);
    } finally {
      await close();
    }
  });

  it("covers keywords route invalid cluster and update branches", async () => {
    const state: QueueState = {
      select: [
        [
          {
            id: 1,
            projectId: 2,
            tenantId: 1,
            searchVolume: 10,
            cpc: "1.1",
            kd: 20,
            intent: "informational",
            clusterId: null,
            isActive: true,
          },
        ],
        [],
        [
          {
            volumeWeight: "0.4",
            kdWeight: "0.3",
            intentWeight: "0.2",
            cpcWeight: "0.1",
            freshnessWeight: "0",
          },
        ],
      ],
      insert: [],
      update: [[{ id: 1 }]],
    };
    const { baseUrl, close } = await bootRoute("./keywords.ts", state);
    try {
      expect((await fetch(`${baseUrl}/projects/nope/keywords`)).status).toBe(400);
      expect(
        (
          await fetch(`${baseUrl}/projects/2/keywords/1`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ clusterId: 77 }),
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await fetch(`${baseUrl}/projects/2/keywords/1`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ isActive: false }),
          })
        ).status,
      ).toBe(200);
    } finally {
      await close();
    }
  });

  it("covers briefs route generate and approve branches", async () => {
    const state: QueueState = {
      select: [[{ id: 1, title: "B", clusterId: null, projectId: 2, tenantId: 1 }]],
      insert: [],
      update: [
        [{ id: 1, title: "B", status: "draft" }],
        [{ id: 1, title: "B", status: "approved" }],
      ],
    };
    const { baseUrl, close } = await bootRoute("./briefs.ts", state);
    try {
      expect(
        (await fetch(`${baseUrl}/projects/nope/briefs/1/generate`, { method: "POST" })).status,
      ).toBe(400);
      expect(
        (await fetch(`${baseUrl}/projects/2/briefs/1/generate`, { method: "POST" })).status,
      ).toBe(200);
      expect(
        (await fetch(`${baseUrl}/projects/2/briefs/1/approve`, { method: "POST" })).status,
      ).toBe(200);
    } finally {
      await close();
    }
  });
});
