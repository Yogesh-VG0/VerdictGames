"use client";

import Link from "next/link";
import FadeInSection from "@/components/FadeInSection";
import { SHARED_NAV_DESTINATIONS, SHARED_NAV_LABELS } from "@/lib/shared-nav";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="max-w-[1400px] mx-auto px-4 py-12">
        <FadeInSection>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <p className="text-lg font-bold">
                <span className="gradient-text">VERDICT</span>
                <span className="text-secondary font-light">.games</span>
              </p>
              <p className="text-xs text-tertiary mt-2 leading-relaxed">
                Your trusted source for honest game verdicts. Data-driven reviews powered by 7 sources.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Browse</h4>
              <ul className="space-y-2 text-sm text-tertiary">
                <li><Link href="/search?sort=trending" className="hover:text-accent transition-colors">Trending</Link></li>
                <li><Link href="/search?sort=newest" className="hover:text-accent transition-colors">New Releases</Link></li>
                <li><Link href="/search?sort=top-rated" className="hover:text-accent transition-colors">Top Rated</Link></li>
                <li><Link href={SHARED_NAV_DESTINATIONS.deals} className="hover:text-accent transition-colors">{SHARED_NAV_LABELS.deals}</Link></li>
                <li><Link href={SHARED_NAV_DESTINATIONS.freeToPlay} className="hover:text-accent transition-colors">{SHARED_NAV_LABELS.freeToPlay}</Link></li>
                <li><Link href="/calendar" className="hover:text-accent transition-colors">Upcoming</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Platforms</h4>
              <ul className="space-y-2 text-sm text-tertiary">
                <li><Link href="/search?platform=PC" className="hover:text-accent transition-colors">PC</Link></li>
                <li><Link href="/search?platform=PlayStation+5" className="hover:text-accent transition-colors">PlayStation 5</Link></li>
                <li><Link href="/search?platform=Xbox+Series+X%7CS" className="hover:text-accent transition-colors">Xbox Series X|S</Link></li>
                <li><Link href="/search?platform=Nintendo+Switch" className="hover:text-accent transition-colors">Nintendo Switch</Link></li>
                <li><Link href="/search?platform=Android" className="hover:text-accent transition-colors">Android</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">About</h4>
              <ul className="space-y-2 text-sm text-tertiary">
                <li><Link href="/about" className="hover:text-accent transition-colors">About Us</Link></li>
                <li><Link href="/reviews" className="hover:text-accent transition-colors">Community Reviews</Link></li>
                <li><Link href="/compare" className="hover:text-accent transition-colors">Compare Games</Link></li>
                <li><Link href="/privacy" className="hover:text-accent transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-accent transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-tertiary">
              &copy; {new Date().getFullYear()} verdict.games &mdash; Data from RAWG, Steam, IGDB, CheapShark, Wikipedia, HLTB &amp; GX Corner.
            </p>
            <p className="text-[10px] text-tertiary">
              All game titles, trademarks, and copyrights belong to their respective owners.
            </p>
          </div>
        </FadeInSection>
      </div>
    </footer>
  );
}
