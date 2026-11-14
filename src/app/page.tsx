import Link from "next/link";
import { connectGitHubApp, login, logout, signUp } from "./actions";
import styles from "./page.module.css";
import { getAuthenticatedUser, isSupabaseAuthConfigured } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { getWorkspaceIdForUser } from "@/lib/workspaces";

export const instant = false;

type HomeProps = {
  searchParams: Promise<{
    error?: string;
    github?: string;
    mode?: string;
    notice?: string;
  }>;
};

function getErrorMessage(error?: string): string | null {
  switch (error) {
    case "credentials":
      return "Email or password is incorrect.";
    case "signup-input":
      return "Enter a valid email and use a password with at least 8 characters.";
    case "signup-config":
      return "Account creation is not configured correctly. Check the production site URL and Supabase Auth settings.";
    case "signup-failed":
    case "signup":
      return "Supabase could not create the account. If you already have an account, sign in; otherwise check Supabase Auth settings and the Vercel function logs.";
    case "confirmation":
      return "The email confirmation link could not be verified. Request a new one and try again.";
    case "github":
      return "GitHub App connection is not configured yet.";
    case "github-install":
    case "github-session":
    case "github-state":
    case "github-installation-owned":
      return "GitHub installation could not be connected. Start again from this workspace.";
    default:
      return null;
  }
}

