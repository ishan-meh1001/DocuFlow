# DocuFlow

DocuFlow analyzes GitHub repositories for documentation drift and quality signals. The MVP supports Markdown documentation and TypeScript/JavaScript source files.

## Local development

Requires Node.js 20+ and a PostgreSQL database with the `pgvector` extension available.

1. Copy `.env.example` to `.env.local`.
2. Set `DOCUFLOW_DASHBOARD_PASSWORD` and a random `SESSION_SECRET` of at least 32 characters.
3. Set `DATABASE_URL`, then run `npm run db:migrate`.
4. Configure a GitHub App with repository contents read access and push-event webhooks. Set its app ID, slug, private key, and webhook secret.
5. Configure an OpenAI-compatible embedding endpoint, key, and model that returns 1536-dimensional embeddings. Repository documentation is sent to this endpoint for semantic comparison.
6. Start the app and the Inngest development server in separate terminals:

   ```sh
   npm run dev
   npx inngest-cli@latest dev
   ```

   The local Inngest server discovers the app's functions at `http://localhost:3000/api/inngest`.

The GitHub webhook endpoint is `http://localhost:3000/api/webhooks/github`. For local GitHub delivery, expose the endpoint through a trusted HTTPS tunnel and configure that URL in the GitHub App.

## Analysis behavior and current limits

- A verified GitHub `push` event queues an Inngest job; the job fetches the repository tree at the pushed commit.
- The analyzer checks for missing Markdown page titles, very short pages, exported TypeScript/JavaScript symbols not mentioned in Markdown, and semantically similar Markdown files.
- The MVP analyzes at most 100 supported files per repository, with a 1 MB per-file limit. Larger repositories or files fail explicitly instead of being silently truncated.
- Embeddings use a configurable OpenAI-compatible endpoint. The endpoint must return 1536-dimensional vectors for pgvector cosine comparison.
- The dashboard and read APIs require the workspace password. This is a single-workspace access gate, not multi-user authentication.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Hosted setup (deferred)

The code targets Vercel, managed PostgreSQL with `pgvector`, and Inngest. Provision those services only when ready to deploy; configure secrets in their environment-variable settings rather than committing them. Add a production identity provider before offering the dashboard to multiple users.
