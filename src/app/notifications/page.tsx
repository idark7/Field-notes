import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  getNotificationCategoriesForRole,
  getNotificationsForUser,
  isNotificationCategory,
  notificationCategoryLabels,
} from "@/lib/notifications";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawFilter = resolvedSearchParams?.filter;
  const categories = getNotificationCategoriesForRole(user.role);
  const activeFilter =
    rawFilter && isNotificationCategory(rawFilter) && categories.includes(rawFilter)
      ? rawFilter
      : "all";

  const notifications = await getNotificationsForUser(user, {
    filter: activeFilter === "all" ? undefined : activeFilter,
    limit: 60,
  });

  return (
    <main className="page-shell pb-16">
      <section className="section-card p-10">
        <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
          Notifications
        </p>
        <h2
          className="text-3xl font-semibold mt-4"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          Activity center
        </h2>

        <div className="admin-tabs mt-8">
          <Link
            href="/notifications"
            className={`admin-tab ${activeFilter === "all" ? "admin-tab-active" : ""}`}
          >
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category}
              href={`/notifications?filter=${category}`}
              className={`admin-tab ${activeFilter === category ? "admin-tab-active" : ""}`}
            >
              {notificationCategoryLabels[category]}
            </Link>
          ))}
        </div>

        <div className="mt-8 grid gap-4">
          {notifications.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No notifications yet for this view.
            </p>
          ) : (
            notifications.map((item) => (
              <Link
                key={item.id}
                href={`/notifications/${item.id}`}
                className="section-card p-6 transition hover:opacity-80"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
                      {notificationCategoryLabels[item.category]}
                    </p>
                    <p className="text-lg font-semibold mt-3" style={{ color: "var(--text-primary)" }}>
                      {item.title}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
                    {item.createdAt.toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm mt-3" style={{ color: "var(--text-secondary)" }}>
                  {item.message}
                </p>
                <span className="mt-4 inline-flex text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-accent)" }}>
                  View details →
                </span>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
