"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Resilient hero image component.
 * Uses next/image for optimization when the domain is whitelisted.
 * Falls back to a raw <img> tag if next/image fails (e.g. unknown domain).
 * This lets admins set arbitrary header image URLs without breaking the hero.
 */
export default function HeroImage({
  src,
  alt,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const [useFallback, setUseFallback] = useState(false);

  if (useFallback) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={alt}
        className={cn("absolute inset-0 w-full h-full object-cover", className)}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={cn("object-cover", className)}
      sizes="100vw"
      priority={priority}
      quality={85}
      onError={() => setUseFallback(true)}
    />
  );
}
