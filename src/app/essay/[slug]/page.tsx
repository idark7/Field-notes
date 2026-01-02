import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { EssayActionIcons } from "@/components/EssayActionIcons";
import { CommentsSection } from "@/components/CommentsSection";
import { LightboxImage } from "@/components/LightboxImage";
import { GalleryClickProxy } from "@/components/GalleryClickProxy";
import { RichTextGalleryLightbox } from "@/components/RichTextGalleryLightbox";
import { AdminReviewModal } from "@/components/AdminReviewModal";
import { renderInlineText } from "@/lib/inlineFormat";
import { SiteFooter } from "@/components/SiteFooter";
import { sanitizeRichText } from "@/lib/sanitize";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const post = await prisma.post.findUnique({
    where: { slug: resolvedParams.slug },
    select: { title: true, metaTitle: true, metaDesc: true },
  });

  if (!post) {
    return {};
  }

  return {
    title: post.metaTitle || post.title,
    description: post.metaDesc || undefined,
  };
}

type MediaItem = {
  id: string;
  type: "PHOTO" | "VIDEO";
  mimeType: string;
  altText: string;
  sortOrder: number;
  fileName: string;
};

type ContentBlock = {
  id?: string;
  type?: string;
  level?: string;
  text?: string;
  items?: string[];
  caption?: string;
  altText?: string;
  galleryItems?: { caption?: string; altText?: string }[];
  overlayTitle?: string;
  overlayText?: string;
  height?: number;
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "mov", "webm", "ogv", "ogg"]);
const DEFAULT_COVER_HEIGHT = 420;

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function isVideoMedia(item: MediaItem) {
  if (item.type === "VIDEO") return true;
  if (item.mimeType?.startsWith("video")) return true;
  return VIDEO_EXTENSIONS.has(getFileExtension(item.fileName));
}

function resolvedMimeType(item: MediaItem) {
  if (item.mimeType && item.mimeType !== "application/octet-stream") {
    return item.mimeType;
  }
  const ext = getFileExtension(item.fileName);
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "m4v":
      return "video/x-m4v";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "ogv":
    case "ogg":
      return "video/ogg";
    default:
      return item.mimeType;
  }
}

function getCategoryLabel(categories: { category: { name: string } }[]) {
  return categories[0]?.category.name ?? "Field Notes";
}

function parseBlocks(content: string): ContentBlock[] | null {
  try {
    const blocks = JSON.parse(content);
    return Array.isArray(blocks) ? blocks : null;
  } catch {
    return null;
  }
}

async function reviewPost(formData: FormData) {
  "use server";

  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const postId = String(formData.get("postId") || "");
  const status = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim();

  if (!postId || !["APPROVED", "NEEDS_CHANGES"].includes(status)) {
    return;
  }

  if (status === "NEEDS_CHANGES" && !note) {
    return;
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { slug: true, revision: true },
  });

  if (!post) {
    return;
  }

  await prisma.post.update({
    where: { id: postId },
    data: { status: status as "APPROVED" | "NEEDS_CHANGES" },
  });

  if (note) {
    await prisma.adminNote.create({
      data: { postId, adminId: user.id, text: note, revision: post.revision },
    });
  }

  redirect(`/essay/${post.slug}?reviewed=1`);
}

