"use client";

import { useState, type CSSProperties, type ReactNode, type SyntheticEvent } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

type SafeImageProps = ImageProps & {
  fallback?: ReactNode;
  fallbackClassName?: string;
};

function resolveNativeSrc(src: ImageProps["src"]): string {
  if (typeof src === "string") {
    return src;
  }

  if ("src" in src) {
    return src.src;
  }

  return src.default.src;
}

function SafeImageContent({
  src,
  alt,
  className,
  fallback,
  fallbackClassName,
  nativeSrc,
  fill,
  width,
  height,
  loading,
  priority,
  style,
  onLoad,
  onError,
  ...rest
}: SafeImageProps & { nativeSrc: string }) {
  const [useNativeFallback, setUseNativeFallback] = useState(false);
  const [nativeFailed, setNativeFailed] = useState(false);

  if (!nativeSrc || nativeFailed) {
    if (!fallback) {
      return null;
    }

    return (
      <div className={cn(fill ? "absolute inset-0" : undefined, fallbackClassName)}>
        {fallback}
      </div>
    );
  }

  if (useNativeFallback) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={nativeSrc}
        alt={alt}
        width={typeof width === "number" ? width : undefined}
        height={typeof height === "number" ? height : undefined}
        className={cn(fill ? "absolute inset-0 w-full h-full" : undefined, className)}
        loading={priority ? "eager" : loading ?? "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        style={style as CSSProperties | undefined}
        onLoad={(event) => onLoad?.(event)}
        onError={(event) => {
          onError?.(event as unknown as SyntheticEvent<HTMLImageElement, Event>);
          setNativeFailed(true);
        }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      fill={fill}
      width={width}
      height={height}
      loading={loading}
      priority={priority}
      style={style}
      onLoad={onLoad}
      onError={(event) => {
        onError?.(event);
        setUseNativeFallback(true);
      }}
      {...rest}
    />
  );
}

export default function SafeImage(props: SafeImageProps) {
  const nativeSrc = resolveNativeSrc(props.src);

  return <SafeImageContent key={nativeSrc} nativeSrc={nativeSrc} {...props} />;
}
