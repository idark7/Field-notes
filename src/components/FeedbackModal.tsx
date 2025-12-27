"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type FeedbackNote = {
  id: string;
  postId: string;
  postTitle: string;
  status: string;
  note: string;
  revision: number;
  createdAt: string;
};

type FeedbackModalProps = {
  notes: FeedbackNote[];
  className?: string;
  label?: string;
  title?: string;
  eyebrow?: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function FeedbackModal({
  notes,
  className,
  label = "Admin feedback",
  title = "Latest notes on your stories",
  eyebrow = "Admin feedback",
}: FeedbackModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!notes.length) return null;

  return (
    <>
      <button
        type="button"
        className={`feedback-button ${className ?? ""}`}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-panel modal-panel-light feedback-panel" onClick={(event) => event.stopPropagation()}>
            <div className="feedback-header">
              <div>
                <p className="feedback-eyebrow">{eyebrow}</p>
                <h3 className="feedback-title">{title}</h3>
              </div>
              <button type="button" className="feedback-close" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <div className="feedback-list">
              {notes.map((note) => (
                <div key={note.id} className="feedback-card">
                  <div className="feedback-card-header">
                    <div>
                      <p className="feedback-card-title">{note.postTitle}</p>
                      <p className="feedback-card-meta">
                        {formatDate(note.createdAt)} · Version {note.revision} ·{" "}
                        {note.status.replace("_", " ").toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <p className="feedback-card-note">{note.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
