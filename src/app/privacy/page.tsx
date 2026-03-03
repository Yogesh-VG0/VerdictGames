import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for verdict.games.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in-up">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        <div className="pixel-divider w-24" />
        <p className="text-xs text-tertiary">Last updated: March 2026</p>
      </header>

      <div className="space-y-4 text-sm text-secondary leading-relaxed">
        <h2 className="text-lg font-semibold text-foreground">Overview</h2>
        <p>
          verdict.games is a personal, non-commercial project. We take your privacy seriously
          and collect the absolute minimum amount of data needed to provide the service.
        </p>

        <h2 className="text-lg font-semibold text-foreground">What we collect</h2>
        <ul className="space-y-1 pl-4">
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">▸</span>
            <span>
              <strong className="text-foreground">Account data:</strong> If you create an
              account, we store your username, email, and hashed password. We never store
              passwords in plain text.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">▸</span>
            <span>
              <strong className="text-foreground">Usage data:</strong> We may collect anonymous
              analytics (page views, search queries) to improve the platform. No personally
              identifiable information is tracked.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">▸</span>
            <span>
              <strong className="text-foreground">Local storage:</strong> We use localStorage
              to remember your theme preference (dark/light mode). This data stays on your
              device.
            </span>
          </li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">What we don&apos;t do</h2>
        <ul className="space-y-1 pl-4">
          <li className="flex items-start gap-2">
            <span className="text-danger mt-0.5">✕</span>
            <span>We do not sell your data to third parties.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-danger mt-0.5">✕</span>
            <span>We do not run third-party advertising trackers.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-danger mt-0.5">✕</span>
            <span>We do not share your information with data brokers.</span>
          </li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">Cookies</h2>
        <p>
          We use only essential cookies for session management (when accounts are implemented).
          No marketing or analytics cookies are used.
        </p>

        <h2 className="text-lg font-semibold text-foreground">Contact</h2>
        <p>
          If you have questions about this privacy policy, please reach out via the project&apos;s
          GitHub repository.
        </p>
      </div>
    </div>
  );
}
