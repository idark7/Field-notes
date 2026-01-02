"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NotificationsBell } from "@/components/NotificationsBell";
import { LogoutButton } from "@/components/LogoutButton";

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

type UserMenuProps = {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role: string;
  };
  notifications: NotificationItem[];
  notificationSummary?: NotificationSummary;
  notificationBadgeCount?: number;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UserMenu({ user, notifications, notificationSummary, notificationBadgeCount }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isProfilePage = pathname?.startsWith("/profile");

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <div className="flex items-center gap-3">
      <Link href="/editor" className="header-action">
        <span className="header-action-icon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </span>
        Write
      </Link>
      <NotificationsBell
        items={notifications}
        summary={notificationSummary}
        badgeCount={notificationBadgeCount}
      />
      <div
        ref={menuRef}
        className={`relative user-menu ${open ? "is-open" : ""}`}
        data-open={open ? "true" : "false"}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="user-menu-trigger"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          {user.image ? (
            <img src={user.image} alt={user.name} className="user-menu-avatar" />
          ) : (
            <span className="user-menu-avatar">{getInitials(user.name)}</span>
          )}
        </button>
        <div className="user-menu-panel" aria-hidden={!open}>
          <div className="user-menu-header">
            {user.image ? (
              <img src={user.image} alt={user.name} className="user-menu-avatar-lg" />
            ) : (
              <span className="user-menu-avatar-lg">{getInitials(user.name)}</span>
            )}
            <div>
              <p className="user-menu-name">{user.name}</p>
              <Link className="user-menu-sub" href="/profile" onClick={closeMenu}>
                View profile
              </Link>
            </div>
          </div>
          <div className="user-menu-list">
            {isProfilePage ? null : (
              <Link className="user-menu-item" href="/profile" onClick={closeMenu}>
                <span className="user-menu-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3.5" />
                    <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V21a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H3a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V3a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H21a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
                  </svg>
                </span>
                Settings
              </Link>
            )}
            <Link
              className="user-menu-item"
              href={user.role === "ADMIN" ? "/admin" : "/editor?view=stories"}
              onClick={closeMenu}
            >
              <span className="user-menu-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 4h7v7H3z" />
                  <path d="M14 4h7v7h-7z" />
                  <path d="M14 13h7v7h-7z" />
                  <path d="M3 13h7v7H3z" />
                </svg>
              </span>
              {user.role === "ADMIN" ? "Admin dashboard" : "My stories"}
            </Link>
            <a className="user-menu-item" href="mailto:hello@greatdtour.com" onClick={closeMenu}>
              <span className="user-menu-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.5 9a2.5 2.5 0 1 1 4.1 2l-1.4 1.1v2" />
                  <circle cx="12" cy="17" r="0.7" />
                </svg>
              </span>
              Help
            </a>
          </div>
          <div className="user-menu-divider" />
          <div className="user-menu-footer" onClickCapture={closeMenu}>
            <LogoutButton className="user-menu-signout">Sign out</LogoutButton>
            <span className="user-menu-email">{user.email}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