export default async function Home({ searchParams }: HomeProps) {
  const { error, github, mode, notice } = await searchParams;

  if (!isSupabaseAuthConfigured()) {
    return (
      <main className={styles.page}>
        <section className={styles.loginCard}>
          <p className={styles.eyebrow}>DOCUFLOW / AUTH SETUP</p>
          <h1>Configure sign-in</h1>
          <p>
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and
            <code> NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to the server environment,
            then redeploy.
          </p>
        </section>
      </main>
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    const signingUp = mode === "signup";
    return (
      <main className={styles.page}>
        <section className={styles.loginCard}>
          <p className={styles.eyebrow}>DOCUFLOW / ACCOUNTS</p>
          <h1>{signingUp ? "Create your workspace." : "Documentation that stays in sync."}</h1>
          <p>
            {signingUp
              ? "Create an account to start a private workspace for your repositories."
              : "Sign in to review documentation drift across your repositories."}
          </p>
          {getErrorMessage(error) ? <p className={styles.error}>{getErrorMessage(error)}</p> : null}
          {notice === "check-email" ? (
            <p className={styles.notice}>Check your email to confirm your account, then sign in.</p>
          ) : null}
          <form action={signingUp ? signUp : login} className={styles.loginForm}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={signingUp ? "new-password" : "current-password"}
              minLength={signingUp ? 8 : undefined}
              required
            />
            <button type="submit">
              {signingUp ? "Create account" : "Sign in"} <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className={styles.authSwitch}>
            {signingUp ? "Already have an account?" : "New to DocuFlow?"}{" "}
            <Link href={signingUp ? "/?mode=login" : "/?mode=signup"}>
              {signingUp ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </section>
      </main>
    );
  }

  if (!process.env.DATABASE_URL) {
    return (
      <main className={styles.page}>
        <section className={styles.dashboard}>
          <header className={styles.header}>
            <Link className={styles.brand} href="/">docuflow<span>.</span></Link>
            <form action={logout}><button className={styles.textButton}>Sign out</button></form>
          </header>
          <div className={styles.emptyState}>
            <p className={styles.eyebrow}>WORKSPACE / DATABASE</p>
            <h1>Connect your data store</h1>
            <p>Set <code>DATABASE_URL</code> and apply the database migrations.</p>
          </div>
        </section>
      </main>
    );
  }

  const workspaceId = await getWorkspaceIdForUser(user.id);
  if (!workspaceId) {
    return (
      <main className={styles.page}>
        <section className={styles.dashboard}>
          <header className={styles.header}>
            <Link className={styles.brand} href="/">docuflow<span>.</span></Link>
            <form action={logout}><button className={styles.textButton}>Sign out</button></form>
          </header>
          <div className={styles.emptyState}>
            <p className={styles.eyebrow}>WORKSPACE / DATABASE</p>
            <h1>Finish the workspace migration</h1>
            <p>Apply <code>db/migrations/002_multi_user.sql</code> in Supabase, then sign out and back in.</p>
          </div>
        </section>
      </main>
    );
  }

  const { repositories, recentFindings } = await getDashboardData(workspaceId);

  return (
    <main className={styles.page}>
      <section className={styles.dashboard}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">docuflow<span>.</span></Link>
          <div className={styles.headerRight}>
            <span className={styles.status}><i /> {user.email}</span>
            <form action={logout}><button className={styles.textButton}>Sign out</button></form>
          </div>
        </header>

        {github === "connected" ? <p className={styles.notice}>GitHub App connected to this workspace.</p> : null}
        {getErrorMessage(error) ? <p className={styles.error}>{getErrorMessage(error)}</p> : null}

        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>DOCUMENTATION INTELLIGENCE</p>
            <h1>Know when your docs<br /><em>fall behind.</em></h1>
            <p className={styles.heroCopy}>A private workspace compares documentation with the code that ships and surfaces drift before it reaches your users.</p>
          </div>
          <div className={styles.heroOrb} aria-hidden="true"><span>DF</span><i /><b /></div>
        </div>

        <div className={styles.metrics}>
          <article><span>Repositories</span><strong>{repositories.length.toString().padStart(2, "0")}</strong><small>connected to your workspace</small></article>
          <article><span>Open findings</span><strong>{recentFindings.length.toString().padStart(2, "0")}</strong><small>from the latest analyses</small></article>
          <article><span>Analysis engine</span><strong className={styles.engine}>READY<span>●</span></strong><small>GitHub · Markdown · TypeScript</small></article>
        </div>

        <div className={styles.contentGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><p className={styles.eyebrow}>CONNECTED SOURCES</p><h2>Repositories</h2></div><span className={styles.count}>{repositories.length} TOTAL</span></div>
            {repositories.length === 0 ? (
              <div className={styles.panelEmpty}>
                <span className={styles.emptyIcon}>⌘</span>
                <h3>No repositories yet</h3>
                <p>Connect the GitHub App to this workspace. Push events will trigger analysis.</p>
                {process.env.GITHUB_APP_SLUG ? (
                  <form action={connectGitHubApp}>
                    <button className={styles.installButton}>Connect GitHub App <span aria-hidden="true">↗</span></button>
                  </form>
                ) : null}
              </div>
            ) : (
              <ul className={styles.repositoryList}>
                {repositories.map((repository) => (
                  <li key={repository.id}>
                    <a href={repository.htmlUrl} target="_blank" rel="noreferrer" className={styles.repoLink}>
                      <span className={styles.repoIcon}>GH</span>
                      <span><strong>{repository.fullName}</strong><small>{repository.defaultBranch} · {repository.latestAnalysis ?? "Awaiting analysis"}</small></span>
                      <span className={styles.arrow}>↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${styles.panel} ${styles.findingsPanel}`}>
            <div className={styles.panelHeading}><div><p className={styles.eyebrow}>LATEST SIGNAL</p><h2>Findings</h2></div><span className={styles.count}>RECENT</span></div>
            {recentFindings.length === 0 ? (
              <div className={styles.panelEmpty}><span className={styles.emptyIcon}>⌁</span><h3>Nothing to flag</h3><p>Drift and quality signals appear here after the first repository analysis completes.</p></div>
            ) : (
              <ul className={styles.findingList}>
                {recentFindings.map((finding) => (
                  <li key={finding.id}>
                    <span className={`${styles.severity} ${styles[finding.severity]}`} />
                    <div><strong>{finding.title}</strong><p>{finding.repositoryName} · {finding.path ?? "Repository"}</p></div>
                    <time>{finding.createdAt}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <footer className={styles.footer}><span>DOCUFLOW / PRIVATE WORKSPACE</span><span>Built for docs that keep up.</span></footer>
      </section>
    </main>
  );
}
