"use client";

import { useMemo, useState } from "react";
import { EditorAutosave } from "@/components/EditorAutosave";

type ValidationItem = {
  label: string;
  ok: boolean;
  helper?: string;
  required?: boolean;
};

type AdvancedPublishBarProps = {
  role: string;
  formId: string;
  draftKey: string;
  fallbackDraftKeys?: string[];
};

function collectValidations(formId: string): ValidationItem[] {
  const form = document.getElementById(formId) as HTMLFormElement | null;
  const getValue = (key: string) =>
    (form?.querySelector(`[data-autosave="${key}"]`) as HTMLInputElement | HTMLTextAreaElement | null)?.value || "";

  const title = getValue("title").trim();
  const content = getValue("content").trim();
  const contentText = content.replace(/<[^>]*>/g, "").trim();
  const metaTitle = getValue("metaTitle").trim();
  const metaDesc = getValue("metaDesc").trim();
  const tags = getValue("tags").trim();
  const categories = getValue("categories").trim();

  const metaTitleOk = metaTitle.length > 0 && metaTitle.length <= 60;
  const metaDescOk = metaDesc.length > 0 && metaDesc.length <= 160;

  return [
    { label: "Title", ok: Boolean(title), helper: title ? "OK" : "Missing", required: true },
    { label: "Content", ok: Boolean(contentText), helper: contentText ? "OK" : "Missing", required: true },
    {
      label: "Meta title",
      ok: metaTitleOk,
      helper: metaTitle ? (metaTitle.length > 60 ? `Too long (${metaTitle.length}/60)` : `${metaTitle.length}/60`) : "Missing",
      required: true,
    },
    {
      label: "Meta description",
      ok: metaDescOk,
      helper: metaDesc ? (metaDesc.length > 160 ? `Too long (${metaDesc.length}/160)` : `${metaDesc.length}/160`) : "Missing",
      required: true,
    },
    { label: "Tags", ok: true, helper: tags ? "Optional" : "Optional", required: false },
    { label: "Categories", ok: true, helper: categories ? "Optional" : "Optional", required: false },
  ];
}

export function AdvancedPublishBar({ role, formId, draftKey, fallbackDraftKeys = [] }: AdvancedPublishBarProps) {
  const [showModal, setShowModal] = useState(false);
  const [validations, setValidations] = useState<ValidationItem[]>([]);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const isAdmin = role === "ADMIN";
  const primaryLabel = isAdmin ? "Ready for Review" : "Ready for Review";

  const statusValue = useMemo(() => (isAdmin ? "PENDING" : "PENDING"), [isAdmin]);

  const collectPayload = () => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    const values: Record<string, string> = {};
    if (!form) return values;
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-autosave]").forEach((el) => {
      const key = el.getAttribute("data-autosave");
      if (key) {
        values[key] = el.value;
      }
    });
    return values;
  };

  const saveStatus = async (status: string) => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const statusInput = form.querySelector<HTMLInputElement>('input[name="status"]');
    const postInput = form.querySelector<HTMLInputElement>('input[name="postId"]');
    if (statusInput) statusInput.value = status;
    setSavingStatus(true);
    setStatusError("");
    try {
      const payload = collectPayload();
      const response = await fetch("/api/editor/autosave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Unable to save draft.");
      }
      const data = (await response.json()) as { postId?: string };
      if (data.postId && postInput) {
        postInput.value = data.postId;
      }
      if (data.postId) {
        const statusResponse = await fetch("/api/editor/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: data.postId, status }),
        });
        if (!statusResponse.ok) {
          throw new Error("Unable to update status.");
        }
      }
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <>
      <EditorAutosave
        draftKey={draftKey}
        fallbackDraftKeys={fallbackDraftKeys}
        actions={({ autoSaveEnabled }) => (
          <>
            <button
              type="button"
              className={`editor-publish-button editor-publish-secondary ${autoSaveEnabled ? "" : "is-attention"} ${savingStatus ? "is-saving" : ""}`}
              onClick={() => saveStatus("DRAFT")}
              disabled={savingStatus}
            >
              {savingStatus ? "Saving..." : "Save as Draft"}
            </button>
            <button
              type="button"
              className={`editor-publish-button editor-publish-primary ${savingStatus ? "is-saving" : ""}`}
              onClick={() => {
                setValidations(collectValidations(formId));
                setShowModal(true);
              }}
              disabled={savingStatus}
            >
              {savingStatus ? "Saving..." : primaryLabel}
            </button>
          </>
        )}
      />
      {statusError ? (
        <p className="text-xs text-red-700">{statusError}</p>
      ) : null}
      {showModal ? (
        <div className="editor-publish-modal">
          <div className="editor-publish-backdrop" onClick={() => setShowModal(false)} />
          <div className="editor-publish-panel" role="dialog" aria-modal="true">
            <div className="editor-publish-header">
              <h3>Ready for review?</h3>
              <button type="button" onClick={() => setShowModal(false)} className="editor-publish-close">
                ×
              </button>
            </div>
            <p className="editor-publish-subtitle">Quick checklist (optional). You can still submit.</p>
            <div className="editor-publish-list">
              {validations.map((item) => (
                <div key={item.label} className={`editor-publish-row ${item.ok ? "is-ok" : "is-warn"}`}>
                  <span>{item.label}</span>
                  <span className="editor-publish-helper">
                    {item.ok ? `✓ ${item.helper ?? "OK"}` : item.helper ?? "Missing"}
                  </span>
                </div>
              ))}
            </div>
            <div className="editor-publish-actions">
              <button type="button" className="editor-publish-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={`editor-publish-primary ${savingStatus ? "is-saving" : ""}`}
                onClick={async () => {
                  await saveStatus(statusValue);
                  setShowModal(false);
                }}
                disabled={savingStatus}
              >
                {savingStatus ? "Saving..." : "Ready for Review"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
