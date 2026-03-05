import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about verdict.games — your trusted source for honest PC and Android game reviews.",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 animate-fade-in-up">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">About verdict.games</h1>
        <div className="w-24 h-px bg-gradient-to-r from-accent to-transparent" />
      </header>

      <section className="space-y-4 text-sm text-secondary leading-relaxed">
        <p>
          <strong className="text-foreground">verdict.games</strong> is a premium game reviews
          platform built for players who want honest, no-nonsense opinions on PC and Android
          games. Think of it as a{" "}
          <span className="text-accent font-medium">Letterboxd for games</span> — clean,
          community-driven, and designed for people who care about quality.
        </p>

        <p>
          Every game gets a verdict: a clear score from 0 to 100, a TL;DR summary, and a
          breakdown of what works and what doesn&apos;t. We cover performance, monetization
          practices, and whether the game respects your time and money.
        </p>

        <h2 className="text-lg font-semibold text-foreground pt-4">What we believe</h2>
        <ul className="space-y-2 pl-4">
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">▸</span>
            <span>Players deserve honest reviews, not sponsored hype.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">▸</span>
            <span>Monetization practices should be transparent and called out.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">▸</span>
            <span>Great games deserve to be discovered, regardless of budget or marketing.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">▸</span>
            <span>Android gaming is real gaming and deserves the same critical attention.</span>
          </li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground pt-4">Verdict Scale</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-surface p-3">
            <p className="text-score-great font-bold text-sm">90–100 • MUST PLAY</p>
            <p className="text-xs text-tertiary">Exceptional. Essential gaming.</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-surface p-3">
            <p className="text-score-good font-bold text-sm">75–89 • WORTH IT</p>
            <p className="text-xs text-tertiary">Solid. Recommended with context.</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-surface p-3">
            <p className="text-score-mixed font-bold text-sm">50–74 • MIXED</p>
            <p className="text-xs text-tertiary">Flawed. Know what you&apos;re getting into.</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-surface p-3">
            <p className="text-score-bad font-bold text-sm">0–49 • SKIP</p>
            <p className="text-xs text-tertiary">Not recommended. Serious issues.</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-foreground pt-4">Tech stack</h2>
        <p>
          Built with Next.js, TypeScript, Tailwind CSS, and Supabase. Data sourced from RAWG, Steam,
          IGDB, CheapShark, and Wikipedia. Designed mobile-first with a cinematic dark glass aesthetic.
        </p>
      </section>
    </div>
  );
}
