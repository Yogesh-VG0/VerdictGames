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
  fetchedAt: string | null;
}

const snapshotFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
});

export default function HomepageMostAnticipatedSection({ games, fetchedAt }: HomepageMostAnticipatedSectionProps) {
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
                  <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
                    <h3 className="min-h-10 line-clamp-2 break-words text-sm font-bold leading-5 text-foreground" title={game.name}>{game.name}</h3>
                    <p className="min-h-[2rem] line-clamp-2 text-xs leading-4 text-secondary">{game.genres.slice(0, 2).join(" · ")}</p>
                    <div className="min-h-[2.5rem] text-xs leading-5">
                      <p className="font-medium text-foreground">{game.releaseWindow ?? formatReleaseTiming(timing)}</p>
                      {game.earlyAccess && <p className="text-secondary">Early Access · full release pending</p>}
                    </div>
                    <div className="mt-auto grid min-h-[1.75rem] grid-cols-2 gap-2 border-t border-border pt-2 text-[11px] leading-4 text-secondary">
                      {game.added > 0 && <span className="inline-flex items-center gap-1 whitespace-nowrap" title="RAWG users who added this game to any library status"><BookmarkPlus aria-hidden="true" className="size-3.5 shrink-0" />{formatNumber(game.added)} adds<span className="sr-only"> on RAWG</span></span>}
                      {game.toplay > 0 && <span className="inline-flex items-center gap-1 whitespace-nowrap" title="RAWG users who marked this game want to play"><Clock aria-hidden="true" className="size-3.5 shrink-0" />{formatNumber(game.toplay)} want to play<span className="sr-only"> on RAWG</span></span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </HorizontalScroll>
          {fetchedAt && Number.isFinite(Date.parse(fetchedAt)) && (
            <p className="mt-3 text-xs text-secondary">RAWG snapshot <time dateTime={fetchedAt}>{snapshotFormatter.format(new Date(fetchedAt))} UTC</time></p>
          )}
        </FadeInSection>
      </div>
    </section>
  );
}
