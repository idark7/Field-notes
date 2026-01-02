import { prisma } from "@/lib/db";

export const notificationCategoryLabels = {
  "pending-review": "Pending review",
  likes: "Likes",
  shares: "Shares",
  comments: "Comments",
  notes: "Admin notes",
  "admin-comments": "Admin comments",
} as const;

export type NotificationCategory = keyof typeof notificationCategoryLabels;

export type NotificationListItem = {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  createdAt: Date;
  href: string;
};

export type NotificationSummary = {
  pendingReview?: number;
  likes?: number;
  shares?: number;
  comments?: number;
};

const adminCategories: NotificationCategory[] = ["pending-review", "likes", "shares", "comments"];
const userCategories: NotificationCategory[] = ["notes", "admin-comments", "likes"];

export function getNotificationCategoriesForRole(role: string) {
  return role === "ADMIN" ? adminCategories : userCategories;
}

export function isNotificationCategory(value: string): value is NotificationCategory {
  return value in notificationCategoryLabels;
}

export async function getNotificationSummary(user: { id: string; role: string }) {
  if (user.role === "ADMIN") {
    const [pendingReview, likes, shares, comments] = await Promise.all([
      prisma.post.count({ where: { status: "PENDING" } }),
      prisma.like.count(),
      prisma.like.count({ where: { post: { author: { role: "ADMIN" } } } }),
      prisma.comment.count(),
    ]);

    return {
      pendingReview,
      likes,
      shares,
      comments,
    } satisfies NotificationSummary;
  }

  const likes = await prisma.like.count({ where: { post: { authorId: user.id } } });
  return { likes } satisfies NotificationSummary;
}

export async function getNotificationsForUser(
  user: { id: string; role: string },
  options: { filter?: NotificationCategory; limit?: number } = {}
) {
  const { filter, limit } = options;
  const items: NotificationListItem[] = [];
  const take = limit ?? 50;

  if (user.role === "ADMIN") {
    if (!filter || filter === "pending-review") {
      const posts = await prisma.post.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take,
        include: { author: true },
      });

      items.push(
        ...posts.map((post) => ({
          id: `pending-review:${post.id}`,
          category: "pending-review",
          title: post.title,
          message: `Submitted by ${post.author.name}.`,
          createdAt: post.createdAt,
          href: `/essay/${post.slug}?review=1`,
        }))
      );
    }

    if (!filter || filter === "likes") {
      const likes = await prisma.like.findMany({
        orderBy: { createdAt: "desc" },
        take,
        include: { post: true, user: true },
      });

      items.push(
        ...likes.map((like) => ({
          id: `likes:${like.id}`,
          category: "likes",
          title: like.post.title,
          message: `Liked by ${like.user.name}.`,
          createdAt: like.createdAt,
          href: `/essay/${like.post.slug}`,
        }))
      );
    }

    if (!filter || filter === "shares") {
      const shares = await prisma.like.findMany({
        where: { post: { author: { role: "ADMIN" } } },
        orderBy: { createdAt: "desc" },
        take,
        include: { post: { include: { author: true } }, user: true },
      });

      items.push(
        ...shares.map((like) => ({
          id: `shares:${like.id}`,
          category: "shares",
          title: like.post.title,
          message: `Shared by ${like.user.name}.`,
          createdAt: like.createdAt,
          href: `/essay/${like.post.slug}`,
        }))
      );
    }

    if (!filter || filter === "comments") {
      const comments = await prisma.comment.findMany({
        orderBy: { createdAt: "desc" },
        take,
        include: { post: true, author: true },
      });

      items.push(
        ...comments.map((comment) => ({
          id: `comments:${comment.id}`,
          category: "comments",
          title: comment.post.title,
          message: `${comment.author.name}: ${comment.text}`,
          createdAt: comment.createdAt,
          href: `/essay/${comment.post.slug}`,
        }))
      );
    }
  } else {
    if (!filter || filter === "notes") {
      const notes = await prisma.adminNote.findMany({
        where: { post: { authorId: user.id, status: { in: ["NEEDS_CHANGES", "REJECTED"] } } },
        orderBy: { createdAt: "desc" },
        take,
        include: { post: true, admin: true },
      });

      items.push(
        ...notes.map((note) => ({
          id: `notes:${note.id}`,
          category: "notes",
          title: note.post.title,
          message: note.text,
          createdAt: note.createdAt,
          href: `/editor/edit/${note.postId}`,
        }))
      );
    }

    if (!filter || filter === "admin-comments") {
      const comments = await prisma.comment.findMany({
        where: { post: { authorId: user.id }, author: { role: "ADMIN" } },
        orderBy: { createdAt: "desc" },
        take,
        include: { post: true, author: true },
      });

      items.push(
        ...comments.map((comment) => ({
          id: `admin-comments:${comment.id}`,
          category: "admin-comments",
          title: comment.post.title,
          message: comment.text,
          createdAt: comment.createdAt,
          href: `/essay/${comment.post.slug}`,
        }))
      );
    }

    if (!filter || filter === "likes") {
      const likes = await prisma.like.findMany({
        where: { post: { authorId: user.id } },
        orderBy: { createdAt: "desc" },
        take,
        include: { post: true, user: true },
      });

      items.push(
        ...likes.map((like) => ({
          id: `likes:${like.id}`,
          category: "likes",
          title: like.post.title,
          message: `Liked by ${like.user.name}.`,
          createdAt: like.createdAt,
          href: `/essay/${like.post.slug}`,
        }))
      );
    }
  }

  return items
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit ?? items.length);
}

