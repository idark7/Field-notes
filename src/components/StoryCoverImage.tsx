"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

type StoryCoverImageProps = {
  src?: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
};

export function StoryCoverImage({ src, alt, className, style }: StoryCoverImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
