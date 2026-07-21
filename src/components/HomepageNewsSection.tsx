"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { getGXPopularNews, getGXNewsFeed } from "@/lib/api";
import { cn } from "@/lib/utils";
import FadeInSection from "@/components/FadeInSection";
import SectionHeader from "@/components/SectionHeader";
import LazySection from "@/components/LazySection";
import HeroImage from "@/components/ui/HeroImage";
import SafeImage from "@/components/ui/SafeImage";
import { Newspaper } from "lucide-react";

export default function HomepageNewsSection() {
  const [newsExpanded, setNewsExpanded] = useState(false);

  const gxNews = useQuery({
    queryKey: ["gx-news-merged"],
    queryFn: async () => {
      const results = await Promise.allSettled([getGXPopularNews(), getGXNewsFeed()]);
      const available = results
        .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof getGXPopularNews>>> => result.status === "fulfilled")
        .map((result) => result.value);
      if (available.length === 0) {
        throw new Error("Gaming news is temporarily unavailable.");
      }
      const [popular = [], feed = []] = available;
      const seen = new Set<string>();
      const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
      const merged = [] as typeof popular;
      for (const article of [...popular, ...feed]) {
        const key = normalize(article.title);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(article);
        }
        if (merged.length >= 12) break;
      }
      return merged;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
  });

  if (!gxNews.data || gxNews.data.length === 0) {
    return null;
  }

  const featured = gxNews.data.slice(0, 2);
  const rest = gxNews.data.slice(2, 12);

  return (
    <LazySection minHeight="300px">
      <section className="py-12">
        <div className="max-w-[1400px] mx-auto px-4">
          <FadeInSection>
            <SectionHeader
              title="Gaming News"
              icon={<Newspaper className="w-5 h-5" />}
              subtitle="Trending stories from top gaming outlets"
              gradient="linear-gradient(90deg, #14b8a6 0%, #06b6d4 25%, #3b82f6 50%, #06b6d4 75%, #14b8a6 100%)"
              href="/news"
              linkLabel="View all news"
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className={`lg:col-span-5 ${featured.length === 1 ? "flex items-center" : "space-y-4"}`}>
                {featured.map((article, index) => (
                  <motion.div
                    key={article.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/30 transition-all"
                    >
                      <div className="relative aspect-video overflow-hidden">
                        {article.image ? (
                          <HeroImage
                            src={article.image}
                            alt={article.title}
                            sizes="(max-width: 1024px) 100vw, 40vw"
                            className="group-hover:scale-105 transition-transform duration-500"
                            fallbackClassName="bg-surface-2"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-accent/20 to-pixel-cyan/20 flex items-center justify-center">
                            <Newspaper className="w-8 h-8 text-accent/60" />
                          </div>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <h3 className="text-base font-bold text-foreground line-clamp-2 group-hover:text-accent transition-colors">
                          {article.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          {article.publisherFavicon && (
                            <SafeImage
                              src={article.publisherFavicon}
                              alt=""
                              width={14}
                              height={14}
                              className="rounded-sm"
                            />
                          )}
                          <span className="text-xs text-tertiary">{article.publisherName}</span>
                        </div>
                      </div>
                    </a>
                  </motion.div>
                ))}
              </div>

              {rest.length > 0 && (
                <div className={cn("lg:col-span-7 space-y-2 lg:max-h-none overflow-hidden transition-all duration-300", newsExpanded ? "max-h-none" : "max-h-[320px]")}>
                  {rest.map((article, index) => (
                    <motion.a
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.3 }}
                      className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5 hover:border-accent/30 hover:bg-surface-2 transition-all"
                    >
                      <div className="relative w-20 h-14 shrink-0 rounded-lg overflow-hidden">
                        {article.image ? (
                          <HeroImage
                            src={article.image}
                            alt=""
                            sizes="80px"
                            className="object-cover"
                            fallbackClassName="bg-surface-2"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-accent/10 to-pixel-cyan/10 flex items-center justify-center">
                            <Newspaper className="w-5 h-5 text-accent/60" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-accent transition-colors">
                          {article.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {article.publisherFavicon && (
                            <SafeImage
                              src={article.publisherFavicon}
                              alt=""
                              width={12}
                              height={12}
                              className="rounded-sm"
                            />
                          )}
                          <span className="text-[10px] text-tertiary">{article.publisherName}</span>
                        </div>
                      </div>
                    </motion.a>
                  ))}
                </div>
              )}
              {rest.length > 4 && !newsExpanded && (
                <button
                  onClick={() => setNewsExpanded(true)}
                  className="lg:hidden w-full mt-3 py-2.5 rounded-xl border border-border bg-surface text-sm font-medium text-secondary hover:text-foreground hover:border-accent/30 transition-all"
                >
                  Show more stories
                </button>
              )}
            </div>
          </FadeInSection>
        </div>
      </section>
    </LazySection>
  );
}