function renderBlocks(
  blocks: ContentBlock[],
  media: MediaItem[],
  startMediaIndex: number,
  lightboxItems: { id: string; src: string; alt: string; caption?: string | null }[]
) {
  let mediaIndex = startMediaIndex;

  return blocks.map((block, index) => {
    const key = block.id || `${block.type ?? "block"}-${index}`;

    if (block.type === "heading") {
      const level = block.level === "h1" || block.level === "h3" ? block.level : "h2";
      const HeadingTag = level === "h1" ? "h1" : level === "h3" ? "h3" : "h2";
      const headingClass =
        level === "h1"
          ? "text-[30px] leading-[38px] font-semibold tracking-[-0.4px]"
          : level === "h3"
            ? "text-[20px] leading-[28px] font-semibold tracking-[-0.2px]"
            : "text-[24px] leading-[32px] font-semibold tracking-[-0.3px]";
      return (
        <HeadingTag key={key} className={headingClass} style={{ color: "var(--text-primary)" }}>
          {renderInlineText(block.text ?? "")}
        </HeadingTag>
      );
    }

    if (block.type === "quote") {
      return (
        <blockquote
          key={key}
          className="border-l-4 pl-6 text-[20px] italic leading-[28px] tracking-[-0.45px]"
          style={{ borderColor: "#f54900", color: "var(--text-primary)" }}
        >
          {renderInlineText(block.text ?? "")}
        </blockquote>
      );
    }

    if (block.type === "list") {
      return (
        <ul
          key={key}
          className="list-disc pl-6 text-[18px] leading-[29.25px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {(block.items || []).map((item, itemIndex) => (
            <li key={`${key}-item-${itemIndex}`}>{renderInlineText(item)}</li>
          ))}
        </ul>
      );
    }

    if (block.type === "media") {
      const current = media[mediaIndex];
      if (!current) {
        return null;
      }
      mediaIndex += 1;
      if (current) {
        const blockHeight = typeof block.height === "number" ? block.height : undefined;
        return (
          <figure key={key} className="grid gap-3">
            {isVideoMedia(current) ? (
              <video
                controls
                className="w-full rounded-[10px] object-cover"
                style={blockHeight ? { height: blockHeight } : undefined}
              >
                <source src={`/api/media/${current.id}`} type={resolvedMimeType(current)} />
              </video>
            ) : (
              <LightboxImage
                itemId={current.id}
                items={lightboxItems}
                src={`/api/media/${current.id}`}
                alt={current.altText}
                caption={block.caption || block.altText || current.altText}
                className="w-full rounded-[10px] object-cover"
                imageStyle={blockHeight ? { height: blockHeight } : undefined}
              />
            )}
            <figcaption
              className="text-center text-[14px] leading-[20px]"
              style={{ color: "var(--text-muted)" }}
            >
              {block.caption || block.altText || current.altText}
            </figcaption>
          </figure>
        );
      }
    }

    if (block.type === "gallery") {
      const galleryItems = Array.isArray(block.galleryItems) ? block.galleryItems : [];
      if (!galleryItems.length) {
        return null;
      }
      const galleryMedia: MediaItem[] = [];
      for (let i = 0; i < galleryItems.length; i += 1) {
        const current = media[mediaIndex];
        if (!current) break;
        galleryMedia.push(current);
        mediaIndex += 1;
      }
      if (!galleryMedia.length) {
        return null;
      }
      return (
        <GalleryClickProxy key={key} className="story-gallery-grid">
          {galleryMedia.map((item, galleryIndex) => {
            if (!item) return null;
            const caption = galleryItems[galleryIndex]?.caption;
            const fallbackAlt = galleryItems[galleryIndex]?.altText || item.altText;
            return (
              <figure key={`${key}-gallery-${galleryIndex}`} className="story-gallery-item">
                {isVideoMedia(item) ? (
                  <video controls className="w-full rounded-[10px]">
                    <source src={`/api/media/${item.id}`} type={resolvedMimeType(item)} />
                  </video>
                ) : (
                  <LightboxImage
                    itemId={item.id}
                    items={lightboxItems}
                    src={`/api/media/${item.id}`}
                    alt={fallbackAlt}
                    caption={caption || fallbackAlt}
                    className="w-full rounded-[10px] object-cover"
                  />
                )}
                {caption ? (
                  <figcaption className="story-gallery-caption">{caption}</figcaption>
                ) : null}
              </figure>
            );
          })}
        </GalleryClickProxy>
      );
    }

    if (block.type === "background") {
      const current = media[mediaIndex];
      if (!current) {
        return null;
      }
      mediaIndex += 1;
      const blockHeight = typeof block.height === "number" ? block.height : undefined;
      return (
        <section
          key={key}
          className="story-cover-block relative overflow-hidden rounded-[10px] min-h-[320px] flex items-end"
          style={blockHeight ? { minHeight: blockHeight } : undefined}
        >
          {isVideoMedia(current) ? (
            <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover">
              <source src={`/api/media/${current.id}`} type={resolvedMimeType(current)} />
            </video>
          ) : (
            <LightboxImage
              itemId={current.id}
              items={lightboxItems}
              src={`/api/media/${current.id}`}
              alt={block.altText || current.altText}
              caption={block.overlayTitle || block.overlayText || block.altText || current.altText}
              wrapperClassName="absolute inset-0 h-full w-full"
              className="h-full w-full object-cover"
            />
          )}
          <div className="story-cover-overlay pointer-events-none absolute inset-0" />
          <div className="relative z-10 p-8 text-white">
            {block.overlayTitle ? (
              <h3 className="text-2xl font-semibold">{renderInlineText(block.overlayTitle)}</h3>
            ) : null}
            {block.overlayText ? (
              <p className="mt-3 text-sm text-white/80 max-w-[520px]">
                {renderInlineText(block.overlayText)}
              </p>
            ) : null}
          </div>
        </section>
      );
    }

    if (block.type === "divider") {
      return <hr key={key} style={{ borderColor: 'var(--border-gray)' }} />;
    }

    return (
      <p key={key} className="text-[18px] leading-[29.25px] tracking-[-0.44px]" style={{ color: 'var(--text-primary)' }}>
        {renderInlineText(block.text ?? "")}
      </p>
    );
  });
}

