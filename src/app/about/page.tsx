import { SITE_NAME } from "@/lib/seo";

const beliefs = [
  "Show where each rating and catalogue detail comes from.",
  "Make pricing and monetization information easy to find.",
  "Help players discover games across PC, console and mobile.",
  "Keep readers’ community reviews distinct from external ratings.",
];

const scale = [
  { range: "88–100", label: "MUST PLAY", desc: "Starts at 88 with high confidence or 90 with moderate confidence.", tone: "text-score-great border-score-great/30 bg-score-great/5" },
  { range: "72+", label: "WORTH IT", desc: "Starts at 72 with sufficient confidence, or 75 with limited confidence.", tone: "text-score-good border-score-good/30 bg-score-good/5" },
  { range: "50–71 or 50–74", label: "MIXED", desc: "The upper limit depends on confidence.", tone: "text-score-mixed border-score-mixed/30 bg-score-mixed/5" },
  { range: "Below 50", label: "SKIP", desc: "Applies when there is a positive score below 50.", tone: "text-score-bad border-score-bad/30 bg-score-bad/5" },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14 space-y-12 page-enter">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-surface/80 p-8 sm:p-10 shadow-xl shadow-black/20">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-pixel-cyan/10 pointer-events-none" />
        <div className="relative space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-semibold">The Verdict on Every Game</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            About <span className="gradient-text">{SITE_NAME}</span>
          </h1>
          <p className="text-sm sm:text-base text-secondary leading-relaxed max-w-2xl">
            Verdict Games is a video game discovery and comparison platform. Browse by platform, genre or release
            window, compare games side by side, and read reviews shared by other players.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface/50 p-6 sm:p-8 space-y-4 backdrop-blur-sm">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">How it works</h2>
        <p className="text-sm text-secondary leading-relaxed">
          The Verdict Score combines available community and critic evidence on a 0–100 scale. The community
          score uses Steam recommendations when available. RAWG ratings can supply a lower-confidence estimate.
          A statistical adjustment gives small samples less weight as evidence. The critic score averages the
          available IGDB critic and Metacritic ratings.
        </p>
        <p className="text-sm text-secondary leading-relaxed">
          When both scores are available, community evidence accounts for 55–65% of the blend. Confidence reflects
          review volume, source type and critic coverage. With only one score, the blend can move toward a neutral
          70. Limited evidence can cap the verdict label, and previews and recent releases can show a release status
          while evidence is still coming in.
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
                {row.label} <span className="opacity-80">•</span> {row.range}
              </p>
              <p className="text-xs text-tertiary mt-1.5 leading-relaxed">{row.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-6 sm:p-8 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Sources and updates</h2>
        <p className="text-sm text-secondary leading-relaxed">
          Catalogue information draws from RAWG, IGDB, Steam and other linked sources. Summaries reflect
          available data. Community reviews posted on Verdict Games are displayed separately from provider
          ratings and the calculated score.
        </p>
        <p className="text-sm text-secondary leading-relaxed">
          Player counts reflect recorded Steam observations. Deal and price information comes from sources
          including Steam and CheapShark, and availability can change at the store. Release information follows
          source evidence and can show an exact date, a broader window or an unknown full-release date.
        </p>
      </section>
    </div>
  );
}