export async function getNotificationDetail(user: { id: string; role: string }, notificationId: string) {
  const [category, entityId] = notificationId.split(":");
  if (!entityId || !isNotificationCategory(category)) {
    return null;
  }

  switch (category) {
    case "pending-review": {
      if (user.role !== "ADMIN") return null;
      const post = await prisma.post.findUnique({
        where: { id: entityId },
        include: { author: true },
      });
      if (!post) return null;
      return {
        id: notificationId,
        category,
        title: post.title,
        message: `Submitted by ${post.author.name}.`,
        createdAt: post.createdAt,
        href: `/essay/${post.slug}?review=1`,
      } satisfies NotificationListItem;
    }
    case "likes": {
      const like = await prisma.like.findUnique({
        where: { id: entityId },
        include: { post: true, user: true },
      });
      if (!like) return null;
      if (user.role !== "ADMIN" && like.post.authorId !== user.id) return null;
      return {
        id: notificationId,
        category,
        title: like.post.title,
        message: `Liked by ${like.user.name}.`,
        createdAt: like.createdAt,
        href: `/essay/${like.post.slug}`,
      } satisfies NotificationListItem;
    }
    case "shares": {
      if (user.role !== "ADMIN") return null;
      const like = await prisma.like.findUnique({
        where: { id: entityId },
        include: { post: { include: { author: true } }, user: true },
      });
      if (!like || like.post.author.role !== "ADMIN") return null;
      return {
        id: notificationId,
        category,
        title: like.post.title,
        message: `Shared by ${like.user.name}.`,
        createdAt: like.createdAt,
        href: `/essay/${like.post.slug}`,
      } satisfies NotificationListItem;
    }
    case "comments": {
      if (user.role !== "ADMIN") return null;
      const comment = await prisma.comment.findUnique({
        where: { id: entityId },
        include: { post: true, author: true },
      });
      if (!comment) return null;
      return {
        id: notificationId,
        category,
        title: comment.post.title,
        message: `${comment.author.name}: ${comment.text}`,
        createdAt: comment.createdAt,
        href: `/essay/${comment.post.slug}`,
      } satisfies NotificationListItem;
    }
    case "notes": {
      const note = await prisma.adminNote.findUnique({
        where: { id: entityId },
        include: { post: true, admin: true },
      });
      if (!note || note.post.authorId !== user.id) return null;
      return {
        id: notificationId,
        category,
        title: note.post.title,
        message: note.text,
        createdAt: note.createdAt,
        href: `/editor/edit/${note.postId}`,
      } satisfies NotificationListItem;
    }
    case "admin-comments": {
      const comment = await prisma.comment.findUnique({
        where: { id: entityId },
        include: { post: true, author: true },
      });
      if (!comment || comment.author.role !== "ADMIN" || comment.post.authorId !== user.id) return null;
      return {
        id: notificationId,
        category,
        title: comment.post.title,
        message: comment.text,
        createdAt: comment.createdAt,
        href: `/essay/${comment.post.slug}`,
      } satisfies NotificationListItem;
    }
    default:
      return null;
  }
}
