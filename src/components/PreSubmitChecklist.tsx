"use client";

import { useEffect, useState } from "react";

type PreSubmitChecklistProps = {
  formId: string;
  buttonLabel?: string;
};

type ChecklistItem = {
  label: string;
  ok: boolean;
};

function getChecklist(): ChecklistItem[] {
  const title = (document.getElementById("editor-title") as HTMLInputElement | null)?.value || "";
  const metaTitle = (document.getElementById("editor-meta-title") as HTMLInputElement | null)?.value || "";
  const metaDesc = (document.getElementById("editor-meta-desc") as HTMLInputElement | null)?.value || "";
  const tags = (document.getElementById("editor-tags") as HTMLInputElement | null)?.value || "";
  const categories = (document.getElementById("editor-categories") as HTMLInputElement | null)?.value || "";
  const content =
    (document.querySelector('[data-autosave="content"]') as HTMLInputElement | null)?.value || "";
  const mediaPreviewRaw =
    (document.querySelector('input[name="mediaPreview"]') as HTMLInputElement | null)?.value || "";

  let mediaAltOk = true;
  let mediaFilesOk = true;
  try {
    const blocks = JSON.parse(content);
    if (Array.isArray(blocks)) {
      let previewMap: Record<string, { url: string; persistedId?: string }[]> = {};
      if (mediaPreviewRaw) {
        try {
          previewMap = JSON.parse(mediaPreviewRaw) as Record<string, { url: string; persistedId?: string }[]>;
        } catch {
          previewMap = {};
        }
      }
      const mediaBlocks = blocks.filter((block) => block.type === "media" || block.type === "background");
      const galleryBlocks = blocks.filter((block) => block.type === "gallery");
      const mediaOk = mediaBlocks.every((block) => block.altText && block.altText.trim().length > 0);
      const galleryOk = galleryBlocks.every((block) =>
        (block.galleryItems || []).every((item: { altText?: string }) => item.altText && item.altText.trim().length > 0)
      );
      mediaAltOk = mediaOk && galleryOk;
      mediaFilesOk = mediaBlocks.every((block) => {
        const items = previewMap[block.id] || [];
        if (items.length === 0) return false;
        return items.every((item) => item.persistedId);
      });
      mediaFilesOk = mediaFilesOk
        && galleryBlocks.every((block) => {
          const expected = (block.galleryItems || []).length;
          if (expected === 0) return true;
          const items = previewMap[block.id] || [];
          if (items.length < expected) return false;
          return items.every((item) => item.persistedId);
        });
    }
  } catch {
    mediaAltOk = true;
    mediaFilesOk = true;
  }

  return [
    { label: "Title", ok: title.trim().length > 0 },
    { label: "Meta title", ok: metaTitle.trim().length > 0 },
    { label: "Meta description", ok: metaDesc.trim().length > 0 },
    { label: "Tags", ok: tags.trim().length > 0 },
    { label: "Categories", ok: categories.trim().length > 0 },
    { label: "Media files attached", ok: mediaFilesOk },
    { label: "Alt text for media", ok: mediaAltOk },
  ];
}

export function PreSubmitChecklist({ formId, buttonLabel = "Submit for Review" }: PreSubmitChecklistProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadBlocked, setUploadBlocked] = useState(false);
  const [mediaMissing, setMediaMissing] = useState(false);
  const hasWarnings = items.some((item) => !item.ok);
  const mediaFilesOk = items.find((item) => item.label === "Media files attached")?.ok ?? true;

  useEffect(() => {
    const readStatus = () => {
      const value = (document.getElementById("editor-upload-status") as HTMLInputElement | null)?.value;
      setUploading(value === "uploading");
    };
    readStatus();
    const interval = window.setInterval(readStatus, 600);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!uploading) {
      setUploadBlocked(false);
    }
  }, [uploading]);

  useEffect(() => {
    if (mediaFilesOk) {
      setMediaMissing(false);
    }
  }, [mediaFilesOk]);

  function handleSubmit(event: React.MouseEvent<HTMLButtonElement>) {
    if (submitting) return;
    if (uploading) {
      event.preventDefault();
      setUploadBlocked(true);
      return;
    }
    const next = getChecklist();
    setItems(next);
    const nextMediaOk = next.find((item) => item.label === "Media files attached")?.ok ?? true;
    if (!nextMediaOk) {
      event.preventDefault();
      setMediaMissing(true);
      setOpen(true);
      return;
    }
    const allOk = next.every((item) => item.ok);
    if (!allOk) {
      event.preventDefault();
      setOpen(true);
      return;
    }

    const form = document.getElementById(formId) as HTMLFormElement | null;
    setSubmitting(true);
    form?.requestSubmit();
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={handleSubmit}
        className="bg-[color:var(--accent)] text-white px-4 py-3 rounded-lg text-sm font-semibold"
        disabled={submitting || uploading}
        aria-busy={submitting || uploading}
        style={submitting || uploading ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
      >
        <span className="inline-flex items-center gap-2">
          {submitting ? (
            <span
              className="page-loading-spinner"
              style={{ borderColor: "rgba(255,255,255,0.4)", borderTopColor: "#ffffff" }}
            />
          ) : null}
          <span>{submitting ? "Submitting..." : uploading ? "Waiting for uploads..." : buttonLabel}</span>
        </span>
      </button>
      {uploading ? (
        <p className="text-xs text-[color:var(--muted)]">
          Media uploads are still processing. Please wait before submitting.
        </p>
      ) : null}
      {uploadBlocked ? (
        <p className="text-xs text-red-700">Finish uploads before submitting your story.</p>
      ) : null}
      {mediaMissing ? (
        <p className="text-xs text-red-700">Attach all media files before submitting.</p>
      ) : null}

      {open ? (
        <div className="editor-panel-card">
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>
            Pre-submit checklist
          </p>
          <div className="mt-3 grid gap-2 text-sm">
            {items.map((item) => (
              <div key={item.label} className={item.ok ? "" : "text-red-700"} style={{ color: item.ok ? 'var(--text-muted)' : undefined }}>
                {item.ok ? "✓" : "•"} {item.label}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
              style={{ borderColor: 'var(--border-gray)', color: 'var(--text-secondary)' }}
              disabled={submitting}
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => {
                if (!mediaFilesOk) {
                  setMediaMissing(true);
                  return;
                }
                const form = document.getElementById(formId) as HTMLFormElement | null;
                setSubmitting(true);
                form?.requestSubmit();
              }}
              className="bg-[color:var(--accent)] text-white px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
              disabled={submitting || !mediaFilesOk}
              aria-busy={submitting}
              style={submitting ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
            >
              <span className="inline-flex items-center gap-2">
                {submitting ? (
                  <span
                    className="page-loading-spinner"
                    style={{ borderColor: "rgba(255,255,255,0.4)", borderTopColor: "#ffffff" }}
                  />
                ) : null}
                <span>{submitting ? "Submitting..." : hasWarnings ? "Submit anyway" : "Submit"}</span>
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
