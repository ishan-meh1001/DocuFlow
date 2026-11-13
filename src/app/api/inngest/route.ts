import { serve } from "inngest/next";
import { analyzePush } from "@/lib/analysis-worker";
import { repositoryPushSchema } from "@/lib/github";
import { inngest } from "@/lib/inngest";

const analyzeRepository = inngest.createFunction(
  { id: "analyze-github-push", retries: 3, triggers: [{ event: "docuflow/github.push" }] },
  async ({ event, step }) => step.run("analyze-repository", () =>
    analyzePush(repositoryPushSchema.parse(event.data)),
  ),
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyzeRepository],
});
