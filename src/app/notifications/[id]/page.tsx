import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getNotificationDetail, notificationCategoryLabels } from "@/lib/notifications";

export default async function NotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const resolvedParams = await params;
  const notification = await getNotificationDetail(user, resolvedParams.id);
  if (!notification) {
    notFound();
  }

  return (
    <main className="page-shell pb-16">
      <section className="section-card p-10">
        <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
          {notificationCategoryLabels[notification.category]}
        </p>
        <h2
          className="text-3xl font-semibold mt-4"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          {notification.title}
        </h2>
        <p className="text-sm mt-3" style={{ color: "var(--text-secondary)" }}>
          {notification.message}
        </p>
        <p className="text-xs uppercase tracking-[0.3em] mt-6" style={{ color: "var(--text-muted)" }}>
          {notification.createdAt.toLocaleString()}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href={notification.href}
            className="header-action"
          >
            Open item
          </Link>
          <Link
            href="/notifications"
            className="edit-story-link"
          >
            Back to notifications
          </Link>
        </div>
      </section>
    </main>
  );
}
