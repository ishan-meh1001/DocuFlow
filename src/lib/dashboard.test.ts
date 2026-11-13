import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("./db", () => ({
  getPool: () => ({ query }),
}));

import { getDashboardData } from "./dashboard";

describe("getDashboardData", () => {
  beforeEach(() => {
    query.mockReset().mockResolvedValue({ rows: [] });
  });

  it("scopes repository and finding queries to the requested workspace", async () => {
    const workspaceId = "623112c4-e63d-4c0a-bfb4-6912d15bc826";

    await getDashboardData(workspaceId);

    expect(query).toHaveBeenCalledTimes(2);
    for (const [statement, values] of query.mock.calls) {
      expect(statement).toContain("WHERE r.workspace_id = $1");
      expect(values).toEqual([workspaceId]);
    }
  });
});
