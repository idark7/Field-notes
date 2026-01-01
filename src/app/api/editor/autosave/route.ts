import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { estimateReadTimeMinutes, extractPreviewText, slugify } from "@/lib/utils";

type AutosavePayload = {
  postId?: string;
  title?: string;
  excerpt?: string;
  content?: string;
  metaTitle?: string;
  metaDesc?: string;
  tags?: string;
  categories?: string;
};

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as AutosavePayload;
  const title = (payload.title || "Untitled field note").trim();
  const content = String(payload.content || "");
  const excerpt = String(payload.excerpt || extractPreviewText(content, 160));
  const metaTitle = payload.metaTitle?.trim() || null;
  const metaDesc = payload.metaDesc?.trim() || null;
  const readTimeMin = estimateReadTimeMinutes(content);

  const tagNames = payload.tags
    ? payload.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];
  const categoryNames = payload.categories
    ? payload.categories.split(",").map((cat) => cat.trim()).filter(Boolean)
    : [];

  let postId = payload.postId?.trim();
  if (postId) {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
    if (!post || (user.role !== "ADMIN" && post.authorId !== user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        excerpt,
        content,
        metaTitle,
        metaDesc,
        readTimeMin,
      },
    });
  } else {
    const slugBase = slugify(title || "draft");
    const slug = `${slugBase}-${Date.now().toString().slice(-6)}`;
    const post = await prisma.post.create({
      data: {
        authorId: user.id,
        title,
        slug,
        excerpt,
        content,
        metaTitle,
        metaDesc,
        status: "DRAFT",
        readTimeMin,
      },
    });
    postId = post.id;
  }

  if (postId) {
    await prisma.postTag.deleteMany({ where: { postId } });
    await prisma.postCategory.deleteMany({ where: { postId } });

    for (const name of tagNames) {
      const tag = await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      await prisma.postTag.create({ data: { postId, tagId: tag.id } });
    }

    for (const name of categoryNames) {
      const category = await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      await prisma.postCategory.create({ data: { postId, categoryId: category.id } });
    }
  }

  return NextResponse.json({ postId });
}
