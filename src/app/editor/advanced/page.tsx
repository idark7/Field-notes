import Link from "next/link";
import { redirect } from "next/navigation";
import { PostStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { estimateReadTimeMinutes, extractPreviewText, slugify } from "@/lib/utils";
import { getMediaSortOrders } from "@/lib/mediaSort";
import { TiptapEditor } from "@/components/TiptapEditor";
import { AdvancedEditorShell } from "@/components/AdvancedEditorShell";
import { SeoFields } from "@/components/SeoFields";
import { AdvancedPublishBar } from "@/components/AdvancedPublishBar";
import { EditorPreview } from "@/components/EditorPreview";

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
  const status = (
    statusRaw === "DRAFT"
      ? "DRAFT"
      : user.role === "ADMIN" && statusRaw
        ? statusRaw
        : "PENDING"
  ) as PostStatus;

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
      redirect("/editor/advanced");
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

  redirect("/editor/advanced?submitted=1");
}

export default async function AdvancedEditorPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen pb-20" style={{ background: "var(--page-gradient)" }}>
      <AdvancedEditorShell />
      <section className="mx-auto w-full max-w-[1280px] px-6 pt-16">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <EditorPreview formId="editor-form" />
          <Link
            href="/editor/basic"
            className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
          >
            Use basic editor
          </Link>
        </div>

        <form id="editor-form" action={createPost} className="mt-10 grid gap-10">
          <AdvancedPublishBar
            role={user.role}
            formId="editor-form"
            draftKey={`new-${user.id}`}
            fallbackDraftKeys={[`advanced-${user.id}`]}
          />
          <input type="hidden" name="postId" data-autosave="postId" />
          <input type="hidden" name="status" defaultValue="DRAFT" />
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="editor-main">
              <input
                type="text"
                name="title"
                placeholder="Title"
                required
                className="w-full bg-transparent text-[44px] font-semibold leading-[1.1] text-[color:var(--text-primary)] placeholder:text-[color:var(--muted)] focus:outline-none"
                id="editor-title"
                data-autosave="title"
                style={{ fontFamily: "var(--font-display)" }}
              />
              <TiptapEditor />
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
            </aside>
          </div>
        </form>
      </section>
    </main>
  );
}
