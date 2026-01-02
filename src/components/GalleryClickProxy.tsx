"use client";

import { PropsWithChildren, useRef } from "react";

type GalleryClickProxyProps = PropsWithChildren<{
  className?: string;
}>;

export function GalleryClickProxy({ className, children }: GalleryClickProxyProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className={className}
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target.closest(".lightbox-trigger")) {
          return;
        }
        const trigger = containerRef.current?.querySelector<HTMLButtonElement>(".lightbox-trigger");
        trigger?.click();
      }}
    >
      {children}
    </div>
  );
}
