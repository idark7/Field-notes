"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type ProfileFormProps = {
  initialName: string;
  initialImage?: string | null;
  email: string;
  initialBio?: string;
};

export function ProfileForm({ initialName, initialImage, email, initialBio = "" }: ProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(initialName);
  const [imageValue, setImageValue] = useState(initialImage ?? "");
  const [bio, setBio] = useState(initialBio);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageValue(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setImageValue("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setSaving(true);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        image: imageValue || null,
        bio: bio.trim(),
      }),
    });

    setSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error || "Unable to update profile.");
      return;
    }

    setStatus("Profile updated.");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="section-card profile-card mx-auto grid w-full max-w-2xl gap-6 p-10"
    >
      <div>
        <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>Profile</p>
        <h1 className="mt-3 text-3xl font-semibold" style={{ fontFamily: "var(--font-display)", color: 'var(--text-primary)' }}>
          Your account
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Update your display name and profile photo.
        </p>
      </div>

      <div className="profile-avatar-row">
        <div className="profile-avatar">
          {imageValue ? (
            <img src={imageValue} alt={name || "Profile"} />
          ) : (
            <span>{(name || "U").slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="grid gap-2">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Photo</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="profile-upload">
              Upload photo
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
            <button type="button" onClick={handleRemoveImage} className="profile-secondary">
              Remove
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            PNG or JPG under 700 KB. Square images look best.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Display name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="editor-input"
            placeholder="Your name"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Bio
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="editor-input"
            rows={4}
            placeholder="Add a short bio for your author profile."
          />
        </label>
        <label className="grid gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Email
          <input value={email} readOnly className="editor-input" style={{ backgroundColor: 'var(--bg-gray-50)' }} />
        </label>
      </div>

      {status ? (
        <p className={`text-sm ${status.includes("updated") ? "text-green-700" : "text-red-700"}`}>
          {status}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="profile-primary" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          className="profile-secondary"
          onClick={() => {
            setName(initialName);
            setImageValue(initialImage ?? "");
            setBio(initialBio);
            setStatus("");
          }}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
