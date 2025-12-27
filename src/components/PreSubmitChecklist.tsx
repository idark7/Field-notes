"use client";

import { useState } from "react";

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

  let mediaAltOk = true;
  try {
    const blocks = JSON.parse(content);
    if (Array.isArray(blocks)) {
      const mediaBlocks = blocks.filter((block) => block.type === "media" || block.type === "background");
      const galleryBlocks = blocks.filter((block) => block.type === "gallery");
      const mediaOk = mediaBlocks.every((block) => block.altText && block.altText.trim().length > 0);
      const galleryOk = galleryBlocks.every((block) =>
        (block.galleryItems || []).every((item: { altText?: string }) => item.altText && item.altText.trim().length > 0)
      );
      mediaAltOk = mediaOk && galleryOk;
    }
  } catch {
    mediaAltOk = true;
  }

  return [
    { label: "Title", ok: title.trim().length > 0 },
    { label: "Meta title", ok: metaTitle.trim().length > 0 },
    { label: "Meta description", ok: metaDesc.trim().length > 0 },
    { label: "Tags", ok: tags.trim().length > 0 },
    { label: "Categories", ok: categories.trim().length > 0 },
    { label: "Alt text for media", ok: mediaAltOk },
  ];
}

export function PreSubmitChecklist({ formId, buttonLabel = "Submit for Review" }: PreSubmitChecklistProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: React.MouseEvent<HTMLButtonElement>) {
    if (submitting) return;
    const next = getChecklist();
    setItems(next);
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
        disabled={submitting}
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
          <span>{submitting ? "Submitting..." : buttonLabel}</span>
        </span>
      </button>

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
                const form = document.getElementById(formId) as HTMLFormElement | null;
                setSubmitting(true);
                form?.requestSubmit();
              }}
              className="bg-[color:var(--accent)] text-white px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
              disabled={submitting}
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
                <span>{submitting ? "Submitting..." : "Submit anyway"}</span>
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
