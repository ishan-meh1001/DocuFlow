import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("./db", () => ({
  getPool: () => ({ query }),
}));

import { getAnalysisIndicator, getDashboardData } from "./dashboard";

describe("getDashboardData", () => {
  beforeEach(() => {
    query.mockReset().mockResolvedValue({ rows: [] });
  });

  it("scopes repository, finding, and latest-analysis queries to the requested workspace", async () => {
    const workspaceId = "623112c4-e63d-4c0a-bfb4-6912d15bc826";

    await getDashboardData(workspaceId);

    expect(query).toHaveBeenCalledTimes(3);
    for (const [statement, values] of query.mock.calls) {
      expect(statement).toContain("WHERE r.workspace_id = $1");
      expect(values).toEqual([workspaceId]);
    }
  });

  it("returns the latest run status and repository name", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ status: "failed", repository_name: "owner/repo" }],
      });

    await expect(getDashboardData("623112c4-e63d-4c0a-bfb4-6912d15bc826"))
      .resolves.toMatchObject({
        latestAnalysis: { status: "failed", repositoryName: "owner/repo" },
      });
  });

  describe("getAnalysisIndicator", () => {
      it("shows waiting before the workspace has an analysis run", () => {
        expect(getAnalysisIndicator(null)).toMatchObject({
          state: "waiting",
          label: "WAITING",
        });
      });

      it.each([
        ["running", "RUNNING"],
        ["completed", "SUCCEEDED"],
        ["failed", "FAILED"],
      ] as const)("maps a %s run to the matching status", (status, label) => {
        expect(getAnalysisIndicator({ status, repositoryName: "owner/repo" })).toMatchObject({
          state: status,
          label,
          detail: expect.stringContaining("owner/repo"),
        });
      });
  });

  it("returns no latest run before any analysis exists", async () => {
    await expect(getDashboardData("623112c4-e63d-4c0a-bfb4-6912d15bc826"))
      .resolves.toMatchObject({ latestAnalysis: null });
  });
});
