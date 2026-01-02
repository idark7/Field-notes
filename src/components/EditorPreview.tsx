"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderInlineText } from "@/lib/inlineFormat";
import { sanitizeRichText } from "@/lib/sanitize";
import { RichTextGalleryLightbox } from "@/components/RichTextGalleryLightbox";
import type { Block } from "@/components/BlockEditor";

type EditorPreviewProps = {
  formId: string;
};

type PreviewState = {
  title: string;
  excerpt: string;
  blocks: Block[];
  rawContent: string;
  mediaByBlock: Record<string, MediaPreviewItem[]>;
};

type MediaPreviewItem = {
  url: string;
  isVideo: boolean;
  fileName: string;
};

const VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "mov", "webm", "ogv", "ogg"]);
const DEFAULT_COVER_HEIGHT = 420;

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function isVideoName(fileName: string) {
  return VIDEO_EXTENSIONS.has(getFileExtension(fileName));
}

function parseBlocks(raw: string): Block[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Block[]) : [];
  } catch {
    return [];
  }
}

function buildPreviewState(formId: string): { state: PreviewState; urls: string[] } {
  const form = document.getElementById(formId);
  const titleInput = form?.querySelector<HTMLInputElement>("#editor-title");
  const excerptInput = form?.querySelector<HTMLInputElement>("#editor-excerpt");
  const contentInput = form?.querySelector<HTMLInputElement>("input[name=content]");
  const mediaPreviewInput = form?.querySelector<HTMLInputElement>('input[name="mediaPreview"]');
  const title = titleInput?.value?.trim() || "Untitled field note";
  const excerpt = excerptInput?.value?.trim() || "";
  const rawContent = contentInput?.value || "";
  const mediaByBlock: Record<string, MediaPreviewItem[]> = {};
  const urls: string[] = [];

  if (mediaPreviewInput?.value) {
    try {
      const parsed = JSON.parse(mediaPreviewInput.value) as Record<
        string,
        { url: string; isVideo: boolean; fileName?: string; persistedId?: string }[]
      >;
      Object.entries(parsed).forEach(([blockId, items]) => {
        if (!Array.isArray(items) || items.length === 0) return;
        mediaByBlock[blockId] = items.map((item) => ({
          url: item.url,
          isVideo: item.isVideo,
          fileName: item.fileName ?? "",
        }));
        items.forEach((item) => urls.push(item.url));
      });
    } catch {
      // ignore parsing errors and fallback to file inputs
    }
  }

  if (Object.keys(mediaByBlock).length === 0) {
    const mediaInputs = form?.querySelectorAll<HTMLInputElement>('input[name="mediaFiles"][data-block-id]');
    mediaInputs?.forEach((input) => {
      const blockId = input.dataset.blockId;
      if (!blockId || !input.files || input.files.length === 0) return;
      const items = Array.from(input.files).map((file) => {
        const url = URL.createObjectURL(file);
        urls.push(url);
        return {
          url,
          isVideo: file.type.startsWith("video") || isVideoName(file.name),
          fileName: file.name,
        };
      });
      mediaByBlock[blockId] = items;
    });
  }

  return {
    state: {
      title,
      excerpt,
      rawContent,
      blocks: parseBlocks(rawContent),
      mediaByBlock,
    },
    urls,
  };
}

