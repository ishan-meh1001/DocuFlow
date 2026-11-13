# DocuFlow

DocuFlow analyzes GitHub repositories for documentation drift and quality signals. The MVP supports Markdown documentation and TypeScript/JavaScript source files.

## Local development

Requires Node.js 20+ and a Supabase project with Auth and the `pgvector` extension available.

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL`.
3. Set `DATABASE_URL` in the shell that will run migrations, then run `npm run db:migrate` (it applies both migrations). The migration script does not read `.env.local`. For a hosted database, you can instead run both SQL files in order in the Supabase SQL Editor. New Supabase Auth users receive a private workspace automatically.
4. Configure a GitHub App with repository contents read access and push-event webhooks. Set its app ID, slug, private key, and webhook secret.
5. Configure an OpenAI-compatible embedding endpoint, key, and model that returns 1536-dimensional embeddings. Repository documentation is sent to this endpoint for semantic comparison.
6. Start the app and the Inngest development server in separate terminals:

   ```sh
   npm run dev
   npx inngest-cli@latest dev
   ```

   The local Inngest server discovers the app's functions at `http://localhost:3000/api/inngest`.

The GitHub webhook endpoint is `http://localhost:3000/api/webhooks/github`. For local GitHub delivery, expose the endpoint through a trusted HTTPS tunnel and configure that URL in the GitHub App.

## Multi-user setup

- Users create individual accounts with Supabase Auth. Configure Supabase Auth's **Site URL** and allowed redirect URLs for the production domain and `/auth/callback`.
- Configure custom email delivery in Supabase Auth before enabling account creation for real users; the default email service is intended for testing and is rate-limited.
- Each account gets a private workspace. Dashboard queries are filtered by workspace, and GitHub App installations are linked to the signed-in workspace through a one-time state callback.
- Set the GitHub App's **Setup URL** to `https://<production-domain>/api/github/install/callback`. Users connect the app from their DocuFlow workspace; push events for unlinked installations are rejected.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is a public client key. Never expose `DATABASE_URL` or a Supabase service-role key to the browser.
- The database pool is intentionally limited to one connection per warm serverless instance; use Supabase's Transaction Pooler for Vercel. Inngest serializes analysis per GitHub repository to prevent overlapping pushes from replacing the same snapshot at once.
- The runtime uses a private server-side PostgreSQL connection. Tenant isolation is enforced by authenticated workspace checks in application queries; never expose `DATABASE_URL` to the browser.

## Analysis behavior and current limits

- A verified GitHub `push` event queues an Inngest job; the job fetches the repository tree at the pushed commit.
- The analyzer checks for missing Markdown page titles, very short pages, exported TypeScript/JavaScript symbols not mentioned in Markdown, and semantically similar Markdown files.
- The MVP analyzes at most 100 supported files per repository, with a 1 MB per-file limit. Larger repositories or files fail explicitly instead of being silently truncated.
- Embeddings use a configurable OpenAI-compatible endpoint. The endpoint must return 1536-dimensional vectors for pgvector cosine comparison.
- Each signed-in user sees only repositories associated with their workspace. The initial multi-user foundation supports separate private workspaces; workspace invitations and shared team workspaces are not yet included.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Hosted setup

The code targets Vercel, Supabase PostgreSQL with `pgvector` and Auth, and Inngest. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, and `DATABASE_URL` in Vercel, along with the GitHub App, Inngest, and embedding-provider variables listed in `.env.example`. Run both SQL migrations before users sign up. In Supabase Auth, set the production Site URL and allow the production domain plus `/auth/callback` as a redirect URL. Configure all secrets in hosted environment-variable settings rather than committing them.
