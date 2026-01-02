import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as { postId?: string; status?: string };
  const postId = payload.postId?.trim();
  const status = payload.status?.trim();

  if (!postId || !status) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post || (user.role !== "ADMIN" && post.authorId !== user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.post.update({
    where: { id: postId },
    data: { status: status as "DRAFT" | "PENDING" | "APPROVED" | "NEEDS_CHANGES" | "REJECTED" },
  });

  return NextResponse.json({ ok: true });
}
