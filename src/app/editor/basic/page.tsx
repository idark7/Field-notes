import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PostStatus } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { estimateReadTimeMinutes, extractPreviewText, slugify } from "@/lib/utils";
import { getMediaSortOrders } from "@/lib/mediaSort";
import { BlockEditor } from "@/components/BlockEditor";
import { SeoFields } from "@/components/SeoFields";
import { EditorAutosave } from "@/components/EditorAutosave";
import { PreSubmitChecklist } from "@/components/PreSubmitChecklist";
import { EditorPreview } from "@/components/EditorPreview";
import { FeedbackModal } from "@/components/FeedbackModal";
import { StoryPreviewButton } from "@/components/StoryPreviewButton";

async function createPost(formData: FormData) {
  "use server";

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const title = String(formData.get("title") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const metaTitle = String(formData.get("metaTitle") || "").trim();
  const metaDesc = String(formData.get("metaDesc") || "").trim();
  const tagsRaw = String(formData.get("tags") || "").trim();
  const categoriesRaw = String(formData.get("categories") || "").trim();
  const altTextRaw = String(formData.get("altText") || "").trim();
  const statusRaw = String(formData.get("status") || "").trim();
  const postId = String(formData.get("postId") || "").trim();

  if (!title || !content) {
    throw new Error("Title and content are required");
  }

  const slugBase = slugify(title);
  const slug = `${slugBase}-${Date.now().toString().slice(-6)}`;
  const resolvedExcerpt = excerpt || extractPreviewText(content, 160);
  const readTimeMin = estimateReadTimeMinutes(content);
  const status = (user.role === "ADMIN" && statusRaw ? statusRaw : "PENDING") as PostStatus;

  const tagNames = tagsRaw
    ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];
  const categoryNames = categoriesRaw
    ? categoriesRaw.split(",").map((cat) => cat.trim()).filter(Boolean)
    : [];

  let post = null as null | { id: string; slug: string; revision: number; status: PostStatus };
  if (postId) {
    const existing = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, slug: true, revision: true, status: true, authorId: true },
    });
    if (!existing || (existing.authorId !== user.id && user.role !== "ADMIN")) {
      redirect("/editor/basic");
    }
    const nextSlug = existing.status === "DRAFT" ? `${slugBase}-${existing.id.slice(-6)}` : existing.slug;
    post = await prisma.post.update({
      where: { id: existing.id },
      data: {
        title,
        slug: nextSlug,
        excerpt: resolvedExcerpt,
        content,
        metaTitle: metaTitle || null,
        metaDesc: metaDesc || null,
        status,
        readTimeMin,
      },
    });
    const revisionCount = await prisma.postRevision.count({ where: { postId: existing.id } });
    if (revisionCount === 0) {
      await prisma.postRevision.create({
        data: {
          postId: existing.id,
          revision: existing.revision,
          title,
          excerpt: resolvedExcerpt,
          content,
          metaTitle: metaTitle || null,
          metaDesc: metaDesc || null,
        },
      });
    }
  } else {
    post = await prisma.post.create({
      data: {
        authorId: user.id,
        title,
        slug,
        excerpt: resolvedExcerpt,
        content,
        metaTitle: metaTitle || null,
        metaDesc: metaDesc || null,
        status,
        readTimeMin,
      },
    });

    await prisma.postRevision.create({
      data: {
        postId: post.id,
        revision: 1,
        title,
        excerpt: resolvedExcerpt,
        content,
        metaTitle: metaTitle || null,
        metaDesc: metaDesc || null,
      },
    });
  }

  void altTextRaw;

  if (post) {
    await prisma.postTag.deleteMany({ where: { postId: post.id } });
    await prisma.postCategory.deleteMany({ where: { postId: post.id } });

    for (const name of tagNames) {
      const tag = await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      await prisma.postTag.create({ data: { postId: post.id, tagId: tag.id } });
    }

    for (const name of categoryNames) {
      const category = await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      await prisma.postCategory.create({
        data: { postId: post.id, categoryId: category.id },
      });
    }

    const mediaPreviewRaw = String(formData.get("mediaPreview") || "");
    const mediaOrders = getMediaSortOrders(content, mediaPreviewRaw);
    if (mediaOrders.length) {
      const mediaIds = mediaOrders.map((order) => order.id);
      const existingMedia = await prisma.media.findMany({
        where: { id: { in: mediaIds }, postId: post.id },
        select: { id: true },
      });
      const allowedIds = new Set(existingMedia.map((item) => item.id));
      const updates = mediaOrders.filter((order) => allowedIds.has(order.id));
      if (updates.length) {
        await prisma.$transaction(
          updates.map((order) =>
            prisma.media.update({
              where: { id: order.id },
              data: { sortOrder: order.sortOrder },
            })
          )
        );
      }
    }
  }

  if (status === "APPROVED" && post) {
    redirect(`/essay/${post.slug}`);
  }

  redirect("/editor/basic?submitted=1");
}

