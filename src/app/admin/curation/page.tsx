import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { AdminCurationForm } from "@/components/AdminCurationForm";

async function updateCuration(formData: FormData) {
  "use server";

  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const featuredRaw = String(formData.get("featuredPostId") || "").trim();
  const featuredPostId = featuredRaw && featuredRaw !== "none" ? featuredRaw : "";
  const editorialPickIds = formData
    .getAll("editorialPickIds")
    .map((value) => String(value))
    .filter(Boolean);

  const uniqueEditorial = Array.from(new Set(editorialPickIds));
  if (featuredPostId && uniqueEditorial.includes(featuredPostId)) {
    redirect("/admin/curation?error=Featured%20story%20cannot%20also%20be%20an%20editorial%20pick.");
  }

  const validateIds = [featuredPostId, ...uniqueEditorial].filter(Boolean);
  if (validateIds.length) {
    const approved = await prisma.post.findMany({
      where: { id: { in: validateIds }, status: "APPROVED" },
      select: { id: true },
    });
    if (approved.length !== validateIds.length) {
      redirect("/admin/curation?error=Only%20approved%20stories%20can%20be%20curated.");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.updateMany({
      data: { isFeatured: false, editorialPickOrder: null },
    });

    if (featuredPostId) {
      await tx.post.update({
        where: { id: featuredPostId },
        data: { isFeatured: true },
      });
    }

    await Promise.all(
      uniqueEditorial.map((postId, index) =>
        tx.post.update({
          where: { id: postId },
          data: { editorialPickOrder: index + 1 },
        })
      )
    );
  });

  redirect("/admin/curation?saved=1");
}

export default async function AdminCurationPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const saved = resolvedSearchParams?.saved === "1";
  const error = resolvedSearchParams?.error ? decodeURIComponent(resolvedSearchParams.error) : "";

  const posts = await prisma.post.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      author: { select: { name: true } },
      isFeatured: true,
      editorialPickOrder: true,
      media: {
        where: { type: "PHOTO" },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const featuredId = posts.find((post) => post.isFeatured)?.id ?? "";
  const editorialOrder = posts
    .filter((post) => post.editorialPickOrder !== null)
    .sort((a, b) => (a.editorialPickOrder ?? 0) - (b.editorialPickOrder ?? 0))
    .map((post) => post.id);
  const postsForForm = posts.map((post) => ({
    id: post.id,
    title: post.title,
    createdAt: post.createdAt.toISOString(),
    authorName: post.author.name,
    mediaId: post.media[0]?.id ?? null,
  }));

  return (
    <main className="page-shell pb-16">
      <section className="section-card p-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
              Admin
            </p>
            <h2 className="mt-4 text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Home curation
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Shape the home page narrative by featuring one story and highlighting editorial picks.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {saved ? (
              <span className="rounded-full px-4 py-2 text-xs uppercase tracking-[0.3em]" style={{ background: "var(--bg-accent-light)", color: "var(--accent)" }}>
                Saved
              </span>
            ) : null}
            <Link
              href="/admin"
              className="rounded-full border px-5 py-2 text-sm font-semibold"
              style={{ borderColor: "var(--border-gray)", color: "var(--text-primary)" }}
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <AdminCurationForm
          posts={postsForForm}
          initialFeaturedId={featuredId}
          initialEditorialOrder={editorialOrder}
          saved={saved}
          error={error}
          action={updateCuration}
        />
      </section>
    </main>
  );
}
