import { getPool } from "./db";

export type DashboardRepository = {
  id: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  latestAnalysis: string | null;
};

export type DashboardFinding = {
  id: string;
  title: string;
  path: string | null;
  severity: "low" | "medium" | "high";
  repositoryName: string;
  createdAt: string;
};

export async function getDashboardData(workspaceId: string): Promise<{
  repositories: DashboardRepository[];
  recentFindings: DashboardFinding[];
}> {
  const pool = getPool();
  const [repositoryResult, findingResult] = await Promise.all([
    pool.query<{
      id: string;
      full_name: string;
      html_url: string;
      default_branch: string;
      latest_analysis: string | null;
    }>(`
      SELECT r.id::text, r.full_name, r.html_url, r.default_branch,
        latest.status AS latest_analysis
      FROM repositories r
      LEFT JOIN LATERAL (
        SELECT status FROM analysis_runs
        WHERE repository_id = r.id
        ORDER BY started_at DESC LIMIT 1
      ) latest ON true
      WHERE r.workspace_id = $1
      ORDER BY r.full_name
    `, [workspaceId]),
    pool.query<{
      id: string;
      title: string;
      path: string | null;
      severity: "low" | "medium" | "high";
      full_name: string;
      created_at: Date;
    }>(`
      SELECT f.id::text, f.title, f.path, f.severity, r.full_name, f.created_at
      FROM findings f
      JOIN repositories r ON r.id = f.repository_id
      WHERE r.workspace_id = $1
      ORDER BY f.created_at DESC
      LIMIT 8
    `, [workspaceId]),
  ]);

  return {
    repositories: repositoryResult.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      htmlUrl: row.html_url,
      defaultBranch: row.default_branch,
      latestAnalysis: row.latest_analysis,
    })),
    recentFindings: findingResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      path: row.path,
      severity: row.severity,
      repositoryName: row.full_name,
      createdAt: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(row.created_at),
    })),
  };
}
