import Link from "next/link";
import { BookmarkPlus, Clock, Rocket } from "lucide-react";
import FadeInSection from "@/components/FadeInSection";
import HorizontalScroll from "@/components/HorizontalScroll";
import SectionHeader from "@/components/SectionHeader";
import CatalogueCardArtwork from "@/components/CatalogueCardArtwork";
import { catalogueGameHref } from "@/lib/utils/artwork";
import { formatNumber } from "@/lib/utils";
import { formatReleaseTiming, resolveReleaseTiming } from "@/lib/utils/release-timing";
import type { HomepageAnticipatedGame } from "@/lib/services/homepage";

interface HomepageMostAnticipatedSectionProps {
  games: HomepageAnticipatedGame[];
}

export default function HomepageMostAnticipatedSection({ games }: HomepageMostAnticipatedSectionProps) {
  if (games.length === 0) return null;

  return (
    <section className="py-12 sm:py-16" aria-label="Most Anticipated">
      <div className="max-w-[1400px] mx-auto px-4">
        <FadeInSection>
          <SectionHeader
            title="Most Anticipated"
            href="/explore?type=best-of-year"
            linkLabel="See all"
            icon={<Rocket className="w-5 h-5" />}
            subtitle="Upcoming games and full releases ranked by RAWG interest"
            gradient="linear-gradient(90deg, #06b6d4 0%, #3b82f6 25%, #8b5cf6 50%, #06b6d4 75%, #3b82f6 100%)"
          />
          <HorizontalScroll snap>
            {games.map((game) => {
              const timing = game.releaseTiming ?? resolveReleaseTiming(game.released, { upcoming: true, tba: game.tba });
              return (
                <Link key={game.slug} href={catalogueGameHref(game)} prefetch={false}
                  className="group flex w-60 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-border-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:w-72 lg:w-80">
                  <CatalogueCardArtwork image={game.image} imageKind={game.imageKind} layout="landscape" />
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <h3 className="min-h-10 line-clamp-2 break-words text-sm font-bold leading-5 text-foreground" title={game.name}>{game.name}</h3>
                    <div className="flex items-baseline justify-between gap-2 text-xs leading-4">
                      <p className="min-w-0 truncate text-secondary">{game.genres.slice(0, 2).join(" · ")}</p>
                      <p className="shrink-0 font-medium text-foreground">{game.releaseWindow ?? formatReleaseTiming(timing)}</p>
                    </div>
                    {game.earlyAccess && <p className="text-[11px] leading-4 text-secondary">Early Access · full release pending</p>}
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-1.5 text-[11px] leading-4 text-secondary">
                      {game.added > 0 && <span className="inline-flex items-center gap-1 whitespace-nowrap" title="RAWG users who added this game to any library status"><BookmarkPlus aria-hidden="true" className="size-3.5 shrink-0" />{formatNumber(game.added)} adds<span className="sr-only"> on RAWG</span></span>}
                      {game.toplay > 0 && <span className="inline-flex items-center gap-1 whitespace-nowrap" title="RAWG users who marked this game want to play"><Clock aria-hidden="true" className="size-3.5 shrink-0" />{formatNumber(game.toplay)} want to play<span className="sr-only"> on RAWG</span></span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </HorizontalScroll>
        </FadeInSection>
      </div>
    </section>
  );
}
