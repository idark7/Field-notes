import Link from "next/link";
import starIcon from "@/app/assets/star.svg";
import { prisma } from "@/lib/db";
import { SiteFooter } from "@/components/SiteFooter";
import { StoryCoverImage } from "@/components/StoryCoverImage";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getCategoryLabel(categories: { category: { name: string } }[]) {
  return categories[0]?.category.name ?? "Field Notes";
}

function getPhotoId(media: { id: string; type: "PHOTO" | "VIDEO" }[]) {
  return media.find((item) => item.type === "PHOTO")?.id;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function FieldNotesPage() {
  let featured: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    content: string;
    readTimeMin: number;
    createdAt: Date;
    author: { name: string; image?: string | null };
    categories: { category: { name: string } }[];
    media: { id: string; type: "PHOTO" | "VIDEO" }[];
    isFeatured: boolean;
    editorialPickOrder: number | null;
  } | null = null;
  let editorialPicks: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    content: string;
    readTimeMin: number;
    createdAt: Date;
    author: { name: string; image?: string | null };
    categories: { category: { name: string } }[];
    media: { id: string; type: "PHOTO" | "VIDEO" }[];
    isFeatured: boolean;
    editorialPickOrder: number | null;
  }> = [];
  let fieldNotes: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    content: string;
    readTimeMin: number;
    createdAt: Date;
    author: { name: string; image?: string | null };
    categories: { category: { name: string } }[];
    media: { id: string; type: "PHOTO" | "VIDEO" }[];
    isFeatured: boolean;
    editorialPickOrder: number | null;
  }> = [];

  const postInclude = {
    categories: { include: { category: true } },
    author: true,
    media: { select: { id: true, type: true } },
  } as const;

  try {
    featured = await prisma.post.findFirst({
      where: { status: "APPROVED", isFeatured: true },
      include: postInclude,
      orderBy: { createdAt: "desc" },
    });

    if (!featured) {
      featured = await prisma.post.findFirst({
        where: { status: "APPROVED" },
        include: postInclude,
        orderBy: { createdAt: "desc" },
      });
    }

    const editorialSelected = await prisma.post.findMany({
      where: {
        status: "APPROVED",
        editorialPickOrder: { not: null },
        ...(featured ? { id: { not: featured.id } } : {}),
      },
      include: postInclude,
      orderBy: { editorialPickOrder: "asc" },
      take: 6,
    });
    editorialPicks = editorialSelected;

    const curatedIds = [featured?.id, ...editorialPicks.map((post) => post.id)].filter(Boolean) as string[];
    fieldNotes = await prisma.post.findMany({
      where: { status: "APPROVED", id: { notIn: curatedIds } },
      include: postInclude,
      orderBy: { createdAt: "desc" },
      take: 3,
    });
  } catch (error) {
    console.error("Database connection error:", error);
  }

  return (
    <main style={{ background: 'var(--bg-white)', color: 'var(--text-primary)' }}>
      <section
        className="relative"
        style={{
          background: "var(--hero-gradient)",
        }}
      >
        <div className="mx-auto max-w-[1232px] px-6 py-24 text-center md:py-32">
          <h1
            className="text-[48px] leading-[1.1] tracking-[0.12px] md:text-[72px] md:leading-[72px]"
            style={{ fontFamily: "var(--font-display)", color: 'var(--text-primary)' }}
          >
            Stories from the Road
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-[18px] leading-[30px] md:text-[24px] md:leading-[39px] md:tracking-[0.07px]" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold italic">Field Notes</span> is Great D&apos;Tour&apos;s editorial
            journal capturing travel experiences, cultural encounters, and moments of wonder from
            explorers, exploring identity, experience, and meaning beyond destinations and deals.
          </p>
          <a
            href="#featured"
            className="btn-primary mt-10 inline-flex h-[60px] min-w-[204px] items-center justify-center gap-[6px] rounded-full px-8 text-[18px] font-medium tracking-[-0.44px] transition"
          >
            Start Reading
            <img src="/assets/figma/hero-arrow.svg" alt="" className="h-5 w-5" />
          </a>
        </div>
      </section>

      {featured ? (
        <section id="featured" className="py-16">
          <div className="mx-auto max-w-[1232px] px-6">
            <p className="text-[14px] uppercase tracking-[0.55px]" style={{ color: 'var(--text-muted)' }}>
              Featured Essay
            </p>
            {(() => {
              const featuredMediaId = getPhotoId(featured.media);
              return (
              <Link
                href={`/essay/${featured.slug}`}
                className={`mt-8 grid gap-8 pb-16 ${featuredMediaId ? "md:grid-cols-2" : ""}`}
                style={{ borderBottom: '1px solid var(--border-gray)' }}
              >
                {featuredMediaId ? (
                  <div className="order-2 md:order-1">
                    <StoryCoverImage
                      src={`/api/media/${featuredMediaId}`}
                      alt={featured.title}
                      className="h-[240px] w-full rounded-[10px] object-cover md:h-[375px]"
                    />
                  </div>
                ) : null}
                <div className="order-1 md:order-2">
                <p className="text-[14px] uppercase tracking-[0.55px] text-[#f54900]">
                  {getCategoryLabel(featured.categories)}
                </p>
                <h2
                  className="mt-3 text-[28px] font-semibold leading-[32px] md:text-[36px] md:leading-[40px]"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {featured.title}
                </h2>
                <p className="mt-4 text-[16px] leading-[26px] md:text-[18px] md:leading-[29px]" style={{ color: 'var(--text-tertiary)' }}>
                  {featured.excerpt ??
                    "An unforgettable journey through one of the world's most dramatic landscapes, where towering peaks meet endless glaciers and the wind carries stories of ancient explorers."}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-[14px] tracking-[-0.15px]" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-flex items-center gap-2">
                    {featured.author.image ? (
                      <img
                        src={featured.author.image}
                        alt={featured.author.name}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold" style={{ background: 'var(--bg-gray-200)', color: 'var(--text-tertiary)' }}>
                        {getInitials(featured.author.name)}
                      </span>
                    )}
                    <span>{featured.author.name}</span>
                  </span>
                  <span aria-hidden>&middot;</span>
                  <span>{formatDate(featured.createdAt)}</span>
                  <span aria-hidden>&middot;</span>
                  <span>{featured.readTimeMin} min read</span>
                </div>
                </div>
              </Link>
              );
            })()}
          </div>
        </section>
      ) : null}

      {editorialPicks.length ? (
        <section className="py-16">
          <div className="mx-auto max-w-[1232px] px-6">
            <div className="flex items-center justify-between">
              <h2
                className="text-[26px] font-semibold md:text-[30px] md:leading-[36px]"
                style={{ color: 'var(--text-primary)' }}
              >
                Editorial Picks
              </h2>
              <Link href="/field-notes?collection=editorial" className="text-[16px]" style={{ color: 'var(--text-tertiary)' }}>
                View all -&gt;
              </Link>
            </div>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {editorialPicks.map((post) => {
                const mediaId = getPhotoId(post.media);
                return (
                  <Link
                    key={post.id}
                    href={`/essay/${post.slug}`}
                    className="group"
                  >
                    <p className="text-[12px] uppercase tracking-[0.6px]" style={{ color: '#f54900' }}>
                      {getCategoryLabel(post.categories)}
                    </p>
                    <h3 className="mt-2 text-[20px] font-semibold leading-[28px] transition group-hover:opacity-80" style={{ color: 'var(--text-primary)' }}>
                      {post.title}
                    </h3>
                    <StoryCoverImage
                      src={mediaId ? `/api/media/${mediaId}` : undefined}
                      alt={post.title}
                      className="story-cover mt-3 h-[243px] w-full rounded-[10px] object-cover"
                    />
                    <p className="mt-3 text-[16px] leading-[24px] line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>
                      {post.excerpt ?? "Discover this travel story."}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-[14px] tracking-[-0.15px]" style={{ color: 'var(--text-muted)' }}>
                      <span className="inline-flex items-center gap-2">
                        {post.author.image ? (
                          <img
                            src={post.author.image}
                            alt={post.author.name}
                            className="h-5 w-5 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold" style={{ background: 'var(--bg-gray-200)', color: 'var(--text-tertiary)' }}>
                            {getInitials(post.author.name)}
                          </span>
                        )}
                        <span>{post.author.name}</span>
                      </span>
                      <span aria-hidden>&middot;</span>
                      <span>{post.readTimeMin} min read</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-6 py-16">
        <div className="mx-auto max-w-[1185px]">
          <div
            className="w-full rounded-2xl px-6 pb-16 pt-20 text-center md:px-36 md:pb-16 md:pt-20"
            style={{
              background:
                "radial-gradient(ellipse 50% 126.87% at 50% 50%, #D0110C 0%, #F47300 40%, #E84300 67%, #290B61 100%)",
              backdropFilter: "blur(71px)",
            }}
          >
            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#101828] px-5 py-2 text-sm text-white">
              <img src={starIcon.src} alt="" className="h-4 w-4" />
              <span>Coming Soon</span>
            </div>
            <h2 className="mt-8 text-[32px] font-semibold leading-tight text-white md:text-[48px]">
              Introducing Great D&apos;Tour
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-[18px] leading-8 text-white/90 md:text-[24px]">
              A new platform for discovering and booking niche travel experiences. From hidden
              cultural gems to off-the-beaten-path adventures, Great D&apos;Tour connects you with
              extraordinary journeys curated by local experts.
            </p>
            <div className="mt-10 flex justify-center">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-10 text-[16px] font-semibold text-[#D0110C]"
                style={{ color: "#D0110C" }}
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </section>

      {fieldNotes.length ? (
        <section className="py-16">
          <div className="mx-auto max-w-[1232px] px-6">
            <div className="flex items-center justify-between">
              <h2
                className="text-[26px] font-semibold md:text-[30px] md:leading-[36px]"
                style={{ color: 'var(--text-primary)' }}
              >
                Field Notes
              </h2>
              <Link href="/field-notes" className="text-[16px]" style={{ color: 'var(--text-tertiary)' }}>
                View all -&gt;
              </Link>
            </div>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {fieldNotes.map((post) => {
                const mediaId = getPhotoId(post.media);
                return (
                  <Link
                    key={post.id}
                    href={`/essay/${post.slug}`}
                    className="group"
                  >
                    <p className="text-[12px] uppercase tracking-[0.6px]" style={{ color: '#f54900' }}>
                      {getCategoryLabel(post.categories)}
                    </p>
                    <h3 className="mt-2 text-[20px] font-semibold leading-[28px] transition group-hover:opacity-80" style={{ color: 'var(--text-primary)' }}>
                      {post.title}
                    </h3>
                    <StoryCoverImage
                      src={mediaId ? `/api/media/${mediaId}` : undefined}
                      alt={post.title}
                      className="story-cover mt-3 h-[243px] w-full rounded-[10px] object-cover"
                    />
                    <p className="mt-3 text-[16px] leading-[24px] line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>
                      {post.excerpt ?? "Discover this travel story."}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-[14px] tracking-[-0.15px]" style={{ color: 'var(--text-muted)' }}>
                      <span className="inline-flex items-center gap-2">
                        {post.author.image ? (
                          <img
                            src={post.author.image}
                            alt={post.author.name}
                            className="h-5 w-5 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold" style={{ background: 'var(--bg-gray-200)', color: 'var(--text-tertiary)' }}>
                            {getInitials(post.author.name)}
                          </span>
                        )}
                        <span>{post.author.name}</span>
                      </span>
                      <span aria-hidden>&middot;</span>
                      <span>{post.readTimeMin} min read</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
      <SiteFooter />
    </main>
  );
}
