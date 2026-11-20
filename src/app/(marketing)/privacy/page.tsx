import type { Metadata } from "next";
import { Logo, SiteFooter } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: "Privacy policy · OwnerGC",
  description: "How OwnerGC collects, uses and protects your information.",
};

export default function PrivacyPage() {
  return (
    <>
      <header className="legal-head">
        <div className="wrap">
          <Logo size="sm" />
        </div>
      </header>
      <main className="wrap legal">
        <h1>Privacy policy</h1>
        <p className="updated">Last updated November 20, 2026</p>

        <p>
          OwnerGC (&quot;we&quot;, &quot;us&quot;) helps people who are acting as their own general contractor plan and run a home build.
          This policy explains what information we collect through ownergc.app and the OwnerGC app, how we use it, and the choices you have.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Account information.</strong> When you create an account we collect your email address, your name if you give it, and a
            password (stored only in hashed form). If you sign in with Google, we receive your name, email address and profile picture from
            Google. We don&apos;t receive your Google password.
          </li>
          <li>
            <strong>Project information you enter.</strong> Details about your build, such as project name, site address, square footage,
            finish level, budgets, expenses, bids, subcontractor contacts, checklists, loan draws, and any documents or photos you upload.
          </li>
          <li>
            <strong>Waitlist sign-ups.</strong> If you join our waitlist, the details you enter in the form are collected by our form
            provider, Tally, on our behalf.
          </li>
          <li>
            <strong>Payment information.</strong> Paid plans are handled by Stripe. Card details go straight to Stripe and never reach our
            servers. We receive only your subscription status and a customer reference.
          </li>
          <li>
            <strong>Technical information.</strong> Our hosting providers keep standard server logs (such as IP address, browser type and
            pages requested) to run and secure the service. The free cost estimator works out its numbers entirely in your browser, and what
            you type into it isn&apos;t sent to us unless you choose to save it to your account.
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>
            To provide the service: sign you in, save your projects, and show your data back to you and to anyone you choose to share a
            project with.
          </li>
          <li>
            To send messages about your account, such as email confirmation, password resets, billing receipts and important service
            changes.
          </li>
          <li>To keep the service secure, prevent abuse and fix problems.</li>
          <li>To tell waitlist members when OwnerGC is ready. You can unsubscribe at any time.</li>
        </ul>
        <p>We don&apos;t sell your personal information, and we don&apos;t use your project data for advertising.</p>

        <h2>Who can see your data</h2>
        <p>
          Your projects are private to your account. Our database is set up so that a project can be read only by its members, and you
          decide who else is added. Documents are kept in private storage and opened through short-lived links.
        </p>
        <p>We use these service providers to run OwnerGC, and each one processes data only to provide its service to us:</p>
        <ul>
          <li>
            <strong>Supabase</strong>: database, sign-in and file storage
          </li>
          <li>
            <strong>Cloudflare</strong> and <strong>Vercel</strong>: website hosting
          </li>
          <li>
            <strong>Google</strong>: optional &quot;Continue with Google&quot; sign-in
          </li>
          <li>
            <strong>Stripe</strong>: payments
          </li>
          <li>
            <strong>Tally</strong>: waitlist form
          </li>
        </ul>
        <p>We may also disclose information if the law requires it.</p>

        <h2>Keeping and deleting your data</h2>
        <p>
          We keep your account and project data for as long as your account is open. You can ask us to delete your account at any time. When
          you do, we delete your account, your projects and your uploaded files. Copies in our backups are removed as the backups expire,
          normally within 7 days.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>View and edit your project information in the app at any time.</li>
          <li>Ask us for a copy of your data, or to correct or delete it.</li>
          <li>Leave the waitlist through the unsubscribe link in any email.</li>
        </ul>

        <h2>Security</h2>
        <p>
          We use encrypted connections (HTTPS), database-level access rules, private file storage and two-factor authentication on our own
          admin accounts. No system is perfectly secure, but protecting your build documents is central to how OwnerGC is designed.
        </p>

        <h2>Children</h2>
        <p>OwnerGC is not intended for anyone under 18, and we don&apos;t knowingly collect information from children.</p>

        <h2>Changes to this policy</h2>
        <p>If we make significant changes, we&apos;ll update the date above and let account holders know by email.</p>

        <h2>Contact</h2>
        <p>
          Questions or requests: <a href="mailto:ownergc3@gmail.com">ownergc3@gmail.com</a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
