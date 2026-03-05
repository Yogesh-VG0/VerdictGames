import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for verdict.games.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in-up">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
        <div className="w-24 h-px bg-gradient-to-r from-accent to-transparent" />
        <p className="text-xs text-tertiary">Last updated: March 2026</p>
      </header>

      <div className="space-y-4 text-sm text-secondary leading-relaxed">
        <h2 className="text-lg font-semibold text-foreground">1. Acceptance</h2>
        <p>
          By accessing verdict.games, you agree to these terms. This is a personal,
          non-commercial project provided &ldquo;as is&rdquo; without warranties of any kind.
        </p>

        <h2 className="text-lg font-semibold text-foreground">2. User content</h2>
        <p>
          When you submit reviews, ratings, or other content to verdict.games, you retain
          ownership of your content. However, you grant us a non-exclusive, royalty-free
          license to display and distribute your content within the platform.
        </p>

        <h2 className="text-lg font-semibold text-foreground">3. Conduct</h2>
        <p>Users must:</p>
        <ul className="space-y-1 pl-4">
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">▸</span>
            <span>Be respectful in reviews and community interactions.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">▸</span>
            <span>Not submit spam, automated content, or misleading reviews.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">▸</span>
            <span>Not attempt to interfere with the platform&apos;s operation.</span>
          </li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">4. Game data</h2>
        <p>
          Game metadata, images, and related content are sourced from public APIs and are
          used for personal, non-commercial purposes in compliance with their respective
          terms of service. All game titles, trademarks, and copyrights belong to their
          respective owners.
        </p>

        <h2 className="text-lg font-semibold text-foreground">5. Disclaimer</h2>
        <p>
          verdict.games is provided for informational and entertainment purposes. Game
          verdicts and scores represent editorial opinions and community sentiment, not
          objective measurements. We are not responsible for purchasing decisions made based
          on our content.
        </p>

        <h2 className="text-lg font-semibold text-foreground">6. Changes</h2>
        <p>
          We may update these terms from time to time. Continued use of the platform
          constitutes acceptance of any changes.
        </p>
      </div>
    </div>
  );
}
