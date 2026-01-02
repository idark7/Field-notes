"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type GalleryItem = {
  src: string;
  alt: string;
  caption?: string | null;
};

type RichTextGalleryLightboxProps = {
  html: string;
  className?: string;
};

export function RichTextGalleryLightbox({ html, className }: RichTextGalleryLightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  const gallerySignature = useMemo(
    () => (items.length ? items.map((item) => item.src).join("|") : ""),
    [items]
  );

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (items.length < 2) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % items.length);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + items.length) % items.length);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, gallerySignature, items.length]);

  useEffect(() => {
    if (!open) return;
    setAnimating(true);
    const timer = window.setTimeout(() => setAnimating(false), 520);
    return () => window.clearTimeout(timer);
  }, [activeIndex, open]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const gallery = target.closest(".editor-gallery-grid, .tiptap-gallery") as HTMLElement | null;
      if (!gallery) return;
      const figures = Array.from(gallery.querySelectorAll("figure"));
      const nextItems: GalleryItem[] = [];
      let clickedIndex = 0;
      figures.forEach((figure, index) => {
        const img = figure.querySelector("img");
        if (!img || !img.getAttribute("src")) return;
        const caption = figure.querySelector("figcaption")?.textContent?.trim() ?? "";
        nextItems.push({
          src: img.getAttribute("src") ?? "",
          alt: img.getAttribute("alt") ?? "",
          caption,
        });
        if (img === target || img.contains(target as Node)) {
          clickedIndex = nextItems.length - 1;
        }
      });
      if (!nextItems.length) return;
      setItems(nextItems);
      setActiveIndex(clickedIndex);
      setOpen(true);
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, []);

  const activeItem = items[activeIndex];

  return (
    <>
      <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />
      {open && activeItem ? (
        <div className="lightbox-backdrop" onClick={() => setOpen(false)}>
          <div className="lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12" />
                <path d="M18 6l-12 12" />
              </svg>
            </button>
            <img
              src={activeItem.src}
              alt={activeItem.alt}
              className={`lightbox-image ${animating ? "lightbox-swap" : ""}`}
            />
            {items.length > 1 ? (
              <div className="lightbox-thumbs">
                {items.map((item, index) => (
                  <button
                    key={`${item.src}-${index}`}
                    type="button"
                    className={`lightbox-thumb ${index === activeIndex ? "is-active" : ""}`}
                    onClick={() => setActiveIndex(index)}
                  >
                    <img src={item.src} alt={item.alt} />
                  </button>
                ))}
              </div>
            ) : null}
            {activeItem.caption ? <p className="lightbox-caption">{activeItem.caption}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
