"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractPreviewText } from "@/lib/utils";
import { StoryCoverImage } from "@/components/StoryCoverImage";

type Category = {
  id: string;
  name: string;
};

type MediaItem = {
  id: string;
  type: "PHOTO" | "VIDEO";
};

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  readTimeMin: number;
  createdAt: string | Date;
  author: { name: string; image?: string | null };
  categories: { category: Category }[];
  tags: { tag: { name: string } }[];
  media: MediaItem[];
  _count: { likes: number; comments: number };
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type FieldNotesGridProps = {
  posts: Post[];
  categories: Category[];
  tags: { id: string; name: string }[];
  variant?: "full" | "compact";
  initialQuery?: string;
  autoFocus?: boolean;
  currentPage?: number;
  pageSize?: number;
  totalCount?: number;
  basePath?: string;
  initialCollection?: "all" | "editorial";
};

function formatRelative(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function FieldNotesGrid({
  posts,
  categories,
  tags,
  variant = "full",
  initialQuery = "",
  autoFocus = false,
  currentPage = 1,
  pageSize = 6,
  totalCount,
  basePath = "/field-notes",
  initialCollection = "all",
}: FieldNotesGridProps) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeTag, setActiveTag] = useState<string>("All");
  const [activeAuthor, setActiveAuthor] = useState<string>("All");
  const [activeCollection, setActiveCollection] = useState<"all" | "editorial">(initialCollection);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<Post | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const searchRef = useRef<HTMLInputElement>(null);
  const [displayPosts, setDisplayPosts] = useState<Post[]>(posts);
  const [displayTotal, setDisplayTotal] = useState<number>(totalCount ?? posts.length);
  const [page, setPage] = useState(currentPage);
  const [perPage, setPerPage] = useState(pageSize);
  const [isFetching, setIsFetching] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev">("next");
  const [animationKey, setAnimationKey] = useState(0);
  const initialLoad = useRef(true);
  const defaultPageSize = 6;

  const authorOptions = useMemo(() => {
    const names = posts.map((post) => post.author.name).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const headingCopy =
    activeCollection === "editorial"
      ? {
          title: "Editorial Picks",
          description:
            "A curated set of editor-selected stories, ordered by our editorial team for this collection.",
        }
      : {
          title: "All Field Notes",
          description:
            "Explore every travel story in our editorial archive. Browse recent essays, rediscover timeless journeys, and dive deeper into the voices of our travelers.",
        };

  useEffect(() => {
    if (viewMode === "list" && selected) {
      setSelected(null);
      setExpanded(false);
    }
  }, [viewMode, selected]);

  useEffect(() => {
    if (autoFocus) {
      searchRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    setDisplayPosts(posts);
  }, [posts]);

  useEffect(() => {
    if (typeof totalCount === "number") {
      setDisplayTotal(totalCount);
    }
  }, [totalCount]);

  useEffect(() => {
    setPage(currentPage);
  }, [currentPage]);

  useEffect(() => {
    setPerPage(pageSize);
  }, [pageSize]);

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }

    const timer = setTimeout(() => {
      void fetchPage(1, "next");
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeCategory, activeTag, activeAuthor, activeCollection, perPage]);

  const filtered = displayPosts;
  const gridResults = viewMode === "grid" ? filtered : [];
  const listResults = viewMode === "list" ? filtered : [];
  const totalPages = displayTotal ? Math.max(1, Math.ceil(displayTotal / perPage)) : 1;
  const showPagination = Boolean(displayTotal && totalPages > 1);

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (activeCategory !== "All") {
      params.set("category", activeCategory);
    }
    if (activeTag !== "All") {
      params.set("tag", activeTag);
    }
    if (activeAuthor !== "All") {
      params.set("author", activeAuthor);
    }
    if (activeCollection !== "all") {
      params.set("collection", activeCollection);
    }
    if (perPage !== defaultPageSize) {
      params.set("pageSize", String(perPage));
    }
    if (page > 1) {
      params.set("page", String(page));
    }
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const fetchPage = async (nextPage: number, direction: "next" | "prev") => {
    if (isFetching) return;
    setIsFetching(true);
    setSlideDirection(direction);
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", String(perPage));
      if (query.trim()) {
        params.set("q", query.trim());
      }
      if (activeCategory !== "All") {
        params.set("category", activeCategory);
      }
      if (activeTag !== "All") {
        params.set("tag", activeTag);
      }
      if (activeAuthor !== "All") {
        params.set("author", activeAuthor);
      }
      if (activeCollection !== "all") {
        params.set("collection", activeCollection);
      }

      const response = await fetch(`/api/field-notes?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setDisplayPosts(data.posts ?? []);
      setDisplayTotal(data.totalCount ?? 0);
      setPage(nextPage);
      setAnimationKey((prev) => prev + 1);
      router.replace(buildPageHref(nextPage), { scroll: false });
    } finally {
      setIsFetching(false);
    }
  };

  const renderGridCard = (post: Post) => {
    const mediaId = post.media.find((item) => item.type === "PHOTO")?.id;
    const fallbackKey = post.categories[0]?.category.name ?? "Field Notes";
    return (
      <article key={post.id} className="group cursor-pointer" onClick={() => setSelected(post)}>
        <p className="text-xs uppercase tracking-widest text-[var(--accent)] mb-2">{fallbackKey}</p>
        <h3 className="text-xl font-semibold mb-2 group-hover:text-[var(--accent)] transition-colors">
          {post.title}
        </h3>
        <StoryCoverImage
          src={mediaId ? `/api/media/${mediaId}` : undefined}
          alt={post.title}
          className="story-cover h-48 w-full rounded-lg mb-4 object-cover"
        />
        <p className="text-[var(--text-secondary)] text-sm mb-4 line-clamp-3">
          {post.excerpt || "Discover this amazing travel story."}
        </p>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-2">
            {post.author.image ? (
              <img
                src={post.author.image}
                alt={post.author.name}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface)]/70 text-[9px] font-semibold text-[var(--text-tertiary)]">
                {getInitials(post.author.name)}
              </span>
            )}
            <span>{post.author.name}</span>
          </span>
          <span>•</span>
          <span>{post.readTimeMin} min read</span>
        </div>
      </article>
    );
  };

  return (
    <>
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-[1232px] px-6 py-16">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_360px] md:items-start">
            <div>
              <p className="text-[14px] uppercase tracking-[0.55px] text-[var(--text-muted)]">Field Notes</p>
              <h1
                className="mt-3 text-[32px] font-semibold md:text-[48px] md:leading-[56px]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {headingCopy.title}
              </h1>
              <p className="mt-4 max-w-2xl text-[18px] leading-[29px] text-[var(--text-tertiary)] md:text-[20px] md:leading-[32px]">
                {headingCopy.description}
              </p>
              {gridResults.length ? (
                <div className="field-notes-results relative">
                  <div
                    key={`page-${animationKey}`}
                    className={`grid gap-8 md:grid-cols-3 field-notes-page field-notes-page-${slideDirection}`}
                  >
                    {gridResults.map(renderGridCard)}
                  </div>
                  {isFetching ? (
                    <div className="field-notes-loading" aria-hidden>
                      <span className="page-loading-spinner" />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="field-notes-panel md:sticky md:top-24">
              {showPagination ? (
                <div className="mb-6 flex flex-wrap items-center justify-end gap-4" aria-live="polite">
                  <button
                    type="button"
                    onClick={() => fetchPage(page - 1, "prev")}
                    disabled={page <= 1 || isFetching}
                    className="inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium"
                    style={{
                      border: "1px solid var(--border-gray)",
                      color: "var(--text-primary)",
                      opacity: page <= 1 || isFetching ? 0.4 : 1,
                    }}
                  >
                    Previous
                  </button>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchPage(page + 1, "next")}
                    disabled={page >= totalPages || isFetching}
                    className="inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium"
                    style={{
                      border: "1px solid var(--border-gray)",
                      color: "var(--text-primary)",
                      opacity: page >= totalPages || isFetching ? 0.4 : 1,
                    }}
                  >
                    Next
                  </button>
                </div>
              ) : null}
              <div className="field-notes-panel-section">
                <p className="field-notes-panel-title">Search</p>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search stories"
                  className="field-notes-select"
                  style={{ backgroundImage: "none" }}
                  aria-label="Search stories"
                  name="q"
                  id="field-notes-search"
                />
              </div>
              <div className="field-notes-panel-section">
                <p className="field-notes-panel-title">View mode</p>
                <div className="field-notes-view">
                  <button
                    type="button"
                    className={`field-notes-view-btn ${viewMode === "grid" ? "is-active" : ""}`}
                    onClick={() => setViewMode("grid")}
                    aria-pressed={viewMode === "grid"}
                  >
                    <svg aria-hidden viewBox="0 0 24 24" className="field-notes-view-icon">
                      <rect x="4" y="4" width="7" height="7" rx="1.5" fill="currentColor" />
                      <rect x="13" y="4" width="7" height="7" rx="1.5" fill="currentColor" />
                      <rect x="4" y="13" width="7" height="7" rx="1.5" fill="currentColor" />
                      <rect x="13" y="13" width="7" height="7" rx="1.5" fill="currentColor" />
                    </svg>
                    Grid mode
                  </button>
                  <button
                    type="button"
                    className={`field-notes-view-btn ${viewMode === "list" ? "is-active" : ""}`}
                    onClick={() => setViewMode("list")}
                    aria-pressed={viewMode === "list"}
                  >
                    <svg aria-hidden viewBox="0 0 24 24" className="field-notes-view-icon">
                      <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="3" cy="7" r="1.2" fill="currentColor" />
                      <circle cx="3" cy="12" r="1.2" fill="currentColor" />
                      <circle cx="3" cy="17" r="1.2" fill="currentColor" />
                    </svg>
                    List mode
                  </button>
                </div>
              </div>
              <div className="field-notes-panel-section">
                <p className="field-notes-panel-title">Collection</p>
                <select
                  className="field-notes-select"
                  value={activeCollection}
                  onChange={(event) => setActiveCollection(event.target.value === "editorial" ? "editorial" : "all")}
                >
                  <option value="all">All stories</option>
                  <option value="editorial">Editorial picks</option>
                </select>
              </div>
              <div className="field-notes-panel-section">
                <p className="field-notes-panel-title">Profile</p>
                <select
                  className="field-notes-select"
                  value={activeAuthor}
                  onChange={(event) => setActiveAuthor(event.target.value || "All")}
                >
                  <option value="All">All</option>
                  {authorOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-notes-panel-section">
                <p className="field-notes-panel-title">Stories per page</p>
                <select
                  className="field-notes-select"
                  value={String(perPage)}
                  onChange={(event) => {
                    const nextSize = Number.parseInt(event.target.value, 10);
                    if (!Number.isNaN(nextSize)) {
                      setPerPage(nextSize);
                    }
                  }}
                >
                  {[6, 9, 12, 18, 24].map((size) => (
                    <option key={size} value={size}>
                      {size} stories
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-notes-panel-section">
                <p className="field-notes-panel-title">Tags</p>
                <select
                  className="field-notes-select"
                  value={activeTag}
                  onChange={(event) => setActiveTag(event.target.value || "All")}
                >
                  <option value="All">All</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.name}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-notes-panel-section">
                <p className="field-notes-panel-title">Categories</p>
                <select
                  className="field-notes-select"
                  value={activeCategory}
                  onChange={(event) => setActiveCategory(event.target.value || "All")}
                >
                  <option value="All">All</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-notes-panel-section">
                <div className="flex justify-end">
                  <Link href="/editor?view=stories" className="field-notes-cta field-notes-cta-small">
                  View My Stories
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {listResults.length ? (
        <section className="mx-auto max-w-[1232px] px-6 pb-20 pt-10 relative">
          <div
            key={`page-${animationKey}`}
            className={`field-notes-list field-notes-page field-notes-page-${slideDirection}`}
          >
            {listResults.map((post) => {
              const categoriesLabel = post.categories.map((item) => item.category.name).join(" / ") || "Field Notes";
              const tagNames = post.tags.map((item) => item.tag.name);
              const excerpt = post.excerpt || extractPreviewText(post.content, 140);
              return (
                <article key={post.id} className="field-notes-list-item">
                  <div className="field-notes-list-header">
                    <p className="field-notes-list-category">{categoriesLabel}</p>
                    <Link href={`/essay/${post.slug}`} className="field-notes-list-title">
                      {post.title}
                    </Link>
                    <p className="field-notes-list-excerpt">{excerpt}</p>
                  </div>
                  <div className="field-notes-list-meta">
                    <div className="field-notes-profile">
                      {post.author.image ? (
                        <img
                          src={post.author.image}
                          alt={post.author.name}
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <span className="field-notes-avatar">{getInitials(post.author.name)}</span>
                      )}
                      <div>
                        <p className="field-notes-author">{post.author.name}</p>
                        <p className="field-notes-time">{formatRelative(post.createdAt)}</p>
                      </div>
                    </div>
                    <div className="field-notes-stats">
                      <span>{post._count.likes} likes</span>
                      <span>{post._count.comments} comments</span>
                      <span>{post.readTimeMin} min read</span>
                    </div>
                  </div>
                  {tagNames.length ? (
                    <div className="field-notes-tags">
                      {tagNames.map((tag) => (
                        <span key={`${post.id}-${tag}`} className="field-notes-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          {isFetching ? (
            <div className="field-notes-loading" aria-hidden>
              <span className="page-loading-spinner" />
            </div>
          ) : null}
        </section>
      ) : null}
      {selected ? (() => {
        const coverId = selected.media.find((item) => item.type === "PHOTO")?.id;
        const hasCover = Boolean(coverId);
        return (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSelected(null);
            setExpanded(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`bg-[var(--surface)] rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden ${expanded ? 'max-h-[90vh]' : ''}`}
            onClick={(event) => event.stopPropagation()}
            style={{
              ...(hasCover
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(10, 8, 6, 0.85), rgba(10, 8, 6, 0.55)), url(/api/media/${coverId})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined),
            }}
          >
            <div className={`p-6 ${hasCover ? "text-white" : "text-[var(--text-primary)]"}`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className={`text-xs uppercase tracking-[0.3em] ${hasCover ? "text-white/70" : ""}`} style={hasCover ? {} : { color: 'var(--text-muted)' }}>
                    {selected.categories.map((item) => item.category.name).join(" / ")}
                  </p>
                  <h3
                    className={`text-3xl font-semibold mt-2 ${hasCover ? "text-white" : ""}`}
                    style={{ fontFamily: "var(--font-display)", color: hasCover ? 'white' : 'var(--text-primary)' }}
                  >
                    {selected.title}
                  </h3>
                  <p
                    className={`text-xs uppercase tracking-[0.3em] mt-2 flex items-center gap-2 ${
                      hasCover ? "text-white/70" : ""
                    }`}
                    style={hasCover ? {} : { color: 'var(--text-muted)' }}
                  >
                    {selected.author.image ? (
                      <img
                        src={selected.author.image}
                        alt={selected.author.name}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                          hasCover ? "bg-white/20 text-white" : ""
                        }`}
                        style={hasCover ? {} : { background: 'var(--bg-gray-200)', color: 'var(--text-tertiary)' }}
                      >
                        {getInitials(selected.author.name)}
                      </span>
                    )}
                    <span>
                      {selected.author.name} · {selected.readTimeMin} min read
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setExpanded(false);
                  }}
                  className={hasCover ? "text-white/70 hover:text-white" : "hover:opacity-70"}
                  style={hasCover ? {} : { color: 'var(--text-muted)' }}
                >
                  ✕
                </button>
              </div>
              <div
                className={`text-sm ${
                  hasCover ? (expanded ? "text-white/90" : "text-white/80") : ""
                }`}
                style={hasCover ? {} : { color: 'var(--text-tertiary)' }}
              >
                {expanded ? extractPreviewText(selected.content, 2000) : extractPreviewText(selected.content, 420)}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  className={`inline-flex items-center justify-center px-5 py-2 rounded-full text-[12px] font-semibold uppercase tracking-[0.2em] leading-none text-white ${
                    hasCover
                      ? "bg-white/10 border border-white/30 hover:bg-white/20"
                      : "transition hover:opacity-90"
                  }`}
                  style={hasCover ? undefined : { background: 'var(--button-primary)', color: "#ffffff" }}
                  href={`/essay/${selected.slug}`}
                >
                  Read full story
                </a>
              </div>
            </div>
          </div>
        </div>
      );
      })() : null}
    </>
  );
}
