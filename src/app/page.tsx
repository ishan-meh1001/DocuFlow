import Link from "next/link";
import { logout, login } from "./actions";
import styles from "./page.module.css";
import { getDashboardData } from "@/lib/dashboard";
import { isAuthenticated, isDashboardConfigured } from "@/lib/auth";

export const instant = false;

type HomeProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const authenticated = await isAuthenticated();
  const { error } = await searchParams;

  if (!authenticated) {
    if (!isDashboardConfigured()) {
      return (
        <main className={styles.page}>
          <section className={styles.loginCard}>
            <p className={styles.eyebrow}>DOCUFLOW / SETUP</p>
            <h1>Secure your workspace</h1>
            <p>
              Set <code>DOCUFLOW_DASHBOARD_PASSWORD</code> and a 32-character
              <code> SESSION_SECRET</code> in your local environment before
              opening the dashboard.
            </p>
          </section>
        </main>
      );
    }

    return (
      <main className={styles.page}>
        <section className={styles.loginCard}>
          <p className={styles.eyebrow}>DOCUFLOW / PRIVATE PREVIEW</p>
          <h1>Documentation that stays in sync.</h1>
          <p>Sign in to review documentation drift across your repositories.</p>
          {error ? <p className={styles.error}>That password did not match.</p> : null}
          <form action={login} className={styles.loginForm}>
            <label htmlFor="password">Workspace password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
            <button type="submit">Continue <span aria-hidden="true">→</span></button>
          </form>
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
            <p>Set <code>DATABASE_URL</code>, apply the included migrations, then install the GitHub App to start receiving repository updates.</p>
          </div>
        </section>
      </main>
    );
  }

  const { repositories, recentFindings } = await getDashboardData();

  return (
    <main className={styles.page}>
      <section className={styles.dashboard}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">docuflow<span>.</span></Link>
          <div className={styles.headerRight}>
            <span className={styles.status}><i /> PRIVATE WORKSPACE</span>
            <form action={logout}><button className={styles.textButton}>Sign out</button></form>
          </div>
        </header>

        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>DOCUMENTATION INTELLIGENCE</p>
            <h1>Know when your docs<br /><em>fall behind.</em></h1>
            <p className={styles.heroCopy}>DocuFlow compares your documentation with the code that ships, and surfaces the drift before it reaches your users.</p>
          </div>
          <div className={styles.heroOrb} aria-hidden="true"><span>DF</span><i /><b /></div>
        </div>

        <div className={styles.metrics}>
          <article><span>Repositories</span><strong>{repositories.length.toString().padStart(2, "0")}</strong><small>connected to DocuFlow</small></article>
          <article><span>Open findings</span><strong>{recentFindings.length.toString().padStart(2, "0")}</strong><small>from the latest analyses</small></article>
          <article><span>Analysis engine</span><strong className={styles.engine}>READY<span>●</span></strong><small>GitHub · Markdown · TypeScript</small></article>
        </div>

        <div className={styles.contentGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><p className={styles.eyebrow}>CONNECTED SOURCES</p><h2>Repositories</h2></div><span className={styles.count}>{repositories.length} TOTAL</span></div>
            {repositories.length === 0 ? (
              <div className={styles.panelEmpty}><span className={styles.emptyIcon}>⌘</span><h3>No repositories yet</h3><p>Install the DocuFlow GitHub App to connect a repository. Push events will trigger the first analysis.</p>{process.env.GITHUB_APP_SLUG ? <a className={styles.installLink} href={`https://github.com/apps/${encodeURIComponent(process.env.GITHUB_APP_SLUG)}/installations/new`} target="_blank" rel="noreferrer">Install GitHub App <span aria-hidden="true">↗</span></a> : null}</div>
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
        <footer className={styles.footer}><span>DOCUFLOW / MVP FOUNDATION</span><span>Built for docs that keep up.</span></footer>
      </section>
    </main>
  );
}
