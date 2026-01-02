export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function stripInlineFormatting(value: string) {
  return value
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`(.*?)`/g, "$1");
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, " ");
}

function extractTextFromBlocks(content: string) {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return content;

    return parsed
      .map((block) => {
        if (block.type === "list" && Array.isArray(block.items)) {
          return block.items.map((item: string) => stripInlineFormatting(item || "")).join(" ");
        }
        if (block.type === "background") {
          return [block.overlayTitle, block.overlayText]
            .filter(Boolean)
            .map((item: string) => stripInlineFormatting(item || ""))
            .join(" ");
        }
        if (block.type === "heading") {
          return stripInlineFormatting(block.text || "");
        }
        return stripInlineFormatting(block.text || "");
      })
      .join(" ");
  } catch {
    return stripHtmlTags(content);
  }
}

export function extractPreviewText(content: string, maxLength = 160) {
  const flattened = extractTextFromBlocks(content).trim();
  if (flattened.length <= maxLength) {
    return flattened;
  }

  return `${flattened.slice(0, maxLength).trim()}...`;
}

export function estimateReadTimeMinutes(text: string) {
  const flattened = extractTextFromBlocks(text);
  const words = flattened.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
