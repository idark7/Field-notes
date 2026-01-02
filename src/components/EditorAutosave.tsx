"use client";

import { useEffect, useRef, useState } from "react";

type EditorAutosaveProps = {
  draftKey: string;
  fallbackDraftKeys?: string[];
  actions?: React.ReactNode;
};

export function EditorAutosave({ draftKey, fallbackDraftKeys = [], actions }: EditorAutosaveProps) {
  const storageKey = `gdt-draft-${draftKey}`;
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    let saved = localStorage.getItem(storageKey);
    if (!saved && fallbackDraftKeys.length > 0) {
      for (const key of fallbackDraftKeys) {
        const legacy = localStorage.getItem(`gdt-draft-${key}`);
        if (legacy) {
          saved = legacy;
          localStorage.setItem(storageKey, legacy);
          break;
        }
      }
    }
    if (!saved) return;

    try {
      const data = JSON.parse(saved);
      Object.entries(data.values || {}).forEach(([key, value]) => {
        const field = document.querySelector(`[data-autosave="${key}"]`) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | null;
        if (field && typeof value === "string") {
          field.value = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      if (data.lastSaved) {
        setLastSaved(new Date(data.lastSaved).toLocaleTimeString());
      }
    } catch {
      // ignore invalid cache
    }

    const handler = (event?: Event) => {
      const target = event?.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (target?.tagName === "INPUT" && (target as HTMLInputElement).type === "file") {
        return;
      }
      const values: Record<string, string> = {};
      document.querySelectorAll("[data-autosave]").forEach((node) => {
        const element = node as HTMLInputElement | HTMLTextAreaElement;
        const key = element.getAttribute("data-autosave");
        if (key) {
          values[key] = element.value;
        }
      });
      const payload = { values, lastSaved: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setLastSaved(new Date(payload.lastSaved).toLocaleTimeString());
      if (!autoSaveEnabled) return;
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(async () => {
        try {
          setSaving(true);
          setSaveError("");
          const form = document.getElementById("editor-form") as HTMLFormElement | null;
          const postInput = form?.querySelector<HTMLInputElement>('input[name="postId"]');
          const response = await fetch("/api/editor/autosave", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postId: postInput?.value || "",
              title: values.title || "",
              excerpt: values.excerpt || "",
              content: values.content || "",
              metaTitle: values.metaTitle || "",
              metaDesc: values.metaDesc || "",
              tags: values.tags || "",
              categories: values.categories || "",
            }),
          });
          if (!response.ok) {
            throw new Error("Unable to autosave.");
          }
          const data = (await response.json()) as { postId?: string };
          if (data.postId && postInput) {
            postInput.value = data.postId;
          }
        } catch (error) {
          setSaveError(error instanceof Error ? error.message : "Autosave failed.");
        } finally {
          setSaving(false);
        }
      }, 700);
    };

    const interval = window.setInterval(handler, 10000);
    document.addEventListener("input", handler);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("input", handler);
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [storageKey, fallbackDraftKeys.join("|"), autoSaveEnabled]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
        <span>
          {autoSaveEnabled ? (lastSaved ? `Saved ${lastSaved}` : "Autosave enabled") : "Autosave paused"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoSaveEnabled((value) => !value)}
            className="rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.25em]"
            style={{
              borderColor: autoSaveEnabled ? "var(--accent)" : "var(--border-gray)",
              color: autoSaveEnabled ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {autoSaveEnabled ? "Auto-save on" : "Auto-save off"}
          </button>
          {actions}
        </div>
      </div>
      {saveError ? (
        <p className="text-xs text-red-700">{saveError}</p>
      ) : null}
      {saving && autoSaveEnabled ? (
        <div className="editor-saving-overlay">
          <div className="editor-saving-panel">Saving. Blocking everything.</div>
        </div>
      ) : null}
    </>
  );
}
