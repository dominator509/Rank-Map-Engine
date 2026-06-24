import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  selectRows: [] as unknown[][],
}));

function tableMock() {
  return new Proxy(
    {},
    {
      get: (_target, prop) => String(prop),
    },
  );
}

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ op: "and", args }),
  eq: (...args: unknown[]) => ({ op: "eq", args }),
  isNull: (value: unknown) => ({ op: "isNull", value }),
}));

vi.mock("@workspace/db", () => {
  const chainSelect = () => {
    const rows = dbState.selectRows.shift() ?? [];
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

  return {
    clientsTable: tableMock(),
    db: {
      select: vi.fn(chainSelect),
    },
    geoAeoAuditsTable: tableMock(),
    geoAeoFindingsTable: tableMock(),
    geoAeoPromptsTable: tableMock(),
    projectsTable: tableMock(),
    reportsTable: tableMock(),
    tenantsTable: tableMock(),
  };
});

vi.mock("./audit.js", () => ({ audit: vi.fn() }));

describe("GEO/AEO access helpers", () => {
  beforeEach(() => {
    dbState.selectRows = [];
  });

  it("allows operator report exports through geoAeo.exportReports", async () => {
    const { authorizeGeoAeoReportExport } = await import("./geo-aeo-access.js");
    dbState.selectRows.push([{ id: 301, tenantId: 7, projectId: 9, data: {} }]);

    const access = await authorizeGeoAeoReportExport({
      tenantId: 7,
      reportId: 301,
      role: "agency_admin",
    });

    expect(access).toEqual({
      allowed: true,
      permission: "geoAeo.exportReports",
      clientDownload: false,
      licensePlan: null,
    });
  });

  it("allows operators to inspect client dashboard data without consuming a client license gate", async () => {
    const { authorizeGeoAeoClientDashboardAccess } = await import("./geo-aeo-access.js");

    const access = await authorizeGeoAeoClientDashboardAccess({
      tenantId: 7,
      role: "agency_admin",
    });

    expect(access).toEqual({
      allowed: true,
      permission: "geoAeo.viewClientDashboard",
      clientView: false,
      downloadsAllowed: false,
      licensePlan: null,
    });
  });

  it("blocks client dashboard access without an AI visibility license", async () => {
    const { authorizeGeoAeoClientDashboardAccess } = await import("./geo-aeo-access.js");
    dbState.selectRows.push([{ plan: "solo" }]);

    const access = await authorizeGeoAeoClientDashboardAccess({
      tenantId: 7,
      role: "client",
    });

    expect(access).toEqual({
      allowed: false,
      status: 403,
      error:
        "GEO/AEO client dashboard requires geoAeo.viewClientDashboard and an AI visibility license.",
      permission: "geoAeo.viewClientDashboard",
      licensePlan: "solo",
    });
  });

  it("allows licensed client dashboard access and report downloads", async () => {
    const { authorizeGeoAeoClientDashboardAccess } = await import("./geo-aeo-access.js");
    dbState.selectRows.push([{ plan: "enterprise" }]);

    const access = await authorizeGeoAeoClientDashboardAccess({
      tenantId: 7,
      role: "client",
    });

    expect(access).toEqual({
      allowed: true,
      permission: "geoAeo.viewClientDashboard",
      clientView: true,
      downloadsAllowed: true,
      licensePlan: "enterprise",
    });
  });

  it("blocks client report exports without a download license", async () => {
    const { authorizeGeoAeoReportExport } = await import("./geo-aeo-access.js");
    dbState.selectRows.push(
      [{ id: 301, tenantId: 7, projectId: 9, data: { audit: { id: 101 } } }],
      [{ plan: "solo" }],
    );

    const access = await authorizeGeoAeoReportExport({
      tenantId: 7,
      reportId: 301,
      role: "client",
    });

    expect(access).toEqual({
      allowed: false,
      status: 403,
      error: "GEO/AEO report export requires geoAeo.exportReports and a report-download license.",
      permission: "geoAeo.exportReports",
      licensePlan: "solo",
    });
  });

  it("allows client report exports only for licensed tenants and approved audits", async () => {
    const { authorizeGeoAeoReportExport } = await import("./geo-aeo-access.js");
    dbState.selectRows.push(
      [{ id: 301, tenantId: 7, projectId: 9, data: { audit: { id: 101 } } }],
      [{ plan: "agency" }],
      [{ id: 101 }],
    );

    const access = await authorizeGeoAeoReportExport({
      tenantId: 7,
      reportId: 301,
      role: "client",
    });

    expect(access).toEqual({
      allowed: true,
      permission: "geoAeo.exportReports",
      clientDownload: true,
      licensePlan: "agency",
    });
  });
});
