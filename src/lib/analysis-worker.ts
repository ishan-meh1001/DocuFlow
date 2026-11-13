import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";
import { analyzeFiles, getMarkdownDocuments, type Finding } from "./analysis";
import { createEmbedding } from "./embeddings";
import { fetchRepositoryFiles, type RepositoryPush } from "./github";
import { getPool } from "./db";

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function insertFindings(
  client: PoolClient,
  repositoryId: string,
  runId: string,
  findings: Finding[],
): Promise<void> {
  for (const finding of findings) {
    await client.query(
      `INSERT INTO findings (analysis_run_id, repository_id, path, finding_type, severity, title, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [runId, repositoryId, finding.path, finding.type, finding.severity, finding.title, finding.description],
    );
  }
}

export async function analyzePush(push: RepositoryPush): Promise<{ status: "complete" | "duplicate" }> {
  const pool = getPool();
  const alreadyProcessed = await pool.query(
    "SELECT 1 FROM webhook_deliveries WHERE delivery_id = $1",
    [push.deliveryId],
  );
  if (alreadyProcessed.rowCount) return { status: "duplicate" };

  const repositoryResult = await pool.query<{ id: string }>(
    `INSERT INTO repositories (github_repo_id, full_name, owner, name, html_url, default_branch, installation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (github_repo_id) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       owner = EXCLUDED.owner,
       name = EXCLUDED.name,
       html_url = EXCLUDED.html_url,
       default_branch = EXCLUDED.default_branch,
       installation_id = EXCLUDED.installation_id,
       updated_at = now()
     RETURNING id::text`,
    [
      push.repository.id,
      push.repository.fullName,
      push.repository.owner,
      push.repository.name,
      push.repository.htmlUrl,
      push.repository.defaultBranch,
      push.installationId,
    ],
  );
  const repositoryId = repositoryResult.rows[0].id;
  const runResult = await pool.query<{ id: string }>(
    `INSERT INTO analysis_runs (repository_id, commit_sha, status)
     VALUES ($1, $2, 'running') RETURNING id::text`,
    [repositoryId, push.commitSha],
  );
  const runId = runResult.rows[0].id;

  try {
    const files = await fetchRepositoryFiles(push);
    const findings = analyzeFiles(files);
    const documents = getMarkdownDocuments(files);
    const embeddings = await Promise.all(documents.map(async (document) => ({
      path: document.path,
      contentHash: createHash("sha256").update(document.content).digest("hex"),
      vector: await createEmbedding(document.content),
    })));
    const duplicateFindings: Finding[] = [];
    const seenPairs = new Set<string>();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM findings WHERE repository_id = $1", [repositoryId]);
      await client.query("DELETE FROM repository_files WHERE repository_id = $1", [repositoryId]);
      await client.query("DELETE FROM document_embeddings WHERE repository_id = $1", [repositoryId]);

      for (const file of files) {
        await client.query(
          `INSERT INTO repository_files (repository_id, path, content_sha, language, content)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            repositoryId,
            file.path,
            createHash("sha256").update(file.content).digest("hex"),
            /\.(md|mdx)$/i.test(file.path)
              ? "markdown"
              : /\.jsx?$/i.test(file.path)
                ? "javascript"
                : "typescript",
            file.content,
          ],
        );
      }

      for (const item of embeddings) {
        await client.query(
          `INSERT INTO document_embeddings (repository_id, path, content_hash, embedding, model)
           VALUES ($1, $2, $3, $4::vector, $5)`,
          [repositoryId, item.path, item.contentHash, toVectorLiteral(item.vector), process.env.EMBEDDING_MODEL],
        );
      }

      for (const item of embeddings) {
        const nearest = await client.query<{ path: string; similarity: number }>(
          `SELECT path, 1 - (embedding <=> $3::vector) AS similarity
           FROM document_embeddings
           WHERE repository_id = $1 AND path <> $2
           ORDER BY embedding <=> $3::vector
           LIMIT 1`,
          [repositoryId, item.path, toVectorLiteral(item.vector)],
        );
        const candidate = nearest.rows[0];
        if (!candidate || candidate.similarity < 0.86) continue;

        const pair = [item.path, candidate.path].sort().join("\0");
        if (seenPairs.has(pair)) continue;
        seenPairs.add(pair);
        duplicateFindings.push({
          path: item.path,
          type: "docs.semantic-duplicate",
          severity: "medium",
          title: `This page may duplicate ${candidate.path}`,
          description: `The embedding similarity is ${(candidate.similarity * 100).toFixed(0)}%. Consider consolidating overlapping guidance.`,
        });
      }

      await insertFindings(client, repositoryId, runId, [...findings, ...duplicateFindings]);
      await client.query(
        "UPDATE analysis_runs SET status = 'completed', completed_at = now() WHERE id = $1",
        [runId],
      );
      await client.query(
        "INSERT INTO webhook_deliveries (delivery_id, event_name) VALUES ($1, 'push')",
        [push.deliveryId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    revalidatePath("/");
    return { status: "complete" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analysis failure.";
    await pool.query(
      "UPDATE analysis_runs SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1",
      [runId, message],
    );
    throw error;
  }
}
