import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPage = Number.parseInt(searchParams.get("page") || "1", 10);
  const rawPageSize = Number.parseInt(searchParams.get("pageSize") || "6", 10);
  const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const pageSize = Number.isNaN(rawPageSize) || rawPageSize < 1 ? 6 : Math.min(rawPageSize, 24);
  const query = (searchParams.get("q") || "").trim();
  const category = (searchParams.get("category") || "").trim();
  const tag = (searchParams.get("tag") || "").trim();
  const author = (searchParams.get("author") || "").trim();
  const collection = (searchParams.get("collection") || "").trim().toLowerCase();

  const where: {
    status: "APPROVED";
    OR?: Array<Record<string, unknown>>;
    categories?: { some: { category: { name: { equals: string; mode: "insensitive" } } } };
    tags?: { some: { tag: { name: { equals: string; mode: "insensitive" } } } };
    author?: { name: { equals: string; mode: "insensitive" } };
    editorialPickOrder?: { not: null };
  } = {
    status: "APPROVED",
  };

  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" as const } },
      { excerpt: { contains: query, mode: "insensitive" as const } },
      { content: { contains: query, mode: "insensitive" as const } },
      { author: { name: { contains: query, mode: "insensitive" as const } } },
      { categories: { some: { category: { name: { contains: query, mode: "insensitive" as const } } } } },
      { tags: { some: { tag: { name: { contains: query, mode: "insensitive" as const } } } } },
    ];
  }

  if (category && category !== "All") {
    where.categories = { some: { category: { name: { equals: category, mode: "insensitive" } } } };
  }

  if (tag && tag !== "All") {
    where.tags = { some: { tag: { name: { equals: tag, mode: "insensitive" } } } };
  }

  if (author && author !== "All") {
    where.author = { name: { equals: author, mode: "insensitive" } };
  }

  if (collection === "editorial") {
    where.editorialPickOrder = { not: null };
  }

  try {
    const [posts, totalCount] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          categories: { include: { category: { select: { id: true, name: true } } } },
          tags: { include: { tag: true } },
          author: true,
          media: { select: { id: true, type: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: collection === "editorial" ? { editorialPickOrder: "asc" } : { createdAt: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.post.count({ where }),
    ]);

    return NextResponse.json({ posts, totalCount });
  } catch (error) {
    console.error("Field notes query error:", error);
    return NextResponse.json({ posts: [], totalCount: 0 }, { status: 500 });
  }
}
