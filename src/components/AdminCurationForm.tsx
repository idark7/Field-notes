"use client";

import { useMemo, useState } from "react";

type CurationPost = {
  id: string;
  title: string;
  createdAt: string;
  authorName: string;
  mediaId?: string | null;
};

type AdminCurationFormProps = {
  posts: CurationPost[];
  initialFeaturedId: string;
  initialEditorialOrder: string[];
  saved: boolean;
  error: string;
  action: (formData: FormData) => void;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AdminCurationForm({
  posts,
  initialFeaturedId,
  initialEditorialOrder,
  saved,
  error,
  action,
}: AdminCurationFormProps) {
  const [query, setQuery] = useState("");
  const [featuredId, setFeaturedId] = useState(initialFeaturedId);
  const [editorialOrder, setEditorialOrder] = useState<string[]>(initialEditorialOrder);
  const [localError, setLocalError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const editorialSet = useMemo(() => new Set(editorialOrder), [editorialOrder]);
  const filteredPosts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return posts;
    return posts.filter((post) => {
      return (
        post.title.toLowerCase().includes(normalized) ||
        post.authorName.toLowerCase().includes(normalized)
      );
    });
  }, [posts, query]);

  function handleFeaturedChange(nextId: string) {
    setLocalError("");
    setFeaturedId(nextId);
    if (nextId && editorialSet.has(nextId)) {
      setEditorialOrder((current) => current.filter((id) => id !== nextId));
    }
  }

  function toggleEditorial(id: string) {
    setLocalError("");
    setEditorialOrder((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (id === featuredId) {
        setLocalError("Featured story cannot also be an editorial pick.");
        return current;
      }
      return [...current, id];
    });
  }

  function moveEditorial(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    setEditorialOrder((current) => {
      const next = current.filter((id) => id !== draggedId);
      const targetIndex = next.indexOf(targetId);
      if (targetIndex === -1) return current;
      next.splice(targetIndex, 0, draggedId);
      return next;
    });
  }

  return (
    <form action={action} className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="featuredPostId" value={featuredId || "none"} />
      {editorialOrder.map((postId) => (
        <input key={`editorial-${postId}`} type="hidden" name="editorialPickIds" value={postId} />
      ))}

      <div className="grid gap-8">
        <div className="rounded-3xl border p-5" style={{ borderColor: "var(--border-gray)", background: "var(--bg-white)" }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
                Search
              </p>
              <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Find approved stories
              </h3>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.3em]"
              style={{ background: "var(--bg-gray-100)", color: "var(--text-muted)" }}
            >
              {filteredPosts.length}/{posts.length}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title or author..."
              className="w-full rounded-xl border px-4 py-3 text-sm md:flex-1"
              style={{ borderColor: "var(--border-gray)", background: "var(--bg-gray-50)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border-gray)", background: "var(--bg-white)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
                Featured story
              </p>
              <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Spotlight one hero narrative
              </h3>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.3em]"
              style={{ background: "var(--bg-accent-light)", color: "var(--accent)" }}
            >
              Single pick
            </span>
          </div>
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            The featured story appears as the hero card on the home page.
          </p>
          <div className="mt-6 grid gap-3" style={{ maxHeight: 420, overflowY: "auto" }}>
            <label
              className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: !featuredId ? "var(--accent)" : "var(--border-gray)",
                background: !featuredId ? "var(--bg-accent-light)" : "transparent",
              }}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="featuredPostId-choice"
                  value="none"
                  checked={!featuredId}
                  onChange={() => handleFeaturedChange("")}
                />
                <span className="font-medium">No featured story</span>
              </div>
            </label>
            {filteredPosts.length === 0 ? (
              <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--border-gray)", color: "var(--text-muted)" }}>
                No stories match this search.
              </div>
            ) : (
              filteredPosts.map((post) => {
                const isSelected = post.id === featuredId;
                return (
                  <label
                    key={`featured-${post.id}`}
                    className="flex items-center gap-4 rounded-2xl border px-4 py-3 text-sm transition"
                    style={{
                      borderColor: isSelected ? "var(--accent)" : "var(--border-gray)",
                      background: isSelected ? "var(--bg-accent-light)" : "transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="featuredPostId-choice"
                      value={post.id}
                      checked={isSelected}
                      onChange={() => handleFeaturedChange(post.id)}
                    />
                    <div className="flex flex-1 items-center gap-4">
                      <div
                        className="h-12 w-16 rounded-xl"
                        style={{
                          backgroundColor: "var(--bg-gray-100)",
                          backgroundImage: post.mediaId ? `url(/api/media/${post.mediaId})` : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                      <div>
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {post.title}
                        </p>
                        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                          {post.authorName} • {formatDate(post.createdAt)}
                        </p>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="text-[11px] uppercase tracking-[0.3em]" style={{ color: "var(--accent)" }}>
                        Featured
                      </span>
                    ) : null}
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border-gray)", background: "var(--bg-white)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
                Editorial picks
              </p>
              <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Curate editorial highlights
              </h3>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.3em]"
              style={{ background: "var(--bg-gray-100)", color: "var(--text-muted)" }}
            >
              {editorialOrder.length} selected
            </span>
          </div>
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Picks appear in the Editorial Picks rail. Drag to order after selecting.
          </p>
          <div className="mt-6 grid gap-3" style={{ maxHeight: 520, overflowY: "auto" }}>
            {filteredPosts.length === 0 ? (
              <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--border-gray)", color: "var(--text-muted)" }}>
                No stories match this search.
              </div>
            ) : (
              filteredPosts.map((post) => {
                const isSelected = editorialSet.has(post.id);
                const order = editorialOrder.indexOf(post.id) + 1;
                return (
                  <label
                    key={`editorial-${post.id}`}
                    className="flex items-center gap-4 rounded-2xl border px-4 py-3 text-sm transition"
                    style={{
                      borderColor: isSelected ? "var(--accent)" : "var(--border-gray)",
                      background: isSelected ? "var(--bg-accent-light)" : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEditorial(post.id)}
                    />
                    <div className="flex flex-1 items-center gap-4">
                      <div
                        className="h-12 w-16 rounded-xl"
                        style={{
                          backgroundColor: "var(--bg-gray-100)",
                          backgroundImage: post.mediaId ? `url(/api/media/${post.mediaId})` : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                      <div>
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {post.title}
                        </p>
                        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                          {post.authorName} • {formatDate(post.createdAt)}
                        </p>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="text-[11px] uppercase tracking-[0.3em]" style={{ color: "var(--accent)" }}>
                        Pick {order}
                      </span>
                    ) : null}
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>

      <aside className="grid gap-6 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border-gray)", background: "var(--bg-white)" }}>
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
            Order editorials
          </p>
          <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Drag to reorder
          </h3>
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            This order determines the layout on the home page.
          </p>
          <div className="mt-4 grid gap-3">
            {editorialOrder.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Select stories to enable ordering.
              </p>
            ) : (
              editorialOrder.map((postId, index) => {
                const post = posts.find((item) => item.id === postId);
                if (!post) return null;
                return (
                  <div
                    key={`order-${post.id}`}
                    draggable
                    onDragStart={() => setDragId(post.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragId) {
                        moveEditorial(dragId, post.id);
                        setDragId(null);
                      }
                    }}
                    className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm"
                    style={{ borderColor: "var(--border-gray)" }}
                  >
                    <span
                      className="h-8 w-8 rounded-full text-[12px] font-semibold flex items-center justify-center"
                      style={{ background: "var(--bg-accent-light)", color: "var(--accent)" }}
                    >
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {post.title}
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                        {post.authorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleEditorial(post.id)}
                        className="text-xs uppercase tracking-[0.3em]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Remove
                      </button>
                      <span className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
                        Drag
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="grid gap-3">
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center rounded-lg px-5 text-sm font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            Save curation
          </button>
          {saved ? <span className="text-sm" style={{ color: "var(--text-muted)" }}>Saved.</span> : null}
          {error || localError ? <span className="text-sm text-red-700">{error || localError}</span> : null}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Changes apply immediately to the home page.
          </span>
        </div>
      </aside>
    </form>
  );
}
