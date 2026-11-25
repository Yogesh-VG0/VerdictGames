import Link from "next/link";
import { Rocket } from "lucide-react";
import FadeInSection from "@/components/FadeInSection";
import HorizontalScroll from "@/components/HorizontalScroll";
import SectionHeader from "@/components/SectionHeader";
import HeroImage from "@/components/ui/HeroImage";
import { formatNumber } from "@/lib/utils";
import { formatReleaseTiming, resolveReleaseTiming } from '@/lib/utils/release-timing';
import type { HomepageAnticipatedGame } from "@/lib/services/homepage";

const MOST_ANTICIPATED_SUBTITLE = "Upcoming games and full releases ranked by RAWG interest";

interface HomepageMostAnticipatedSectionProps {
  games: HomepageAnticipatedGame[];
  fetchedAt: string | null;
}

export default function HomepageMostAnticipatedSection({
  games,
  fetchedAt,
}: HomepageMostAnticipatedSectionProps) {
  if (games.length === 0) {
    return null;
  }

  return (
    <section className="py-12 sm:py-16">
      <div className="max-w-[1400px] mx-auto px-4">
        <FadeInSection>
          <SectionHeader
            title="Most Anticipated"
            href="/explore?type=best-of-year"
            linkLabel="See all"
            icon={<Rocket className="w-5 h-5" />}
            subtitle={MOST_ANTICIPATED_SUBTITLE}
            gradient="linear-gradient(90deg, #06b6d4 0%, #3b82f6 25%, #8b5cf6 50%, #06b6d4 75%, #3b82f6 100%)"
          />
          {fetchedAt && (
            <p className="mb-3 text-xs text-secondary">
              RAWG snapshot from <time dateTime={fetchedAt}>{new Intl.DateTimeFormat("en", {
                dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
              }).format(new Date(fetchedAt))} UTC</time>
            </p>
          )}
          <HorizontalScroll>
            {games.map((game) => {
              const landscape = game.imageKind === 'artwork';
              const timing = game.releaseTiming ?? resolveReleaseTiming(game.released, { upcoming: true, tba: game.tba });
              return (
                <div key={game.slug} className={landscape ? 'shrink-0 w-64 sm:w-72 md:w-80' : 'shrink-0 w-32 sm:w-36 md:w-40'}>
                  <Link href={`/game/${game.slug}?rawgId=${game.rawgId}`} prefetch={false} className="block group">
                    <div className="overflow-hidden rounded-2xl border border-border bg-surface-2 transition-colors group-hover:border-accent/40">
                      <div className="relative h-36 sm:h-40 md:h-44 overflow-hidden">
                        {game.image ? (
                          <HeroImage
                            src={game.image}
                            alt={game.name}
                            sizes={landscape ? '(max-width: 640px) 256px, 320px' : '(max-width: 640px) 128px, 160px'}
                            className="motion-safe:group-hover:scale-[1.03] transition-transform duration-500"
                            fallbackClassName="bg-surface-2"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-pixel-cyan/10" />
                        )}
                      </div>
                      <div className="min-h-[5.5rem] p-3">
                        <p className="text-sm font-bold text-foreground line-clamp-1">{game.name}</p>
                        <div className="mt-1 flex items-baseline gap-2 text-[10px]">
                          <span className="min-w-0 truncate text-secondary">{game.genres.slice(0, 2).join(' · ')}</span>
                          <span className="ml-auto shrink-0 font-medium text-secondary">{game.releaseWindow ?? formatReleaseTiming(timing)}</span>
                        </div>
                        {game.earlyAccess && <p className="mt-1 text-[10px] leading-tight text-secondary">Early Access · full release pending</p>}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 px-1 text-[10px] text-secondary">
                      {game.added > 0 && <span title="RAWG users who added this game to any library status">{formatNumber(game.added)} RAWG adds</span>}
                      {game.toplay > 0 && <span title="RAWG want-to-play status">{formatNumber(game.toplay)} RAWG want to play</span>}
                    </div>
                  </Link>
                </div>
              );
            })}
          </HorizontalScroll>
        </FadeInSection>
      </div>
    </section>
  );
}
