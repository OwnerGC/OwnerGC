// Pieces shared by the public pages: the logo, the top navigation and the footer.
import Link from "next/link";

/** The Tally waitlist form. Change it here and every "Join waitlist" button follows. */
export const WAITLIST_URL = "https://tally.so/r/rDoyRo";

export function Logo({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <Link className="brand" href="/">
      <span className="mark">
        <svg viewBox="0 0 20 20" fill="none" stroke="#13202c" strokeWidth="2.2" strokeLinejoin="round">
          <path d="M3 10 10 4l7 6v6.5H3z" />
          <path d="M8 16.5v-4h4v4" />
        </svg>
      </span>
      <span>
        Owner<span style={size === "sm" ? { color: "var(--accent)" } : undefined}>GC</span>
      </span>
    </Link>
  );
}

export function WaitlistLink({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <a className={className} href={WAITLIST_URL} target="_blank" rel="noopener">
      {children}
    </a>
  );
}

/** Top navigation for the dark hero band. `home` uses in-page links. */
export function TopNav({ home = false, signedIn = false }: { home?: boolean; signedIn?: boolean }) {
  const at = (hash: string) => (home ? hash : `/${hash}`);
  return (
    <nav className="top">
      <Logo />
      <div className="links">
        <Link className="plain" href={home ? "#estimator" : "/estimate"}>
          Estimator
        </Link>
        <Link className="plain" href={at("#features")}>
          Features
        </Link>
        <Link className="plain" href={at("#faq")}>
          FAQ
        </Link>
        <Link className="plain" href={signedIn ? "/dashboard" : "/login"}>
          {signedIn ? "My projects" : "Sign in"}
        </Link>
        <WaitlistLink className="btn">Join waitlist</WaitlistLink>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <Logo size="sm" />
        <span>
          © 2026 OwnerGC · Estimates are for planning only and are not bids, appraisals or financial advice. ·{" "}
          <Link href="/privacy" style={{ color: "inherit" }}>
            Privacy
          </Link>
        </span>
      </div>
    </footer>
  );
}
