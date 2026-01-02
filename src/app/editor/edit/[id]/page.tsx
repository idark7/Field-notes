import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { estimateReadTimeMinutes, extractPreviewText } from "@/lib/utils";
import { getMediaSortOrders } from "@/lib/mediaSort";
import { BlockEditor } from "@/components/BlockEditor";
import { SeoFields } from "@/components/SeoFields";
import { EditorAutosave } from "@/components/EditorAutosave";
import { PreSubmitChecklist } from "@/components/PreSubmitChecklist";
import { EditorPreview } from "@/components/EditorPreview";
import { FeedbackModal } from "@/components/FeedbackModal";
import { VersionHistoryModal } from "@/components/VersionHistoryModal";
import { SiteFooter } from "@/components/SiteFooter";

async function updatePost(formData: FormData) {
  "use server";

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const postId = String(formData.get("postId") || "");
  const title = String(formData.get("title") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const metaTitle = String(formData.get("metaTitle") || "").trim();
  const metaDesc = String(formData.get("metaDesc") || "").trim();
  const tagsRaw = String(formData.get("tags") || "").trim();
  const categoriesRaw = String(formData.get("categories") || "").trim();
  const altTextRaw = String(formData.get("altText") || "").trim();

  if (!postId || !title || !content) {
    return;
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || (post.authorId !== user.id && user.role !== "ADMIN")) {
    redirect("/editor/basic");
  }

  if (post.status === "PENDING" && user.role !== "ADMIN") {
    redirect("/editor/basic?view=stories&tab=review&locked=1");
  }

  const readTimeMin = estimateReadTimeMinutes(content);
  const status = user.role === "ADMIN" ? post.status : "PENDING";
  const resolvedExcerpt = excerpt || extractPreviewText(content, 160);
  const shouldRevise = status !== "DRAFT";
  const nextRevision = shouldRevise ? post.revision + 1 : post.revision;

  if (shouldRevise) {
    await prisma.$transaction([
      prisma.post.update({
        where: { id: postId },
        data: {
          title,
          excerpt: resolvedExcerpt,
          content,
          metaTitle: metaTitle || null,
          metaDesc: metaDesc || null,
          status,
          readTimeMin,
          revision: nextRevision,
        },
      }),
      prisma.postRevision.create({
        data: {
          postId,
          revision: nextRevision,
          title,
          excerpt: resolvedExcerpt,
          content,
          metaTitle: metaTitle || null,
          metaDesc: metaDesc || null,
        },
      }),
    ]);
  } else {
    await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        excerpt: resolvedExcerpt,
        content,
        metaTitle: metaTitle || null,
        metaDesc: metaDesc || null,
        status,
        readTimeMin,
      },
    });
  }

  await prisma.postTag.deleteMany({ where: { postId } });
  await prisma.postCategory.deleteMany({ where: { postId } });

  const tagNames = tagsRaw
    ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];
  const categoryNames = categoriesRaw
    ? categoriesRaw.split(",").map((cat) => cat.trim()).filter(Boolean)
    : [];

  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await prisma.postTag.create({ data: { postId, tagId: tag.id } });
  }

  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await prisma.postCategory.create({
      data: { postId, categoryId: category.id },
    });
  }

  void altTextRaw;

  const mediaPreviewRaw = String(formData.get("mediaPreview") || "");
  const mediaOrders = getMediaSortOrders(content, mediaPreviewRaw);
  if (mediaOrders.length) {
    const mediaIds = mediaOrders.map((order) => order.id);
    const existingMedia = await prisma.media.findMany({
      where: { id: { in: mediaIds }, postId },
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

  if (status === "APPROVED") {
    redirect(`/essay/${post.slug}`);
  }

  redirect("/editor/basic?submitted=1");
}

async function restoreRevision(formData: FormData) {
  "use server";

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const revisionId = String(formData.get("revisionId") || "");
  if (!revisionId) {
    return;
  }

  const revision = await prisma.postRevision.findUnique({
    where: { id: revisionId },
    include: { post: true },
  });
  if (!revision) {
    return;
  }

  if (user.role !== "ADMIN" && revision.post.authorId !== user.id) {
    redirect("/editor/basic");
  }

  const nextRevision = revision.post.revision + 1;
  const resolvedExcerpt = revision.excerpt || extractPreviewText(revision.content, 160);
  const status = user.role === "ADMIN" ? revision.post.status : "PENDING";
  const readTimeMin = estimateReadTimeMinutes(revision.content);

  await prisma.$transaction([
    prisma.post.update({
      where: { id: revision.postId },
      data: {
        title: revision.title,
        excerpt: resolvedExcerpt,
        content: revision.content,
        metaTitle: revision.metaTitle,
        metaDesc: revision.metaDesc,
        status,
        readTimeMin,
        revision: nextRevision,
      },
    }),
    prisma.postRevision.create({
      data: {
        postId: revision.postId,
        revision: nextRevision,
        title: revision.title,
        excerpt: resolvedExcerpt,
        content: revision.content,
        metaTitle: revision.metaTitle,
        metaDesc: revision.metaDesc,
      },
    }),
  ]);

  redirect(`/editor/edit/${revision.postId}?restored=1`);
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const resolvedParams = await params;
  const post = await prisma.post.findUnique({
    where: { id: resolvedParams.id },
    include: {
      tags: { include: { tag: true } },
      categories: { include: { category: true } },
      adminNotes: { orderBy: { createdAt: "desc" } },
      revisions: { orderBy: { revision: "desc" } },
      media: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, mimeType: true, altText: true, fileName: true, sortOrder: true },
      },
    },
  });

  if (!post || (post.authorId !== user.id && user.role !== "ADMIN")) {
    redirect("/editor/basic");
  }

  const tags = post.tags.map((tag) => tag.tag.name).join(", ");
  const categories = post.categories.map((cat) => cat.category.name).join(", ");
  const feedbackEntries = post.adminNotes.map((note) => ({
    id: note.id,
    postId: post.id,
    postTitle: post.title,
    status: post.status,
    note: note.text,
    revision: note.revision ?? post.revision,
    createdAt: note.createdAt.toISOString(),
  }));
  const revisionEntries = post.revisions.map((revision) => ({
    id: revision.id,
    revision: revision.revision,
    createdAt: revision.createdAt.toISOString(),
  }));
  const versionLabel = `Version ${post.revision}`;

  return (
    <>
      <main className="page-shell pb-16">
        <section className="section-card p-10 editor-surface">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">Edit Essay</p>
              <h2 className="text-3xl font-semibold mt-4" style={{ fontFamily: "var(--font-display)" }}>
                Update your field note
              </h2>
              <p className="mt-2 text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
                {versionLabel}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {feedbackEntries.length > 0 ? (
                <FeedbackModal
                  notes={feedbackEntries}
                  label="View feedback"
                  title={`Feedback for ${post.title}`}
                  className="feedback-button-outline"
                />
              ) : null}
              <VersionHistoryModal
                revisions={revisionEntries}
                currentRevision={post.revision}
                restoreAction={restoreRevision}
              />
              <EditorPreview formId="editor-form" />
            </div>
          </div>
          <form id="editor-form" action={updatePost} className="mt-8 grid gap-6">
            <EditorAutosave draftKey={`edit-${post.id}`} />
            <input type="hidden" name="postId" value={post.id} />
            <div className="editor-layout">
              <div className="editor-main">
                <input
                  type="text"
                  name="title"
                  defaultValue={post.title}
                  required
                  className="editor-title"
                  id="editor-title"
                  data-autosave="title"
                />
                <BlockEditor initialContent={post.content} initialMedia={post.media} />
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
                        defaultValue={tags}
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
                        defaultValue={categories}
                        className="editor-input"
                        id="editor-categories"
                        data-autosave="categories"
                      />
                    </div>
                  </div>
                </div>
                <div className="editor-panel-card">
                  <p className="editor-panel-title">SEO</p>
                  <SeoFields excerpt={post.excerpt ?? ""} metaTitle={post.metaTitle ?? ""} metaDesc={post.metaDesc ?? ""} />
                </div>
                <PreSubmitChecklist
                  formId="editor-form"
                  buttonLabel={user.role === "ADMIN" && post.authorId === user.id ? "Publish changes" : "Resubmit for Review"}
                />
              </aside>
            </div>
          </form>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
