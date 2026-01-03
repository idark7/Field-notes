import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const MAX_IMAGE_SIZE = 700_000;

export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const bio = typeof body?.bio === "string" ? body.bio.trim() : "";
  const image =
    typeof body?.image === "string"
      ? body.image.trim()
      : body?.image === null
        ? null
        : undefined;

  if (name && name.length > 80) {
    return NextResponse.json({ error: "Name is too long." }, { status: 400 });
  }

  if (bio && bio.length > 400) {
    return NextResponse.json({ error: "Bio is too long." }, { status: 400 });
  }

  if (typeof image === "string" && image.length > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Profile image is too large." }, { status: 400 });
  }

  const nextData: { name?: string; image?: string | null; bio?: string | null } = {};
  if (name) nextData.name = name;
  if (image !== undefined) nextData.image = image || null;
  if (bio !== undefined) nextData.bio = bio || null;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: nextData,
    select: { id: true, name: true, image: true, bio: true },
  });

  return NextResponse.json({ ok: true, user: updated });
}
