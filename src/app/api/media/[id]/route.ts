import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const media = await prisma.media.findUnique({ where: { id: params.id } });
  if (!media) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = Buffer.from(media.data);
  const size = body.length;
  const mimeType = resolveMimeType(media.fileName, media.mimeType);
  const range = _request.headers.get("range");

  if (range) {
    const match = /bytes=(\d*)-(\d*)/i.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : size - 1;
      if (start >= size || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${size}`,
          },
        });
      }
      const safeEnd = Math.min(end, size - 1);
      const chunk = body.subarray(start, safeEnd + 1);
      return new NextResponse(chunk as unknown as BodyInit, {
        status: 206,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": chunk.length.toString(),
          "Content-Range": `bytes ${start}-${safeEnd}/${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=604800, immutable",
        },
      });
    }
  }

  return new NextResponse(body as unknown as BodyInit, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": size.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const media = await prisma.media.findUnique({
    where: { id: params.id },
    select: { id: true, post: { select: { authorId: true } } },
  });
  if (!media) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.role !== "ADMIN" && media.post.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.media.delete({ where: { id: media.id } });
  return NextResponse.json({ ok: true });
}
