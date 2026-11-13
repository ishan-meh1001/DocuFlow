import { z } from "zod";
import { inngest } from "@/lib/inngest";
import { verifyGitHubSignature } from "@/lib/github-signature";

const pushEventSchema = z.object({
  installation: z.object({ id: z.number().int().positive() }),
  repository: z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    full_name: z.string().min(1),
    owner: z.object({ login: z.string().min(1) }),
    html_url: z.string().url(),
    default_branch: z.string().min(1).nullable().optional(),
  }),
  after: z.string().regex(/^[a-f0-9]{40}$/i),
  deleted: z.boolean().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "GitHub webhook is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyGitHubSignature(secret, rawBody, request.headers.get("x-hub-signature-256"))) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const eventName = request.headers.get("x-github-event");
  if (eventName !== "push") {
    return Response.json({ status: "ignored", event: eventName }, { status: 202 });
  }

  const deliveryId = request.headers.get("x-github-delivery");
  if (!deliveryId || !z.string().uuid().safeParse(deliveryId).success) {
    return Response.json({ error: "Invalid or missing GitHub delivery ID." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  const parsed = pushEventSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Invalid GitHub push payload." }, { status: 400 });
  }

  const { installation, repository, after, deleted } = parsed.data;
  if (deleted || /^0{40}$/i.test(after)) {
    return Response.json({ status: "ignored", reason: "branch-deleted" }, { status: 202 });
  }
  try {
    await inngest.send({
      id: deliveryId,
      name: "docuflow/github.push",
      data: {
        deliveryId,
        installationId: installation.id,
        repository: {
          id: repository.id,
          fullName: repository.full_name,
          owner: repository.owner.login,
          name: repository.name,
          htmlUrl: repository.html_url,
          defaultBranch: repository.default_branch ?? "main",
        },
        commitSha: after,
      },
    });
  } catch {
    return Response.json({ error: "Could not queue the repository analysis." }, { status: 503 });
  }

  return Response.json({ status: "queued", deliveryId }, { status: 202 });
}
