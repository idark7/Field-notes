"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

type NotificationsBellProps = {
  items: NotificationItem[];
  summary?: NotificationSummary;
  badgeCount?: number;
};

export function NotificationsBell({ items, summary, badgeCount }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const summaryCount = summary
    ? Object.values(summary).reduce((total, value) => total + (value ?? 0), 0)
    : 0;
  const initialCount = badgeCount ?? items.length + summaryCount;
  const [unreadCount, setUnreadCount] = useState(initialCount);
  const hasSummary = summaryCount > 0;
  const hasItems = items.length > 0;

  useEffect(() => {
    setUnreadCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(event.target as Node)) {
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

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setUnreadCount(0);
        }}
        className="header-icon-button"
        aria-label="Notifications"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="h-5 w-5"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unreadCount > 0 ? <span className="header-icon-badge">{unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="header-popover">
          <p className="header-popover-title">Notifications</p>
          {!hasItems && !hasSummary ? (
            <p className="header-popover-empty">No new updates yet.</p>
          ) : (
            <div className="mt-3 grid gap-3">
              {summary?.pendingReview ? (
                <Link
                  className="header-popover-item"
                  href="/notifications?filter=pending-review"
                  onClick={() => setOpen(false)}
                >
                  <p className="font-semibold">Pending review</p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    {summary.pendingReview} item(s) need review.
                  </p>
                </Link>
              ) : null}
              {summary?.likes ? (
                <Link
                  className="header-popover-item"
                  href="/notifications?filter=likes"
                  onClick={() => setOpen(false)}
                >
                  <p className="font-semibold">Likes</p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    {summary.likes} new like(s).
                  </p>
                </Link>
              ) : null}
              {summary?.shares ? (
                <Link
                  className="header-popover-item"
                  href="/notifications?filter=shares"
                  onClick={() => setOpen(false)}
                >
                  <p className="font-semibold">Shares</p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    {summary.shares} share(s) on admin stories.
                  </p>
                </Link>
              ) : null}
              {summary?.comments ? (
                <Link
                  className="header-popover-item"
                  href="/notifications?filter=comments"
                  onClick={() => setOpen(false)}
                >
                  <p className="font-semibold">Comments</p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    {summary.comments} new comment(s).
                  </p>
                </Link>
              ) : null}
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="header-popover-item"
                  onClick={() => setOpen(false)}
                >
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">{item.message}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {item.createdAt}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
