"use client";

import { useState, type ReactNode } from "react";
import { Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";
import SafeImage from "@/components/ui/SafeImage";
import { isProviderHeroArtwork } from '@/lib/utils/artwork-policy.mjs';
import { igdbHeroImageLoader } from '@/lib/utils/image-loader';

/**
 * Resilient hero image component.
 * Uses next/image for optimization when the domain is whitelisted.
 * Falls back to a raw <img> tag if next/image fails (e.g. unknown domain).
 * This lets admins set arbitrary header image URLs without breaking the hero.
 */
type HeroImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
  alternate?: string;
  className?: string;
  sizes?: string;
  fit?: 'cover' | 'contain';
  fallback?: ReactNode;
  fallbackClassName?: string;
};

function HeroImageContent({
  src,
  alt,
  priority = false,
  alternate,
  className,
  sizes = "100vw",
  fit = 'cover',
  fallback,
  fallbackClassName,
}: HeroImageProps) {
  const [useAlternate, setUseAlternate] = useState(false);
  const activeSrc = useAlternate && alternate ? alternate : src;
  if (!src) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent/10 via-surface-2 to-pixel-cyan/10",
          fallbackClassName
        )}
      >
        {fallback ?? <Gamepad2 className="w-8 h-8 text-accent/35" />}
      </div>
    );
  }

  return (
    <SafeImage
      src={activeSrc}
      alt={alt}
      fill
      className={cn("object-cover", className)}
      style={{ objectFit: fit }}
      sizes={sizes}
      preload={priority && !useAlternate}
      loader={activeSrc.startsWith('https://images.igdb.com/') && isProviderHeroArtwork(activeSrc) ? igdbHeroImageLoader : undefined}
      onError={alternate && !useAlternate ? () => setUseAlternate(true) : undefined}
      quality={85}
      fallback={fallback ?? <Gamepad2 className="w-8 h-8 text-accent/35" />}
      fallbackClassName={cn(
        "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent/10 via-surface-2 to-pixel-cyan/10",
        fallbackClassName
      )}
    />
  );
}

export default function HeroImage(props: HeroImageProps) {
  return <HeroImageContent key={props.src} {...props} />;
}
