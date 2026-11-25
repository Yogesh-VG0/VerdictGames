import HeroImage from '@/components/ui/HeroImage';
import { cn } from '@/lib/utils';

interface CatalogueCardArtworkProps {
  image: string | null;
  imageKind?: 'cover' | 'artwork';
  layout: 'portrait' | 'landscape';
  priority?: boolean;
}

export default function CatalogueCardArtwork({ image, imageKind, layout, priority }: CatalogueCardArtworkProps) {
  const portrait = layout === 'portrait';
  const contained = imageKind ? (imageKind === 'cover') !== portrait : false;
  return (
    <div className={cn('relative overflow-hidden border-b border-border bg-surface-2', portrait ? 'aspect-[3/4]' : 'aspect-video')}>
      {contained ? (
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-surface),transparent_85%)]" />
      ) : null}
      <HeroImage
        src={image ?? ''}
        alt=""
        priority={priority}
        sizes={portrait ? '(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1279px) 25vw, 20vw' : '(max-width: 639px) 240px, (max-width: 1023px) 288px, 320px'}
        fit={contained ? 'contain' : 'cover'}
        className={cn(contained ? 'p-2' : 'motion-safe:group-hover:scale-[1.03] motion-safe:transition-transform duration-200')}
      />
    </div>
  );
}

export function CatalogueCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface" aria-hidden="true">
      <div className="aspect-[3/4] border-b border-border bg-surface-2 motion-safe:animate-pulse" />
      <div className="grid gap-2 p-2.5 sm:p-3">
        <div className="h-10 w-4/5 rounded bg-surface-2 motion-safe:animate-pulse" />
        <div className="h-8 w-2/3 rounded bg-surface-2 motion-safe:animate-pulse" />
        <div className="h-12 w-1/2 rounded bg-surface-2 motion-safe:animate-pulse" />
        <div className="h-8 w-3/4 rounded bg-surface-2 motion-safe:animate-pulse" />
        <div className="h-3 w-1/3 rounded bg-surface-2 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
