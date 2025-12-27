"use client";

import { useEffect, useState } from "react";

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

  return (
    <div className="relative">
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
                <div className="header-popover-item">
                  <p className="font-semibold">Pending review</p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    {summary.pendingReview} item(s) need review.
                  </p>
                </div>
              ) : null}
              {summary?.likes ? (
                <div className="header-popover-item">
                  <p className="font-semibold">Likes</p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    {summary.likes} new like(s).
                  </p>
                </div>
              ) : null}
              {summary?.shares ? (
                <div className="header-popover-item">
                  <p className="font-semibold">Shares</p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    {summary.shares} share(s) on admin stories.
                  </p>
                </div>
              ) : null}
              {summary?.comments ? (
                <div className="header-popover-item">
                  <p className="font-semibold">Comments</p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    {summary.comments} new comment(s).
                  </p>
                </div>
              ) : null}
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="header-popover-item"
                >
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">{item.message}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {item.createdAt}
                  </p>
                </a>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
