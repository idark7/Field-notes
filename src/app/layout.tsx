import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NotificationsBell } from "@/components/NotificationsBell";
import { LogoutButton } from "@/components/LogoutButton";
import gdtLogo from "@/app/assets/gdt_logo.png";
import { SiteNav } from "@/components/SiteNav";
import { ThemeInitializer } from "@/components/ThemeInitializer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

const displayFont = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GDT Field Notes",
  description: "Media-driven travel essays and field notes.",
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  href: string;
};

type NotificationSummary = {
  pendingReview?: number;
  likes?: number;
  shares?: number;
  comments?: number;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  const notificationData: { items: NotificationItem[]; summary?: NotificationSummary } = user
    ? await (async () => {
        if (user.role === "ADMIN") {
          const [pendingReview, likes, shares, comments] = await Promise.all([
            prisma.post.count({ where: { status: "PENDING" } }),
            prisma.like.count(),
            prisma.like.count({ where: { post: { author: { role: "ADMIN" } } } }),
            prisma.comment.count(),
          ]);

          return {
            items: [],
            summary: {
              pendingReview,
              likes,
              shares,
              comments,
            },
          };
        }

        const [notes, adminComments, likesCount] = await Promise.all([
          prisma.adminNote.findMany({
            where: { post: { authorId: user.id, status: { in: ["NEEDS_CHANGES", "REJECTED"] } } },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { post: true },
          }),
          prisma.comment.findMany({
            where: { post: { authorId: user.id }, author: { role: "ADMIN" } },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { post: true },
          }),
          prisma.like.count({ where: { post: { authorId: user.id } } }),
        ]);

        const items = [
          ...notes.map((note) => ({
            id: `notes:${note.id}`,
            title: note.post.title,
            message: note.text,
            createdAt: note.createdAt,
            href: `/notifications/notes:${note.id}`,
          })),
          ...adminComments.map((comment) => ({
            id: `admin-comments:${comment.id}`,
            title: comment.post.title,
            message: comment.text,
            createdAt: comment.createdAt,
            href: `/notifications/admin-comments:${comment.id}`,
          })),
        ];

        return {
          items: items
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 5)
            .map((item) => ({
              ...item,
              createdAt: item.createdAt.toLocaleDateString(),
            })),
          summary: {
            likes: likesCount,
          },
        };
      })()
    : { items: [] };

  const notificationItems = notificationData.items;
  const notificationSummary = notificationData.summary;

  return (
    <html lang="en">
      <head />
      <body className={`${displayFont.variable} ${bodyFont.variable} antialiased`} suppressHydrationWarning>
        <ThemeInitializer />
        <header className="sticky top-0 z-40 backdrop-blur" style={{
          borderBottom: '1px solid var(--border-gray)',
          background: 'var(--header-bg)'
        }}>
          <div className="mx-auto flex h-[73px] max-w-[1232px] flex-wrap items-center justify-between gap-4 px-6">
            <Link href="/home" className="flex items-center">
              <img
                src={gdtLogo.src}
                alt="Great D'Tour"
                className="site-logo"
              />
            </Link>
            <SiteNav className="hidden items-center gap-8 text-[16px] md:flex" />
            <div className="flex items-center gap-3">
              <Link
                href="/field-notes?focus=1"
                className="hidden h-10 w-10 items-center justify-center transition md:inline-flex"
                style={{ color: 'var(--text-primary)' }}
                aria-label="Search stories"
              >
                <span className="relative h-5 w-5">
                  <span className="absolute" style={{ inset: "12.5% 20.83% 20.83% 12.5%" }}>
                    <img
                      src="/assets/figma/search-vector-1.svg"
                      alt=""
                      className="block h-full w-full dark:invert"
                    />
                  </span>
                  <span className="absolute" style={{ inset: "69.58% 12.5% 12.5% 69.58%" }}>
                    <img
                      src="/assets/figma/search-vector-2.svg"
                      alt=""
                      className="block h-full w-full dark:invert"
                    />
                  </span>
                </span>
              </Link>
              <ThemeToggle />
              <div className="hidden items-center gap-4 md:flex">
                {user ? (
                  <UserMenu
                    user={user}
                    notifications={notificationItems}
                    notificationSummary={notificationSummary}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <Link className="user-link" href="/login">
                      Login
                    </Link>
                    <Link className="user-link user-link-outline" href="/register">
                      Register
                    </Link>
                    <Link href="/editor" className="header-action">
                      <span className="header-action-icon" aria-hidden>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </span>
                      Write
                    </Link>
                  </div>
                )}
              </div>
              <details className="relative md:hidden">
                <summary className="list-none [&::-webkit-details-marker]:hidden">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{
                    border: '1px solid var(--border-gray)',
                    color: 'var(--text-primary)'
                  }}>
                    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 6h16" />
                      <path d="M4 12h16" />
                      <path d="M4 18h16" />
                    </svg>
                  </span>
                </summary>
                <div className="absolute right-0 mt-3 w-64 rounded-2xl p-4 shadow-lg" style={{
                  border: '1px solid var(--border-gray)',
                  background: 'var(--bg-white)',
                  color: 'var(--text-primary)'
                }}>
                  <SiteNav className="grid gap-3 text-[16px]" />
                <div className="mt-4 grid gap-3 pt-4 text-[14px]" style={{
                  borderTop: '1px solid var(--border-gray)',
                  color: 'var(--text-secondary)'
                }}>
                  {user ? (
                    <>
                        <div className="flex items-center gap-3">
                          {user.image ? (
                            <img src={user.image} alt={user.name} className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold" style={{
                              background: 'var(--bg-gray-100)',
                              color: 'var(--text-tertiary)'
                            }}>
                              {getInitials(user.name)}
                            </span>
                          )}
                          <div>
                            <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
                            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Signed in</p>
                          </div>
                        </div>
                        <Link href="/profile">Profile</Link>
                        <Link href={user.role === "ADMIN" ? "/admin" : "/editor?view=stories"}>
                          {user.role === "ADMIN" ? "Admin dashboard" : "My stories"}
                        </Link>
                        <LogoutButton className="text-left" style={{ color: 'var(--text-secondary)' }} />
                        <NotificationsBell
                          items={notificationItems}
                          summary={notificationSummary}
                        />
                    </>
                  ) : (
                    <>
                      <Link href="/login">Login</Link>
                      <Link href="/register">Register</Link>
                    </>
                  )}
                  <Link
                    href="/field-notes?focus=1"
                    className="flex h-10 w-full items-center justify-center rounded-full text-[14px] font-medium"
                    style={{
                      border: '1px solid var(--border-gray)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    Search
                  </Link>
                  <ThemeToggle />
                  <Link
                      href="/editor"
                      className="flex h-10 items-center justify-center rounded-full px-4 text-[14px] font-medium"
                      style={{
                        background: 'var(--button-primary)',
                        color: '#ffffff'
                      }}
                    >
                      Write a Note
                    </Link>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
