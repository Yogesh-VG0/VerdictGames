import Link from "next/link";
import { Rocket } from "lucide-react";
import FadeInSection from "@/components/FadeInSection";
import HorizontalScroll from "@/components/HorizontalScroll";
import SectionHeader from "@/components/SectionHeader";
import HeroImage from "@/components/ui/HeroImage";
import { formatNumber } from "@/lib/utils";
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
            {games.map((game) => (
              <div key={game.slug} className="shrink-0 w-44 sm:w-52 md:w-56 h-full">
                <Link href={`/game/${game.slug}?rawgId=${game.rawgId}`} prefetch={false} className="block group">
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-border bg-surface-2 group-hover:border-accent/40 transition-all">
                    {game.image ? (
                      <HeroImage
                        src={game.image}
                        alt={game.name}
                        sizes="(max-width: 640px) 176px, 224px"
                        fit={game.imageKind === 'artwork' ? 'contain' : 'cover'}
                        className="group-hover:scale-105 transition-transform duration-500"
                        priority={false}
                        fallbackClassName="bg-surface-2"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-accent/10 to-pixel-cyan/10" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-8">
                      <p className="text-sm font-bold text-white line-clamp-1 drop-shadow-lg">{game.name}</p>
                      {game.earlyAccess && <p className="mt-1 text-[10px] text-white/80">Early Access · full release pending</p>}
                      <div className="flex items-center gap-2 mt-1">
                        {game.genres.slice(0, 2).map((genre, genreIndex) => (
                          <span key={genre} className="text-[10px] text-white/60">
                            {genreIndex > 0 && <span className="mr-1">·</span>}
                            {genre}
                          </span>
                        ))}
                        <span className="ml-auto text-[10px] font-medium">
                          <span className={game.releaseWindow ? "text-white/70" : "text-yellow-400"}>
                            {game.releaseWindow ?? (!game.tba && game.released ? game.released : "TBA")}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 px-1 text-[10px] text-secondary">
                    {Number(game.added) > 0 && <span title="RAWG users who added this game to any library status" className="text-secondary font-medium">{formatNumber(game.added)} RAWG adds</span>}
                    {game.toplay > 0 && <span title="RAWG want-to-play status">{formatNumber(game.toplay)} RAWG want to play</span>}
                  </div>
                </Link>
              </div>
            ))}
          </HorizontalScroll>
        </FadeInSection>
      </div>
    </section>
  );
}
