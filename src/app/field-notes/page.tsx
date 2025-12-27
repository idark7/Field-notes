import { prisma } from "@/lib/db";
import { FieldNotesGrid } from "@/components/FieldNotesGrid";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default async function FieldNotesIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    focus?: string;
    page?: string;
    pageSize?: string;
    category?: string;
    tag?: string;
    author?: string;
    collection?: string;
  }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialQuery = resolvedSearchParams?.q ? decodeURIComponent(resolvedSearchParams.q) : "";
  const autoFocus = resolvedSearchParams?.focus === "1" || resolvedSearchParams?.focus === "true";
  const categoryParam = resolvedSearchParams?.category ? decodeURIComponent(resolvedSearchParams.category) : "";
  const tagParam = resolvedSearchParams?.tag ? decodeURIComponent(resolvedSearchParams.tag) : "";
  const authorParam = resolvedSearchParams?.author ? decodeURIComponent(resolvedSearchParams.author) : "";
  const collectionParam = resolvedSearchParams?.collection ? decodeURIComponent(resolvedSearchParams.collection) : "";
  const currentPage = Math.max(1, Number.parseInt(resolvedSearchParams?.page || "1", 10) || 1);
  const parsedPageSize = Number.parseInt(resolvedSearchParams?.pageSize || "6", 10);
  const pageSize = Number.isNaN(parsedPageSize) || parsedPageSize < 1 ? 6 : Math.min(parsedPageSize, 24);
  const initialCollection = collectionParam.toLowerCase() === "editorial" ? "editorial" : "all";

  let posts: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    content: string;
    readTimeMin: number;
    createdAt: Date;
    author: { name: string; image?: string | null };
    categories: { category: { id: string; name: string } }[];
    tags: { tag: { name: string } }[];
    media: { id: string; type: "PHOTO" | "VIDEO" }[];
    _count: { likes: number; comments: number };
  }> = [];
  let categories: Array<{ id: string; name: string }> = [];
  let tags: Array<{ id: string; name: string }> = [];
  let totalCount = 0;

  try {
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

    if (initialQuery) {
      where.OR = [
        { title: { contains: initialQuery, mode: "insensitive" as const } },
        { excerpt: { contains: initialQuery, mode: "insensitive" as const } },
        { content: { contains: initialQuery, mode: "insensitive" as const } },
        { author: { name: { contains: initialQuery, mode: "insensitive" as const } } },
        { categories: { some: { category: { name: { contains: initialQuery, mode: "insensitive" as const } } } } },
        { tags: { some: { tag: { name: { contains: initialQuery, mode: "insensitive" as const } } } } },
      ];
    }

    if (categoryParam && categoryParam !== "All") {
      where.categories = { some: { category: { name: { equals: categoryParam, mode: "insensitive" } } } };
    }

    if (tagParam && tagParam !== "All") {
      where.tags = { some: { tag: { name: { equals: tagParam, mode: "insensitive" } } } };
    }

    if (authorParam && authorParam !== "All") {
      where.author = { name: { equals: authorParam, mode: "insensitive" } };
    }

    if (initialCollection === "editorial") {
      where.editorialPickOrder = { not: null };
    }

    [posts, totalCount, categories, tags] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          categories: { include: { category: { select: { id: true, name: true } } } },
          tags: { include: { tag: true } },
          author: true,
          media: { select: { id: true, type: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: initialCollection === "editorial" ? { editorialPickOrder: "asc" } : { createdAt: "desc" },
        take: pageSize,
        skip: (currentPage - 1) * pageSize,
      }),
      prisma.post.count({ where }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
    ]);
  } catch (error) {
    console.error("Database connection error:", error);
  }

  return (
    <main style={{ background: 'var(--bg-white)', color: 'var(--text-primary)' }}>
      <FieldNotesGrid
        posts={posts}
        categories={categories}
        tags={tags}
        initialQuery={initialQuery}
        autoFocus={autoFocus}
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={totalCount}
        initialCollection={initialCollection}
      />
      <SiteFooter />
    </main>
  );
}
