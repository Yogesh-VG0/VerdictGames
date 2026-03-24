const beliefs = [
  "Players deserve honest reviews, not sponsored hype.",
  "Monetization practices should be transparent and called out.",
  "Great games deserve to be discovered, regardless of budget or marketing.",
  "Every platform deserves the same critical attention — PC, console, and mobile.",
];

const scale = [
  { range: "90–100", label: "MUST PLAY", desc: "Exceptional. Essential gaming.", tone: "text-score-great border-score-great/30 bg-score-great/5" },
  { range: "75–89", label: "WORTH IT", desc: "Solid. Recommended with context.", tone: "text-score-good border-score-good/30 bg-score-good/5" },
  { range: "50–74", label: "MIXED", desc: "Flawed. Know what you're getting into.", tone: "text-score-mixed border-score-mixed/30 bg-score-mixed/5" },
  { range: "0–49", label: "SKIP", desc: "Not recommended. Serious issues.", tone: "text-score-bad border-score-bad/30 bg-score-bad/5" },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14 space-y-12 page-enter">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-surface/80 p-8 sm:p-10 shadow-xl shadow-black/20">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-pixel-cyan/10 pointer-events-none" />
        <div className="relative space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-semibold">Our mission</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            About <span className="gradient-text">verdict.games</span>
          </h1>
          <p className="text-sm sm:text-base text-secondary leading-relaxed max-w-2xl">
            A premium game reviews platform for players who want honest, no-nonsense opinions across every
            platform. Think{" "}
            <span className="text-foreground font-medium">Letterboxd for games</span> — clean,
            community-driven, and built for people who care about quality.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface/50 p-6 sm:p-8 space-y-4 backdrop-blur-sm">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">How it works</h2>
        <p className="text-sm text-secondary leading-relaxed">
          Every game gets a verdict: a clear score from 0 to 100, a TL;DR summary, and a breakdown of what
          works and what doesn&apos;t. We cover performance, monetization practices, and whether the game
          respects your time and money.
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold text-foreground">What we believe</h2>
        <ul className="space-y-3">
          {beliefs.map((line) => (
            <li
              key={line}
              className="flex gap-3 rounded-xl border border-border/80 bg-surface/40 px-4 py-3 text-sm text-secondary"
            >
              <span className="text-accent font-bold shrink-0">▸</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold text-foreground">Verdict scale</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {scale.map((row) => (
            <div
              key={row.label}
              className={`rounded-2xl border p-4 ${row.tone}`}
            >
              <p className="font-bold text-sm">
                {row.range} <span className="opacity-80">•</span> {row.label}
              </p>
              <p className="text-xs text-tertiary mt-1.5 leading-relaxed">{row.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-6 sm:p-8 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Tech stack</h2>
        <p className="text-sm text-secondary leading-relaxed">
          Built with Next.js, TypeScript, Tailwind CSS, and Supabase. Data sourced from RAWG, Steam, IGDB,
          CheapShark, Wikipedia, HLTB, and GX Corner. Designed mobile-first with a cinematic dark glass aesthetic.
        </p>
      </section>
    </div>
  );
}
