type ContentBlock = {
  id?: string;
  type?: string;
  galleryItems?: unknown[];
};

type MediaPreviewItem = {
  persistedId?: string;
};

export function getMediaSortOrders(contentRaw: string, mediaPreviewRaw: string) {
  if (!contentRaw || !mediaPreviewRaw) return [];

  let blocks: ContentBlock[] = [];
  let previewMap: Record<string, MediaPreviewItem[]> = {};

  try {
    const parsed = JSON.parse(contentRaw);
    if (Array.isArray(parsed)) {
      blocks = parsed;
    }
  } catch {
    return [];
  }

  try {
    const parsedPreview = JSON.parse(mediaPreviewRaw) as Record<string, MediaPreviewItem[]>;
    if (parsedPreview && typeof parsedPreview === "object") {
      previewMap = parsedPreview;
    }
  } catch {
    previewMap = {};
  }

  const updates: { id: string; sortOrder: number }[] = [];
  let order = 0;

  blocks.forEach((block) => {
    const type = block?.type;
    if (type === "media" || type === "background") {
      const items = block?.id ? previewMap[block.id] ?? [] : [];
      const previewItem = items[0];
      if (previewItem?.persistedId) {
        updates.push({ id: previewItem.persistedId, sortOrder: order });
      }
      order += 1;
      return;
    }

    if (type === "gallery") {
      const items = block?.id ? previewMap[block.id] ?? [] : [];
      const expected = Array.isArray(block?.galleryItems) ? block.galleryItems.length : 0;
      const count = Math.max(items.length, expected);
      for (let index = 0; index < count; index += 1) {
        const previewItem = items[index];
        if (previewItem?.persistedId) {
          updates.push({ id: previewItem.persistedId, sortOrder: order });
        }
        order += 1;
      }
    }
  });

  return updates;
}
