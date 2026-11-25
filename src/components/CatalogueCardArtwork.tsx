import HeroImage from '@/components/ui/HeroImage';
import { cn } from '@/lib/utils';
import { artworkKind } from '@/lib/utils/artwork';

interface CatalogueCardArtworkProps {
  image: string | null;
  imageKind?: 'cover' | 'artwork';
  layout: 'portrait' | 'landscape';
  priority?: boolean;
}

export function OrientedCardImage({ image, imageKind, layout, priority, alt = '', sizes, className, alternate, fallbackClassName }:
  CatalogueCardArtworkProps & { alt?: string; sizes: string; className?: string; alternate?: string; fallbackClassName?: string }) {
  const portrait = layout === 'portrait';
  const kind = imageKind ?? artworkKind(image);
  const contained = kind ? (kind === 'cover') !== portrait : false;
  return (
    <>
      {contained && image && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-50">
          <HeroImage src={image} alt="" sizes={sizes} className="scale-110 blur-xl" fallback={<span />} />
        </div>
      )}
      <HeroImage
        src={image ?? ''}
        alt={alt}
        alternate={alternate}
        fallbackClassName={fallbackClassName}
        priority={priority}
        sizes={sizes}
        fit={contained ? 'contain' : 'cover'}
        className={cn(contained ? 'p-1' : 'motion-safe:group-hover:scale-[1.03] motion-safe:transition-transform duration-200', className)}
      />
    </>
  );
}

export default function CatalogueCardArtwork(props: CatalogueCardArtworkProps & { sizes?: string }) {
  const portrait = props.layout === 'portrait';
  return (
    <div className={cn('relative overflow-hidden border-b border-border bg-surface-2', portrait ? 'aspect-[3/4]' : 'aspect-video')}>
      <OrientedCardImage {...props} sizes={props.sizes ?? '(max-width: 639px) 240px, (max-width: 1023px) 288px, 320px'} />
    </div>
  );
}

export function CatalogueCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface" aria-hidden="true">
      <div className="aspect-video border-b border-border bg-surface-2 motion-safe:animate-pulse" />
      <div className="grid gap-2 p-2.5 sm:p-3">
        <div className="h-10 w-4/5 rounded bg-surface-2 motion-safe:animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-surface-2 motion-safe:animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-surface-2 motion-safe:animate-pulse" />
        <div className="h-3 w-1/3 rounded bg-surface-2 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
