import { NextRequest, NextResponse } from "next/server";
import { MediaType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "mov", "webm", "ogv", "ogg"]);
const VIDEO_MIME_MAP: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  ogg: "video/ogg",
};
const IMAGE_MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function resolveMimeType(fileName: string, mimeType: string) {
  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }
  const ext = getFileExtension(fileName);
  return VIDEO_MIME_MAP[ext] || IMAGE_MIME_MAP[ext] || mimeType || "application/octet-stream";
}

function resolveMediaMeta(file: File): { mimeType: string; type: MediaType } {
  const normalizedType = file.type && file.type !== "application/octet-stream" ? file.type : "";
  const ext = getFileExtension(file.name);
  const guessedMime = resolveMimeType(file.name, normalizedType);
  const isVideo = normalizedType
    ? normalizedType.startsWith("video")
    : VIDEO_EXTENSIONS.has(ext) || guessedMime.startsWith("video");
  return {
    mimeType: guessedMime || normalizedType || "application/octet-stream",
    type: isVideo ? MediaType.VIDEO : MediaType.PHOTO,
  };
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const postId = String(formData.get("postId") || "");
  const file = formData.get("file");
  const sortOrder = Number(formData.get("sortOrder") || 0);
  const altText = String(formData.get("altText") || "");

  if (!postId || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (user.role !== "ADMIN" && post.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mediaMeta = resolveMediaMeta(file);

  const media = await prisma.media.create({
    data: {
      postId,
      type: mediaMeta.type,
      data: buffer,
      fileName: file.name,
      mimeType: mediaMeta.mimeType,
      altText: altText || file.name,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
  });

  return NextResponse.json({
    id: media.id,
    fileName: media.fileName,
    mimeType: media.mimeType,
    type: media.type,
  });
}
