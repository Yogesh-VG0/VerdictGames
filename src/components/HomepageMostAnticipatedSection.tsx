import Link from "next/link";
import Image from "next/image";
import { Rocket } from "lucide-react";
import FadeInSection from "@/components/FadeInSection";
import HorizontalScroll from "@/components/HorizontalScroll";
import SectionHeader from "@/components/SectionHeader";
import { formatNumber, getStableYear } from "@/lib/utils";
import type { HomepageAnticipatedGame } from "@/lib/services/homepage";

const MOST_ANTICIPATED_SUBTITLE = "The most hyped upcoming games this year and beyond";

interface HomepageMostAnticipatedSectionProps {
  games: HomepageAnticipatedGame[];
}

export default function HomepageMostAnticipatedSection({
  games,
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
            href="/explore"
            linkLabel="See all"
            icon={<Rocket className="w-5 h-5" />}
            subtitle={MOST_ANTICIPATED_SUBTITLE}
            gradient="linear-gradient(90deg, #06b6d4 0%, #3b82f6 25%, #8b5cf6 50%, #06b6d4 75%, #3b82f6 100%)"
          />
          <HorizontalScroll>
            {games.map((game, index) => (
              <div key={game.rawgId} className="shrink-0 w-64 sm:w-72 md:w-80 h-full">
                <Link href={`/game/${game.slug}?rawgId=${game.rawgId}`} prefetch={false} className="block group">
                  <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-border bg-surface-2 group-hover:border-accent/40 transition-all">
                    {game.image ? (
                      <Image
                        src={game.image}
                        alt={game.name}
                        fill
                        sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 320px"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        priority={index < 2}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-accent/10 to-pixel-cyan/10" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-8">
                      <p className="text-sm font-bold text-white line-clamp-1 drop-shadow-lg">{game.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {game.genres.slice(0, 2).map((genre, genreIndex) => (
                          <span key={genre} className="text-[10px] text-white/60">
                            {genreIndex > 0 && <span className="mr-1">·</span>}
                            {genre}
                          </span>
                        ))}
                        <span className="ml-auto text-[10px] font-medium">
                          {game.tba ? (
                            <span className="text-yellow-400">TBA</span>
                          ) : game.released ? (
                            <span className="text-white/50">{getStableYear(game.released)}</span>
                          ) : null}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 px-1 text-[10px] text-secondary">
                    <span className="text-accent font-medium">{formatNumber(game.added)} wishlisted</span>
                    {game.toplay > 0 && <span>{formatNumber(game.toplay)} want</span>}
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
