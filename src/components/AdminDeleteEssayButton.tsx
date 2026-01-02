"use client";

import { useRef } from "react";
import type { FormEvent } from "react";

type AdminDeleteEssayButtonProps = {
  postId: string;
  action: (formData: FormData) => void;
};

export function AdminDeleteEssayButton({ postId, action }: AdminDeleteEssayButtonProps) {
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const confirmed = window.confirm(
      "Delete this essay? This will remove the post, media, comments, and revisions."
    );
    if (!confirmed) {
      event.preventDefault();
    }
  };

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit}>
      <input type="hidden" name="postId" value={postId} />
      <button type="submit" className="edit-story-link delete-story-link">
        Delete
      </button>
    </form>
  );
}
