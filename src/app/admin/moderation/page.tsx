import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { AdminModerationPanel } from "@/components/AdminModerationPanel";

async function updateStatus(formData: FormData) {
  "use server";

  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const postId = String(formData.get("postId") || "");
  const status = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim();

  if (!postId || !status) {
    return;
  }

  if ((status === "NEEDS_CHANGES" || status === "REJECTED") && !note) {
    return;
  }

  const post = await prisma.post.update({
    where: { id: postId },
    data: { status: status as any },
    select: { revision: true },
  });

  if (note) {
    await prisma.adminNote.create({
      data: { postId, adminId: user.id, text: note, revision: post.revision },
    });
  }

  redirect("/admin/moderation");
}

export default async function ModerationPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const pending = await prisma.post.findMany({
    where: { status: { in: ["PENDING", "NEEDS_CHANGES"] } },
    include: {
      author: true,
      media: { select: { id: true, type: true } },
      categories: { include: { category: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingCount = pending.filter((post) => post.status === "PENDING").length;
  const needsChangesCount = pending.filter((post) => post.status === "NEEDS_CHANGES").length;

  return (
    <main className="page-shell pb-16">
      <section className="section-card p-10">
        <div className="moderation-header">
          <div>
            <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>Moderation</p>
            <h2 className="text-3xl font-semibold mt-4" style={{ fontFamily: "var(--font-display)", color: 'var(--text-primary)' }}>
              Pending essays
            </h2>
          </div>
          <div className="moderation-stats">
            <div className="moderation-stat">
              <span className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>Pending</span>
              <strong style={{ color: 'var(--text-primary)' }}>{pendingCount}</strong>
            </div>
            <div className="moderation-stat">
              <span className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>
                Needs changes
              </span>
              <strong style={{ color: 'var(--text-primary)' }}>{needsChangesCount}</strong>
            </div>
          </div>
        </div>
        <div className="mt-8">
          <AdminModerationPanel posts={pending} action={updateStatus} />
        </div>
      </section>
    </main>
  );
}