export default async function EditorPage({
  searchParams,
}: {
  searchParams?: Promise<{ submitted?: string; tab?: string; view?: string; locked?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const showSubmitted = resolvedSearchParams?.submitted === "1";
  const showLocked = resolvedSearchParams?.locked === "1";
  const requestedTab = resolvedSearchParams?.tab ?? "";
  const viewMode = resolvedSearchParams?.view ?? "editor";
  const showStoriesOnly = viewMode === "stories";

  const [draftCount, pendingCount, approvedCount, rejectedCount, needsChangesCount] =
    await Promise.all([
      prisma.post.count({ where: { authorId: user.id, status: "DRAFT" } }),
      prisma.post.count({ where: { authorId: user.id, status: "PENDING" } }),
      prisma.post.count({ where: { authorId: user.id, status: "APPROVED" } }),
      prisma.post.count({ where: { authorId: user.id, status: "REJECTED" } }),
      prisma.post.count({ where: { authorId: user.id, status: "NEEDS_CHANGES" } }),
    ]);

  const tabStatusMap: Record<string, ("DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_CHANGES")[]> = {
    drafts: ["DRAFT"],
    review: ["PENDING"],
    published: ["APPROVED"],
    unpublished: ["REJECTED", "NEEDS_CHANGES"],
  };

  const tabs = [
    { id: "drafts", label: "Drafts", count: draftCount },
    { id: "review", label: "Under review", count: pendingCount },
    { id: "published", label: "Published", count: approvedCount },
    { id: "unpublished", label: "Unpublished", count: rejectedCount + needsChangesCount },
  ];

  const fallbackTab = tabs.find((tab) => tab.count > 0)?.id ?? "drafts";
  const activeTab = tabStatusMap[requestedTab] ? requestedTab : fallbackTab;
  const activeStatuses = tabStatusMap[activeTab] ?? ["DRAFT"];

  const submissions = await prisma.post.findMany({
    where: { authorId: user.id, status: { in: activeStatuses } },
    include: { adminNotes: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  function formatStatus(status: string) {
    if (status === "PENDING") return "Under review";
    if (status === "NEEDS_CHANGES") return "Pending changes";
    return status.replace("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return (
    <main className="page-shell pb-16">
      {!showStoriesOnly && showSubmitted ? (
        <section className="section-card p-6 mb-8 border border-[color:var(--accent)]">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">
            Submitted for review
          </p>
          <p className="text-sm text-[color:var(--muted)] mt-2">
            Your essay is pending admin approval. You will see comments here if changes are needed.
          </p>
        </section>
      ) : null}
      {showLocked ? (
        <section className="section-card p-6 mb-8 border border-[color:var(--accent)]">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">
            Under review
          </p>
          <p className="text-sm text-[color:var(--muted)] mt-2">
            This story is under review. Editing will reopen when the admin requests changes.
          </p>
        </section>
      ) : null}
      {!showStoriesOnly ? (
        <section className="section-card p-10 editor-surface basic-editor">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
                Essay Editor
              </p>
              <h2 className="text-3xl font-semibold mt-4" style={{ fontFamily: "var(--font-display)" }}>
                Create a new field note
              </h2>
            </div>
          <div className="flex items-center gap-3">
              <EditorPreview formId="editor-form" />
              <Link
                href="/editor/advanced"
                className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                Advanced editor
              </Link>
            </div>
          </div>
          <form id="editor-form" action={createPost} className="mt-8 grid gap-6">
            <EditorAutosave draftKey={`new-${user.id}`} fallbackDraftKeys={[`advanced-${user.id}`]} />
            <input type="hidden" name="postId" data-autosave="postId" />
            <div className="editor-layout">
              <div className="editor-main">
                <input
                  type="text"
                  name="title"
                  placeholder="Essay title (H1)"
                  required
                  className="editor-title"
                  id="editor-title"
                  data-autosave="title"
                />
                <BlockEditor />
                <div className="text-sm text-[color:var(--muted)]">
                  Add a media, gallery, or cover photo block for each file and include SEO-ready alt text.
                </div>
              </div>
              <aside className="editor-panel">
                <div className="editor-panel-card">
                  <p className="editor-panel-title">Details</p>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        Tags
                      </label>
                      <input
                        type="text"
                        name="tags"
                        placeholder="Adventure, Coast, Culture"
                        className="editor-input"
                        id="editor-tags"
                        data-autosave="tags"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        Categories
                      </label>
                      <input
                        type="text"
                        name="categories"
                        placeholder="Nature, Mountains, City"
                        className="editor-input"
                        id="editor-categories"
                        data-autosave="categories"
                      />
                    </div>
                  </div>
                </div>
                <div className="editor-panel-card">
                  <p className="editor-panel-title">SEO</p>
                  <SeoFields />
                </div>
                {user.role === "ADMIN" ? (
                  <div className="editor-panel-card">
                    <p className="editor-panel-title">Publish</p>
                    <select name="status" className="editor-input" defaultValue="DRAFT">
                      <option value="DRAFT">Draft</option>
                      <option value="PENDING">Pending Review</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="NEEDS_CHANGES">Needs Changes</option>
                    </select>
                  </div>
                ) : null}
                <PreSubmitChecklist formId="editor-form" />
              </aside>
            </div>
          </form>
        </section>
      ) : null}
      {showStoriesOnly ? (
        <section
          id="my-stories"
          className="section-card p-10 mt-10"
          style={{ scrollMarginTop: "110px" }}
        >
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
            My stories
          </p>
          <div className="admin-tabs mt-6">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={showStoriesOnly ? `/editor?view=stories&tab=${tab.id}` : `/editor?tab=${tab.id}`}
                className={`admin-tab ${activeTab === tab.id ? "admin-tab-active" : ""}`}
              >
                <span>{tab.label}</span>
                <span className="admin-tab-count">{tab.count}</span>
              </Link>
            ))}
          </div>
          <div className="mt-6 grid gap-4">
            {submissions.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">
                No stories in this view yet.
              </p>
            ) : (
              submissions.map((post) => (
                <div key={post.id} className="border border-[color:var(--border)] rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                        {post.title}
                      </h4>
                      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)] mt-2">
                        Status: {formatStatus(post.status)}
                      </p>
                      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)] mt-2">
                        Version {post.revision}
                      </p>
                    </div>
                    <StoryPreviewButton
                      title={post.title}
                      excerpt={post.excerpt}
                      content={post.content}
                      readTimeMin={post.readTimeMin}
                      authorName={user.name ?? "You"}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {post.adminNotes.length > 0 ? (
                      <FeedbackModal
                      notes={post.adminNotes.map((note) => ({
                        id: note.id,
                        postId: post.id,
                        postTitle: post.title,
                        status: post.status,
                        note: note.text,
                        revision: note.revision ?? post.revision,
                        createdAt: note.createdAt.toISOString(),
                      }))}
                        label="View feedback"
                        title={`Feedback for ${post.title}`}
                        className="feedback-button-outline"
                      />
                    ) : null}
                    {post.status === "PENDING" && user.role !== "ADMIN" ? (
                      <span className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
                        Locked
                      </span>
                    ) : (
                      <a
                        href={`/editor/edit/${post.id}`}
                        className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]"
                      >
                        {user.role === "ADMIN" && post.authorId === user.id ? "Edit story" : "Edit and resubmit"}
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
