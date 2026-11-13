import { App } from "@octokit/app";
import { z } from "zod";
import type { SourceFile } from "./analysis";

export const repositoryPushSchema = z.object({
  deliveryId: z.string().uuid(),
  installationId: z.number().int().positive(),
  repository: z.object({
    id: z.number().int().positive(),
    fullName: z.string().min(1),
    owner: z.string().min(1),
    name: z.string().min(1),
    htmlUrl: z.string().url(),
    defaultBranch: z.string().min(1),
  }),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/i),
});

const repositoryTreeSchema = z.object({
  tree: z.array(z.object({
    path: z.string(),
    type: z.string(),
    sha: z.string(),
    size: z.number().int().nonnegative().optional(),
  })),
  truncated: z.boolean(),
});

const MAX_ANALYZED_FILES = 100;
const MAX_FILE_BYTES = 1_000_000;
const supportedFile = /\.(md|mdx|ts|tsx|js|jsx)$/i;
const ignoredPathPart = /(^|\/)(node_modules|vendor|dist|build|\.next|coverage)(\/|$)/;

export type RepositoryPush = z.infer<typeof repositoryPushSchema>;

function getGitHubApp(): App {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !privateKey) {
    throw new Error("Configure GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY to analyze GitHub repositories.");
  }
  return new App({ appId, privateKey });
}

export async function fetchRepositoryFiles(push: RepositoryPush): Promise<SourceFile[]> {
  const octokit = await getGitHubApp().getInstallationOctokit(push.installationId);
  const commitResponse = await octokit.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", {
    owner: push.repository.owner,
    repo: push.repository.name,
    commit_sha: push.commitSha,
  });
  const treeResponse = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
    owner: push.repository.owner,
    repo: push.repository.name,
    tree_sha: commitResponse.data.tree.sha,
    recursive: "true",
  });
  const tree = repositoryTreeSchema.parse(treeResponse.data);
  if (tree.truncated) {
    throw new Error(`GitHub returned a truncated file tree for ${push.repository.fullName}.`);
  }

  const supportedEntries = tree.tree.filter(({ path, type }) =>
    type === "blob" && supportedFile.test(path) && !ignoredPathPart.test(path) && !/\.d\.ts$/i.test(path),
  );
  const oversized = supportedEntries.find(({ size }) => size !== undefined && size > MAX_FILE_BYTES);
  if (oversized) {
    throw new Error(`${oversized.path} exceeds the MVP file-size limit of ${MAX_FILE_BYTES} bytes.`);
  }
  const paths = supportedEntries.map(({ path }) => path).sort();
  if (paths.length > MAX_ANALYZED_FILES) {
    throw new Error(`${push.repository.fullName} has ${paths.length} supported files; the MVP limit is ${MAX_ANALYZED_FILES}.`);
  }

  const files: SourceFile[] = [];
  for (let index = 0; index < paths.length; index += 5) {
    const batch = paths.slice(index, index + 5);
    const results = await Promise.all(batch.map(async (path) => {
      const response = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner: push.repository.owner,
        repo: push.repository.name,
        path,
        ref: push.commitSha,
      });
      const content = response.data;
      if (Array.isArray(content) || content.type !== "file" || content.encoding !== "base64" || content.content === undefined) {
        throw new Error(`GitHub did not return a base64 file for ${path}.`);
      }
      const decoded = Buffer.from(content.content, "base64");
      if (decoded.byteLength > MAX_FILE_BYTES) {
        throw new Error(`${path} exceeds the MVP file-size limit of ${MAX_FILE_BYTES} bytes.`);
      }
      return { path, content: decoded.toString("utf8") };
    }));
    files.push(...results);
  }
  return files;
}