export function EditorPreview({ formId }: EditorPreviewProps) {
  const [open, setOpen] = useState(false);
  const previewUrls = useRef<string[]>([]);
  const [preview, setPreview] = useState<PreviewState>({
    title: "Untitled field note",
    excerpt: "",
    blocks: [],
    rawContent: "",
    mediaByBlock: {},
  });

  const coverBlock = preview.blocks.find((block) => block.type === "background");
  const coverMedia = coverBlock?.id ? preview.mediaByBlock[coverBlock.id]?.[0] : undefined;
  const coverHeight = coverBlock
    ? typeof coverBlock?.height === "number"
      ? coverBlock.height
      : DEFAULT_COVER_HEIGHT
    : undefined;

  useEffect(() => {
    if (!open) return;
    const updatePreview = () => {
      const next = buildPreviewState(formId);
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current = next.urls;
      setPreview(next.state);
    };
    updatePreview();
    const form = document.getElementById(formId);
    let rafId = 0;
    const scheduleUpdate = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(updatePreview);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    form?.addEventListener("input", scheduleUpdate);
    form?.addEventListener("change", scheduleUpdate);
    const interval = window.setInterval(scheduleUpdate, 1500);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current = [];
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.clearInterval(interval);
      form?.removeEventListener("input", scheduleUpdate);
      form?.removeEventListener("change", scheduleUpdate);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, formId]);

  const renderedBlocks = useMemo(() => {
    const blocksToRender = coverBlock
      ? preview.blocks.filter((block) => block.type !== "background")
      : preview.blocks;
    if (!preview.rawContent && blocksToRender.length === 0) {
      return <p className="preview-muted">Start writing to see the preview.</p>;
    }

    if (!blocksToRender.length && preview.rawContent) {
      const isHtml = preview.rawContent.trim().startsWith("<");
      if (isHtml) {
        return (
          <RichTextGalleryLightbox
            className="tiptap-content"
            html={sanitizeRichText(preview.rawContent)}
          />
        );
      }
      return <p className="preview-paragraph">{renderInlineText(preview.rawContent)}</p>;
    }

    return blocksToRender.map((block, index) => {
      const key = block.id || `${block.type}-${index}`;
      if (block.type === "heading") {
        const level = block.level === "h1" || block.level === "h3" ? block.level : "h2";
        const HeadingTag = level === "h1" ? "h1" : level === "h3" ? "h3" : "h2";
        return (
          <HeadingTag key={key} className={`preview-${level}`}>
            {renderInlineText(block.text ?? "")}
          </HeadingTag>
        );
      }

      if (block.type === "quote") {
        return (
          <blockquote key={key} className="preview-quote">
            {renderInlineText(block.text ?? "")}
          </blockquote>
        );
      }

      if (block.type === "list") {
        return (
          <ul key={key} className="preview-list">
            {(block.items || []).map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`}>{renderInlineText(item)}</li>
            ))}
          </ul>
        );
      }

      if (block.type === "divider") {
        return <hr key={key} className="preview-divider" />;
      }

      if (block.type === "media") {
        const previewItems = block.id ? preview.mediaByBlock[block.id] : undefined;
        const previewItem = previewItems?.[0];
        const mediaHeight =
          typeof block.height === "number" ? { minHeight: `${block.height}px` } : undefined;
        return (
          <div key={key} className="preview-media">
            <div className="preview-media-frame" style={mediaHeight}>
              {previewItem ? (
                previewItem.isVideo ? (
                  <video controls className="preview-media-asset">
                    <source src={previewItem.url} />
                  </video>
                ) : (
                  <img src={previewItem.url} alt={block.altText || "Preview media"} className="preview-media-asset" />
                )
              ) : (
                "Media block"
              )}
            </div>
            <p className="preview-media-text">
              {previewItem
                ? `Selected: ${previewItem.fileName}`
                : block.mediaFileName
                  ? `Selected: ${block.mediaFileName}`
                  : "Upload an image or video to preview it."}
            </p>
            {block.caption ? <p className="preview-caption">{block.caption}</p> : null}
          </div>
        );
      }

      if (block.type === "gallery") {
        const previewItems = block.id ? preview.mediaByBlock[block.id] : undefined;
        const count = block.galleryItems?.length || 3;
        return (
          <div key={key} className="preview-media">
            <div className="preview-gallery">
              {previewItems && previewItems.length > 0
                ? previewItems.map((item, itemIndex) => (
                    <div key={`${key}-gallery-${itemIndex}`} className="preview-gallery-item">
                      {item.isVideo ? (
                        <video className="preview-gallery-asset" controls>
                          <source src={item.url} />
                        </video>
                      ) : (
                        <img src={item.url} alt={`Gallery ${itemIndex + 1}`} className="preview-gallery-asset" />
                      )}
                    </div>
                  ))
                : Array.from({ length: count }).map((_, itemIndex) => (
                    <div key={`${key}-gallery-${itemIndex}`} className="preview-gallery-card">
                      Gallery item
                    </div>
                  ))}
            </div>
            <p className="preview-media-text">Upload images to populate the gallery.</p>
          </div>
        );
      }

      if (block.type === "background") {
        const previewItems = block.id ? preview.mediaByBlock[block.id] : undefined;
        const previewItem = previewItems?.[0];
        const mediaHeight =
          typeof block.height === "number" ? { height: `${block.height}px` } : undefined;
        return (
          <section key={key} className="preview-background" style={mediaHeight}>
            {previewItem ? (
              previewItem.isVideo ? (
                <video className="preview-background-media" autoPlay muted loop playsInline>
                  <source src={previewItem.url} />
                </video>
              ) : (
                <img src={previewItem.url} alt={block.altText || "Cover preview"} className="preview-background-media" />
              )
            ) : null}
            <div className="preview-background-overlay" />
            <div className="preview-background-content">
              <p className="preview-background-title">
                {block.overlayTitle ? renderInlineText(block.overlayTitle) : "Cover photo block"}
              </p>
              {block.overlayText ? (
                <p className="preview-background-text">{renderInlineText(block.overlayText)}</p>
              ) : null}
              {block.mediaFileName ? (
                <p className="preview-background-meta">Selected: {block.mediaFileName}</p>
              ) : null}
            </div>
          </section>
        );
      }

      return (
        <p key={key} className="preview-paragraph">
          {renderInlineText(block.text ?? "")}
        </p>
      );
    });
  }, [preview]);

  return (
    <>
      <button type="button" className="preview-trigger" onClick={() => setOpen(true)}>
        Preview
      </button>
      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-panel modal-panel-light preview-panel" onClick={(event) => event.stopPropagation()}>
            <div
              className={`preview-hero ${coverBlock ? "preview-hero-covered" : ""}`}
              style={
                coverMedia && !coverMedia.isVideo
                  ? { backgroundImage: `url(${coverMedia.url})`, minHeight: coverHeight }
                  : coverHeight
                    ? { minHeight: coverHeight }
                    : undefined
              }
            >
              {coverMedia?.isVideo ? (
                <video className="preview-hero-media" autoPlay muted loop playsInline>
                  <source src={coverMedia.url} />
                </video>
              ) : null}
              {coverBlock ? <div className="preview-hero-overlay" /> : null}
              <div className="preview-hero-content">
                <div className="preview-header">
                  <div>
                    <p className="preview-eyebrow">Preview mode</p>
                    <h2 className="preview-title">{preview.title}</h2>
                    {preview.excerpt ? <p className="preview-excerpt">{preview.excerpt}</p> : null}
                  </div>
                  <button type="button" className="preview-close" onClick={() => setOpen(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
            <div className="preview-content">
              {renderedBlocks}
              <p className="preview-note">
                Media previews use locally selected files. Upload to see the final hosted media.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
