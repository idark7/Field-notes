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
  const isAdmin = role === "ADMIN";
  const primaryLabel = isAdmin ? "Publish" : "Submit for review";

  const statusValue = useMemo(
    () => (isAdmin ? "APPROVED" : "PENDING"),
    [isAdmin]
  );

  const hasRequiredMissing = validations.some((item) => item.required && !item.ok);

  const submitForm = (status: string) => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const statusInput = form.querySelector<HTMLInputElement>('input[name="status"]');
    if (statusInput) {
      statusInput.value = status;
    }
    form.requestSubmit();
  };

  return (
    <>
      <EditorAutosave
        draftKey={draftKey}
        fallbackDraftKeys={fallbackDraftKeys}
        actions={
          <>
            <button
              type="button"
              className="editor-publish-button editor-publish-secondary"
              onClick={() => submitForm("DRAFT")}
            >
              Save draft
            </button>
            <button
              type="button"
              className="editor-publish-button editor-publish-primary"
              onClick={() => {
                setValidations(collectValidations(formId));
                setShowModal(true);
              }}
            >
              {primaryLabel}
            </button>
          </>
        }
      />

      {showModal ? (
        <div className="editor-publish-modal">
          <div className="editor-publish-backdrop" onClick={() => setShowModal(false)} />
          <div className="editor-publish-panel" role="dialog" aria-modal="true">
            <div className="editor-publish-header">
              <h3>Ready to {primaryLabel.toLowerCase()}?</h3>
              <button type="button" onClick={() => setShowModal(false)} className="editor-publish-close">
                ×
              </button>
            </div>
            <p className="editor-publish-subtitle">Complete the required fields before you submit.</p>
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
                className={`editor-publish-primary ${hasRequiredMissing ? "is-disabled" : ""}`}
                onClick={() => {
                  if (hasRequiredMissing) return;
                  submitForm(statusValue);
                }}
                title={hasRequiredMissing ? "Mandatory fields missing" : undefined}
                aria-disabled={hasRequiredMissing}
              >
                {primaryLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
