import Link from "next/link";
import { redirect } from "next/navigation";
import { PostStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { estimateReadTimeMinutes, extractPreviewText } from "@/lib/utils";
import { getMediaSortOrders } from "@/lib/mediaSort";
import { TiptapEditor } from "@/components/TiptapEditor";
import { AdvancedEditorShell } from "@/components/AdvancedEditorShell";
import { SeoFields } from "@/components/SeoFields";
import { AdvancedPublishBar } from "@/components/AdvancedPublishBar";
import { EditorPreview } from "@/components/EditorPreview";

async function updatePost(formData: FormData) {
  "use server";

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const postId = String(formData.get("postId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const metaTitle = String(formData.get("metaTitle") || "").trim();
  const metaDesc = String(formData.get("metaDesc") || "").trim();
  const tagsRaw = String(formData.get("tags") || "").trim();
  const categoriesRaw = String(formData.get("categories") || "").trim();
  const altTextRaw = String(formData.get("altText") || "").trim();
  const statusRaw = String(formData.get("status") || "").trim();

  if (!postId || !title || !content) {
    return;
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, status: true, revision: true, slug: true },
  });
  if (!post || (post.authorId !== user.id && user.role !== "ADMIN")) {
    redirect("/editor/advanced");
  }

  if (post.status === "PENDING" && user.role !== "ADMIN") {
    redirect("/editor/advanced?locked=1");
  }

  const readTimeMin = estimateReadTimeMinutes(content);
  const resolvedExcerpt = excerpt || extractPreviewText(content, 160);
  const status = (
    statusRaw === "DRAFT"
      ? "DRAFT"
      : user.role === "ADMIN" && statusRaw
        ? statusRaw
        : "PENDING"
  ) as PostStatus;

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

  redirect("/editor/advanced?submitted=1");
}

export default async function AdvancedEditPage({ params }: { params: Promise<{ id: string }> }) {
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
    },
  });

  if (!post || (post.authorId !== user.id && user.role !== "ADMIN")) {
    redirect("/editor/advanced");
  }

  const tags = post.tags.map((tag) => tag.tag.name).join(", ");
  const categories = post.categories.map((cat) => cat.category.name).join(", ");

  return (
    <main className="min-h-screen pb-20" style={{ background: "var(--page-gradient)" }}>
      <AdvancedEditorShell />
      <section className="mx-auto w-full max-w-[1280px] px-6 pt-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">Edit story</p>
            <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Update your field note
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <EditorPreview formId="editor-form" />
            <Link
              href="/editor/basic"
              className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              Use basic editor
            </Link>
          </div>
        </div>

        <form id="editor-form" action={updatePost} className="mt-10 grid gap-10">
          <AdvancedPublishBar
            role={user.role}
            formId="editor-form"
            draftKey={`edit-${post.id}`}
            fallbackDraftKeys={[`advanced-${user.id}`]}
          />
          <input type="hidden" name="postId" value={post.id} data-autosave="postId" />
          <input type="hidden" name="status" defaultValue={post.status} />
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="editor-main">
              <input
                type="text"
                name="title"
                defaultValue={post.title}
                required
                className="w-full bg-transparent text-[44px] font-semibold leading-[1.1] text-[color:var(--text-primary)] placeholder:text-[color:var(--muted)] focus:outline-none"
                id="editor-title"
                data-autosave="title"
                style={{ fontFamily: "var(--font-display)" }}
              />
              <TiptapEditor initialContent={post.content} />
            </div>
            <aside className="grid gap-6">
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
            </aside>
          </div>
        </form>
      </section>
    </main>
  );
}