function renderPlainText(content: string) {
  const lines = content.split("\n");
  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={`spacer-${index}`} className="h-4" />;

    return (
      <p key={index} className="text-[18px] leading-[29.25px] tracking-[-0.44px]" style={{ color: 'var(--text-primary)' }}>
        {renderInlineText(trimmed)}
      </p>
    );
  });
}

export default async function EssayPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  const resolvedParams = await params;
  const post = await prisma.post.findUnique({
    where: { slug: resolvedParams.slug },
    include: {
      author: true,
      media: true,
      categories: { include: { category: true } },
    },
  });

  const isAdmin = user?.role === "ADMIN";
  if (!post || (!isAdmin && post.status !== "APPROVED")) {
    notFound();
  }

  const sortedMedia = [...post.media].sort((a, b) => a.sortOrder - b.sortOrder);
  const blocks = parseBlocks(post.content);
  const isHtmlContent = !blocks && post.content.trim().startsWith("<");
  const coverBlockIndex = blocks ? blocks.findIndex((block) => block.type === "background") : -1;
  const coverBlock = coverBlockIndex >= 0 && blocks ? blocks[coverBlockIndex] : undefined;
  let coverMediaIndex = 0;
  if (blocks && coverBlockIndex > 0) {
    for (let i = 0; i < coverBlockIndex; i += 1) {
      const block = blocks[i];
      if (!block) continue;
      if (block.type === "media" || block.type === "background") {
        coverMediaIndex += 1;
      } else if (block.type === "gallery") {
        coverMediaIndex += block.galleryItems?.length ?? 0;
      }
    }
  }
  const heroMedia = coverBlock ? sortedMedia[coverMediaIndex] : sortedMedia[0];
  const heroHeight = typeof coverBlock?.height === "number" ? coverBlock.height : DEFAULT_COVER_HEIGHT;
  const shouldSkipFirstBlock = blocks?.[0]?.type === "media";
  const contentBlocks = blocks
    ? coverBlock
      ? blocks.filter((_, index) => index !== coverBlockIndex)
      : shouldSkipFirstBlock
        ? blocks.slice(1)
        : blocks
    : null;
  const contentMedia = heroMedia && coverBlock
    ? sortedMedia.filter((item) => item.id !== heroMedia.id)
    : sortedMedia;
  const authorImage = post.author.image;
  const authorInitials = post.author.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const canEditPost = !!user && (user.role === "ADMIN" || user.id === post.authorId);
  const isAdminAuthor = user?.role === "ADMIN" && user.id === post.authorId;

  const lightboxItems = sortedMedia
    .filter((item) => !isVideoMedia(item))
    .map((item) => ({
      id: item.id,
      src: `/api/media/${item.id}`,
      alt: item.altText,
      caption: item.altText,
    }));

  return (
    <main style={{ background: "var(--bg-white)", color: "var(--text-primary)" }}>
      <div className="mx-auto max-w-[896px] px-6 pb-20 pt-10">
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-[16px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <article className="mt-8">
          <div
            className={`story-hero ${coverBlock ? "story-hero-covered" : ""}`}
            style={
              coverBlock && heroMedia && !isVideoMedia(heroMedia)
                ? {
                    backgroundImage: `url(/api/media/${heroMedia.id})`,
                    minHeight: heroHeight,
                  }
                : coverBlock
                  ? { minHeight: heroHeight }
                  : undefined
            }
          >
            {coverBlock && heroMedia && isVideoMedia(heroMedia) ? (
              <video autoPlay muted loop playsInline className="story-hero-media">
                <source src={`/api/media/${heroMedia.id}`} type={resolvedMimeType(heroMedia)} />
              </video>
            ) : null}
            {coverBlock ? <div className="story-hero-overlay" /> : null}
            <div className="story-hero-content">
              <p className="story-hero-category text-[14px] uppercase tracking-[0.55px] text-[#f54900]">
                {getCategoryLabel(post.categories)}
              </p>
              <h1
                className="mt-4 text-[36px] leading-[44px] font-semibold md:text-[56px] md:leading-[67px]"
                style={{ color: "var(--text-primary)" }}
              >
                {post.title}
              </h1>
              <p
                className="mt-4 text-[18px] leading-[29.25px] tracking-[-0.45px] md:text-[20px] md:leading-[32.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {post.excerpt ??
                  "An unforgettable journey through one of the world's most dramatic landscapes, where towering peaks meet endless glaciers and the wind carries stories of ancient explorers."}
              </p>

              <div
                className="mt-8 flex flex-wrap items-center justify-between gap-6 border-b pb-6"
                style={{ borderColor: "var(--border-gray)" }}
              >
                <div className="flex items-center gap-4">
                  {authorImage ? (
                    <img
                      src={authorImage}
                      alt={post.author.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full text-[14px] font-semibold"
                      style={{ background: "var(--bg-gray-100)", color: "var(--text-tertiary)" }}
                    >
                      {authorInitials}
                    </div>
                  )}
                  <div>
                    <p className="text-[16px] tracking-[-0.31px]" style={{ color: "var(--text-primary)" }}>
                      {post.author.name}
                    </p>
                <div
                  className="story-hero-meta mt-1 flex flex-wrap items-center gap-3 text-[14px]"
                  style={{ color: "var(--text-muted)" }}
                >
                      <span className="inline-flex items-center gap-2">
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4" />
                          <path d="M8 2v4" />
                          <path d="M3 10h18" />
                        </svg>
                        {formatDate(post.createdAt)}
                      </span>
                      <span aria-hidden>&middot;</span>
                      <span className="inline-flex items-center gap-2">
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 3" />
                        </svg>
                        {post.readTimeMin} min read
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <EssayActionIcons
                    postId={post.id}
                    slug={post.slug}
                    canLike={!!user}
                    title={post.title}
                    excerpt={post.excerpt ?? ""}
                imageUrl={heroMedia && !isVideoMedia(heroMedia) ? `/api/media/${heroMedia.id}` : undefined}
                currentUser={user ? { id: user.id, name: user.name, image: user.image, role: user.role } : undefined}
              />
                  {canEditPost ? (
                    <div className="flex flex-col items-end">
                      {user?.role === "ADMIN" && !isAdminAuthor ? (
                        <AdminReviewModal postId={post.id} postTitle={post.title} action={reviewPost} />
                      ) : (
                        <>
                          <Link className="edit-story-link" href={`/editor/advanced/edit/${post.id}`}>
                            Edit story
                          </Link>
                          {isAdminAuthor ? (
                            <span className="edit-story-note">Changes publish immediately.</span>
                          ) : (
                            <span className="edit-story-note">Edits resubmit for approval.</span>
                          )}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {heroMedia && !coverBlock ? (
            <div className="mt-8 overflow-hidden rounded-[10px]" style={{ height: heroHeight }}>
              {isVideoMedia(heroMedia) ? (
                <video controls className="h-full w-full object-cover">
                  <source src={`/api/media/${heroMedia.id}`} type={resolvedMimeType(heroMedia)} />
                </video>
              ) : (
                <LightboxImage
                  itemId={heroMedia.id}
                  items={lightboxItems}
                  src={`/api/media/${heroMedia.id}`}
                  alt={heroMedia.altText}
                  caption={heroMedia.altText}
                  className="h-full w-full object-cover"
                  wrapperClassName="h-full"
                />
              )}
            </div>
          ) : null}

          <div className="mt-10 grid gap-6">
            {contentBlocks
              ? renderBlocks(contentBlocks, contentMedia, 0, lightboxItems)
              : isHtmlContent ? (
                <RichTextGalleryLightbox
                  className="tiptap-content"
                  html={sanitizeRichText(post.content)}
                />
              ) : (
                renderPlainText(post.content)
              )}
          </div>

          <CommentsSection
            slug={post.slug}
            currentUser={user ? { id: user.id, name: user.name, image: user.image, role: user.role } : undefined}
            postAuthor={{ id: post.authorId, name: post.author.name }}
          />

          <div className="mt-12 border-t pt-8" style={{ borderColor: 'var(--border-gray)' }}>
            <div className="flex flex-wrap gap-6">
              {authorImage ? (
                <img
                  src={authorImage}
                  alt={post.author.name}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full text-[18px] font-semibold" style={{ background: 'var(--bg-gray-200)', color: 'var(--text-tertiary)' }}>
                  {authorInitials}
                </div>
              )}
              <div className="flex-1">
                <p className="text-[20px] leading-[28px] tracking-[-0.45px]" style={{ color: 'var(--text-primary)' }}>
                  Written by {post.author.name}
                </p>
                <p className="mt-2 text-[16px] leading-[26px] tracking-[-0.31px]" style={{ color: 'var(--text-tertiary)' }}>
                  Adventure journalist and photographer based in Denver. Sarah has trekked across six continents and contributes to National Geographic and Outside Magazine.
                </p>
                <button
                  type="button"
                  className="mt-4 text-[16px] font-medium tracking-[-0.31px] text-[#f54900]"
                >
                  Follow
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>

      <SiteFooter />
    </main>
  );
}
