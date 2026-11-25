import { CatalogueCardSkeleton } from "@/components/CatalogueCardArtwork";
import { EXPLORE_PAGE_SIZE } from "@/lib/utils/explore-filters";

export default function ExploreLoading() {
  return <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 sm:px-6" aria-busy="true">
    <h1 className="text-2xl font-bold text-foreground">Explore Games</h1>
    <p role="status" className="text-sm text-secondary">Finding games…</p>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5" aria-hidden="true">
      {Array.from({ length: EXPLORE_PAGE_SIZE }, (_, index) => <CatalogueCardSkeleton key={index} />)}
    </div>
  </div>;
}
