"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type BlockType = "heading" | "paragraph" | "quote" | "list" | "media" | "gallery" | "background" | "divider";

type GalleryItem = {
  id: string;
  fileName: string;
  altText: string;
  caption: string;
  keywords?: string;
};

export type Block = {
  id: string;
  type: BlockType;
  text?: string;
  level?: "h1" | "h2" | "h3";
  items?: string[];
  altText?: string;
  caption?: string;
  mediaFileName?: string;
  galleryItems?: GalleryItem[];
  overlayTitle?: string;
  overlayText?: string;
  height?: number;
};

type BlockEditorProps = {
  name?: string;
  mediaAltName?: string;
  initialContent?: string | null;
  variant?: "default" | "advanced";
};

type FormatTargetField = "text" | "overlayTitle" | "overlayText" | "items";

type FormatTarget = {
  blockId: string;
  field: FormatTargetField;
  itemIndex?: number;
};

type FormatMenuState = {
  x: number;
  y: number;
  target: FormatTarget;
  selectionStart: number;
  selectionEnd: number;
};

type FormatSelection = {
  target: FormatTarget;
  selectionStart: number;
  selectionEnd: number;
};

function normalizeHeadingLevel(level?: Block["level"]): NonNullable<Block["level"]> {
  if (level === "h1" || level === "h3") return level;
  return "h2";
}

function parseInitialBlocks(content: string | null | undefined, defaultType: BlockType): Block[] {
  if (!content) {
    return [
      {
        id: "block-0",
        type: defaultType,
        text: "",
      },
    ];
  }

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      if (!parsed.length) {
        return [
          {
            id: "block-0",
            type: defaultType,
            text: "",
          },
        ];
      }
      return parsed.map((block, index) => ({
        id: block.id || `block-${index}`,
        type: block.type as BlockType,
        text: block.text ?? "",
        level: block.type === "heading" ? normalizeHeadingLevel(block.level) : undefined,
        items: Array.isArray(block.items) ? block.items : [],
        altText: block.altText ?? "",
        caption: block.caption ?? "",
        mediaFileName: block.mediaFileName ?? "",
        galleryItems: Array.isArray(block.galleryItems)
          ? block.galleryItems.map((item: GalleryItem, itemIndex: number) => ({
              id: item.id || `${block.id ?? `block-${index}`}-item-${itemIndex}`,
              fileName: item.fileName ?? "",
              altText: item.altText ?? "",
              caption: item.caption ?? "",
              keywords: item.keywords ?? "",
            }))
          : [],
        overlayTitle: block.overlayTitle ?? "",
        overlayText: block.overlayText ?? "",
        height: typeof block.height === "number" ? block.height : undefined,
      }));
    }
  } catch {
    // ignore and fallback to plain text
  }

  return [
    {
      id: "block-0",
      type: "paragraph",
      text: content,
    },
  ];
}

const HEADING_LEVELS: Block["level"][] = ["h1", "h2", "h3"];
const HEADING_TEXT_CLASSES: Record<NonNullable<Block["level"]>, string> = {
  h1: "text-[28px] leading-[1.2] font-semibold",
  h2: "text-[24px] leading-[1.3] font-semibold",
  h3: "text-[20px] leading-[1.35] font-semibold",
};

const COMMAND_MAP: Record<string, { type: BlockType; level?: Block["level"] }> = {
  h1: { type: "heading", level: "h1" },
  h2: { type: "heading", level: "h2" },
  h3: { type: "heading", level: "h3" },
  heading: { type: "heading", level: "h2" },
  paragraph: { type: "paragraph" },
  p: { type: "paragraph" },
  quote: { type: "quote" },
  list: { type: "list" },
  media: { type: "media" },
  gallery: { type: "gallery" },
  cover: { type: "background" },
  background: { type: "background" },
  divider: { type: "divider" },
};

const COMMAND_OPTIONS = [
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "paragraph", label: "Paragraph" },
  { value: "quote", label: "Quote" },
  { value: "list", label: "List" },
  { value: "media", label: "Media" },
  { value: "gallery", label: "Gallery" },
  { value: "cover", label: "Cover Photo" },
  { value: "divider", label: "Divider" },
];

const DEFAULT_MEDIA_HEIGHT = 420;
const MIN_MEDIA_HEIGHT = 220;
const MAX_MEDIA_HEIGHT = 820;

export function BlockEditor({
  name = "content",
  mediaAltName = "altText",
  initialContent,
  variant = "default",
}: BlockEditorProps) {
  const isAdvanced = variant === "advanced";
  const editorRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<Block[]>(() =>
    parseInitialBlocks(initialContent, "paragraph")
  );
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false);
  const [commandIndex, setCommandIndex] = useState(0);
  const [dropOverId, setDropOverId] = useState<string | null>(null);
  const [galleryModal, setGalleryModal] = useState<{ blockId: string; index: number } | null>(null);
  const [galleryDraft, setGalleryDraft] = useState({ altText: "", caption: "", keywords: "" });
  const [previews, setPreviews] = useState<Record<string, { url: string; isVideo: boolean }>>({});
  const [galleryPreviews, setGalleryPreviews] = useState<
    Record<string, { id: string; url: string; isVideo: boolean }[]>
  >({});
  const [formatMenu, setFormatMenu] = useState<FormatMenuState | null>(null);
  const [pendingSelection, setPendingSelection] = useState<FormatSelection | null>(null);
  const resizeState = useRef<{
    blockId: string;
    startY: number;
    startHeight: number;
  } | null>(null);
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);

  const serialized = useMemo(() => JSON.stringify(blocks), [blocks]);
  const commandMatches = useMemo(() => {
    const normalized = command.trim().toLowerCase();
    if (!normalized.startsWith("/")) return [];
    const query = normalized.replace("/", "");
    return COMMAND_OPTIONS.filter((option) => option.value.startsWith(query));
  }, [command]);
  const mediaAlt = useMemo(() => {
    const entries: string[] = [];
    blocks.forEach((block) => {
      if (block.type === "media" || block.type === "background") {
        entries.push((block.altText || "").trim());
      }
      if (block.type === "gallery") {
        (block.galleryItems ?? []).forEach((item) => entries.push((item.altText || "").trim()));
      }
    });
    return entries.join("\n");
  }, [blocks]);

  useEffect(() => {
    if (!galleryModal) return;
    const block = blocks.find((item) => item.id === galleryModal.blockId);
    const item = block?.galleryItems?.[galleryModal.index];
    setGalleryDraft({
      altText: item?.altText ?? "",
      caption: item?.caption ?? "",
      keywords: item?.keywords ?? "",
    });
  }, [galleryModal, blocks]);

  useEffect(() => {
    if (!isAdvanced) return;
    const container = editorRef.current;
    if (!container) return;
    container
      .querySelectorAll<HTMLTextAreaElement>('textarea[data-autoresize="true"]')
      .forEach((textarea) => {
        textarea.style.height = "0px";
        textarea.style.height = `${textarea.scrollHeight}px`;
      });
  }, [blocks, isAdvanced]);

  useEffect(() => {
    if (!formatMenu) return;
    const handleClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement | null)?.closest(".editor-format-menu")) {
        return;
      }
      setFormatMenu(null);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFormatMenu(null);
      }
    };
    const handleScroll = () => setFormatMenu(null);
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [formatMenu]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!resizeState.current) return;
      const { blockId, startY, startHeight } = resizeState.current;
      const nextHeight = Math.min(
        MAX_MEDIA_HEIGHT,
        Math.max(MIN_MEDIA_HEIGHT, Math.round(startHeight + event.clientY - startY))
      );
      updateBlock(blockId, { height: nextHeight });
    };

    const handleUp = () => {
      if (!resizeState.current) return;
      resizeState.current = null;
      setResizingBlockId(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  useEffect(() => {
    if (!pendingSelection) return;
    const { target, selectionStart, selectionEnd } = pendingSelection;
    const container = editorRef.current;
    if (!container) return;
    const selector =
      target.field === "items"
        ? `input[data-block-id="${target.blockId}"][data-field="items"][data-item-index="${target.itemIndex ?? 0}"]`
        : `[data-block-id="${target.blockId}"][data-field="${target.field}"]`;
    const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (element) {
      element.focus();
      element.setSelectionRange(selectionStart, selectionEnd);
    }
    setPendingSelection(null);
  }, [pendingSelection, blocks]);

  function handleTextareaInput(event: React.FormEvent<HTMLTextAreaElement>) {
    if (!isAdvanced) return;
    const textarea = event.currentTarget;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function openFormatMenu(
    event: React.MouseEvent<HTMLTextAreaElement | HTMLInputElement>,
    target: FormatTarget
  ) {
    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? 0;
    if (selectionEnd <= selectionStart) {
      return;
    }
    event.preventDefault();
    const padding = 12;
    const menuWidth = 200;
    const menuHeight = 220;
    const maxX = window.innerWidth - menuWidth - padding;
    const maxY = window.innerHeight - menuHeight - padding;
    const x = Math.min(Math.max(event.clientX, padding), Math.max(maxX, padding));
    const y = Math.min(Math.max(event.clientY, padding), Math.max(maxY, padding));
    setFormatMenu({ x, y, target, selectionStart, selectionEnd });
  }

  function getTargetValue(target: FormatTarget, source: Block[]) {
    const block = source.find((item) => item.id === target.blockId);
    if (!block) return "";
    if (target.field === "items") {
      return block.items?.[target.itemIndex ?? 0] ?? "";
    }
    return (block[target.field] as string | undefined) ?? "";
  }

  function applyFormat(prefix: string, suffix = prefix) {
    if (!formatMenu) return;
    const { target, selectionStart, selectionEnd } = formatMenu;
    const value = getTargetValue(target, blocks);
    const before = value.slice(0, selectionStart);
    const selected = value.slice(selectionStart, selectionEnd);
    const after = value.slice(selectionEnd);
    const nextValue = `${before}${prefix}${selected}${suffix}${after}`;

    if (target.field === "items") {
      setBlocks((current) =>
        current.map((block) => {
          if (block.id !== target.blockId) return block;
          const items = [...(block.items ?? [])];
          const index = target.itemIndex ?? 0;
          items[index] = nextValue;
          return { ...block, items };
        })
      );
    } else {
      updateBlock(target.blockId, { [target.field]: nextValue } as Partial<Block>);
    }

    setPendingSelection({
      target,
      selectionStart: selectionStart + prefix.length,
      selectionEnd: selectionEnd + prefix.length,
    });
    setFormatMenu(null);
  }

  function applyLinkFormat() {
    if (!formatMenu) return;
    const url = window.prompt("Enter link URL");
    if (!url) {
      setFormatMenu(null);
      return;
    }
    applyFormat("[", `](${url})`);
  }

  function startResize(event: React.PointerEvent<HTMLButtonElement>, block: Block) {
    event.preventDefault();
    event.stopPropagation();
    const startHeight = typeof block.height === "number" ? block.height : DEFAULT_MEDIA_HEIGHT;
    resizeState.current = {
      blockId: block.id,
      startY: event.clientY,
      startHeight,
    };
    setResizingBlockId(block.id);
    updateBlock(block.id, { height: startHeight });
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, ...patch } : block))
    );
  }

  function addBlock(type: BlockType, level?: Block["level"]) {
    const nextId = `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setBlocks((current) => [
      ...current,
      {
        id: nextId,
        type,
        text: "",
        level: type === "heading" ? level ?? "h2" : undefined,
        items: type === "list" ? [""] : undefined,
        altText: type === "media" || type === "background" ? "" : undefined,
        caption: type === "media" ? "" : undefined,
        mediaFileName: type === "media" || type === "background" ? "" : undefined,
        galleryItems: type === "gallery" ? [] : undefined,
        overlayTitle: type === "background" ? "" : undefined,
        overlayText: type === "background" ? "" : undefined,
      },
    ]);
  }

  function addBlockAfter(targetId: string, type: BlockType, level?: Block["level"]) {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === targetId);
      if (index === -1) return current;
      const nextId = `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const next = [...current];
      next.splice(index + 1, 0, {
        id: nextId,
        type,
        text: "",
        level: type === "heading" ? level ?? "h2" : undefined,
        items: type === "list" ? [""] : undefined,
        altText: type === "media" || type === "background" ? "" : undefined,
        caption: type === "media" ? "" : undefined,
        mediaFileName: type === "media" || type === "background" ? "" : undefined,
        galleryItems: type === "gallery" ? [] : undefined,
        overlayTitle: type === "background" ? "" : undefined,
        overlayText: type === "background" ? "" : undefined,
      });
      return next;
    });
  }

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  function moveBlock(id: string, direction: "up" | "down") {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      if (index === -1) return current;
      const next = [...current];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return current;
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  function moveBlockTo(fromId: string, toId: string) {
    setBlocks((current) => {
      const fromIndex = current.findIndex((block) => block.id === fromId);
      const toIndex = current.findIndex((block) => block.id === toId);
      if (fromIndex === -1 || toIndex === -1) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleCommandSubmit(nextCommand?: string | React.MouseEvent<HTMLButtonElement>) {
    const commandValue = typeof nextCommand === "string" ? nextCommand : command;
    const normalized = commandValue.trim().replace("/", "").toLowerCase();
    const next = COMMAND_MAP[normalized];
    if (next) {
      addBlock(next.type, next.level);
    }
    setCommand("");
    setCommandIndex(0);
  }

  function handleAdvancedInsert(type: BlockType, level?: Block["level"]) {
    if (activeBlockId) {
      addBlockAfter(activeBlockId, type, level);
    } else {
      addBlock(type, level);
    }
    setShowAdvancedMenu(false);
  }

  function handleGalleryFiles(blockId: string, fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(
      (file) => file.type.startsWith("image") || file.type.startsWith("video")
    );
    if (!files.length) return;

    const nextItems = files.map((file) => ({
      id: `${blockId}-${file.name}-${Math.random().toString(16).slice(2)}`,
      fileName: file.name,
      altText: "",
      caption: "",
      keywords: "",
    }));

    setBlocks((current) =>
      current.map((block) => {
        if (block.id !== blockId) return block;
        const existing = block.galleryItems ?? [];
        return { ...block, galleryItems: [...existing, ...nextItems] };
      })
    );

    setGalleryPreviews((current) => {
      const existing = current[blockId] ?? [];
      const nextPreviews = files.map((file, index) => ({
        id: nextItems[index]?.id ?? `${blockId}-${index}`,
        url: URL.createObjectURL(file),
        isVideo: file.type.startsWith("video"),
      }));
      return { ...current, [blockId]: [...existing, ...nextPreviews] };
    });
  }

  function convertBlock(id: string, type: BlockType, level?: Block["level"]) {
    setBlocks((current) =>
      current.map((block) => {
        if (block.id !== id) return block;
        const baseText = block.text ?? (block.items ? block.items.join("\n") : "");
        if (type === "heading") {
          return {
            ...block,
            type,
            text: baseText,
            items: undefined,
            level: level ?? normalizeHeadingLevel(block.level),
          };
        }
        if (type === "list") {
          return {
            ...block,
            type,
            items: block.items && block.items.length ? block.items : baseText ? baseText.split("\n") : [""],
            text: undefined,
            level: undefined,
          };
        }
        if (type === "paragraph" || type === "quote") {
          return {
            ...block,
            type,
            text: baseText,
            level: undefined,
            items: undefined,
          };
        }
        return {
          ...block,
          type,
          text: "",
          items: undefined,
          level: undefined,
        };
      })
    );
    setShowAdvancedMenu(false);
  }

  function saveGalleryDetails() {
    if (!galleryModal) return;
    setBlocks((current) =>
      current.map((block) => {
        if (block.id !== galleryModal.blockId) return block;
        const items = [...(block.galleryItems ?? [])];
        if (!items[galleryModal.index]) return block;
        items[galleryModal.index] = {
          ...items[galleryModal.index],
          altText: galleryDraft.altText,
          caption: galleryDraft.caption,
          keywords: galleryDraft.keywords,
        };
        return { ...block, galleryItems: items };
      })
    );
    setGalleryModal(null);
  }

  function handleContentRestore(event: React.FormEvent<HTMLInputElement>) {
    const nextValue = event.currentTarget.value;
    if (!nextValue || nextValue === serialized) return;
    setBlocks(parseInitialBlocks(nextValue, "paragraph"));
    setPreviews({});
    setGalleryPreviews({});
    setActiveBlockId(null);
  }

  const activeGalleryItem = useMemo(() => {
    if (!galleryModal) return null;
    const block = blocks.find((item) => item.id === galleryModal.blockId);
    return block?.galleryItems?.[galleryModal.index] ?? null;
  }, [blocks, galleryModal]);

  const activeGalleryPreview = useMemo(() => {
    if (!galleryModal) return null;
    return galleryPreviews[galleryModal.blockId]?.[galleryModal.index] ?? null;
  }, [galleryPreviews, galleryModal]);

  return (
    <div className="grid gap-4" ref={editorRef}>
      <input
        type="hidden"
        name={name}
        value={serialized}
        data-autosave="content"
        onInput={handleContentRestore}
      />
      <input type="hidden" name={mediaAltName} value={mediaAlt} />
      <div className="sr-only" aria-hidden="true">
        <input value={command} readOnly />
      </div>
      <div className={isAdvanced ? "relative pl-0 sm:pl-16" : ""}>
      {isAdvanced ? (
        <>
          <button
            type="button"
            onClick={() => setShowAdvancedMenu((value) => !value)}
            className={`advanced-plus absolute left-0 top-2 flex h-12 w-12 items-center justify-center rounded-full border text-2xl transition ${
              showAdvancedMenu ? "advanced-plus-open" : ""
            }`}
            style={{ 
              borderColor: 'var(--border-gray)', 
              backgroundColor: 'var(--bg-white)', 
              color: 'var(--text-secondary)' 
            }}
            aria-label="Add block"
            aria-expanded={showAdvancedMenu}
          >
            +
          </button>
          {showAdvancedMenu ? (
            <div 
              className="advanced-menu absolute left-0 top-14 z-10 w-[min(640px,calc(100vw-48px))] rounded-2xl border p-4 shadow-xl backdrop-blur"
              style={{ 
                borderColor: 'var(--border-gray)', 
                backgroundColor: 'var(--bg-white)',
                opacity: 0.95
              }}
            >
              <p className="advanced-menu-label">Add block</p>
              <div className="advanced-menu-row">
                <button type="button" onClick={() => handleAdvancedInsert("heading", "h1")} className="advanced-menu-item">
                  <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                    <text x="4" y="16" fontSize="12" fontFamily="system-ui" fill="currentColor">
                      H1
                    </text>
                  </svg>
                  H1
                </button>
                <button type="button" onClick={() => handleAdvancedInsert("heading", "h2")} className="advanced-menu-item">
                  <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                    <text x="4" y="16" fontSize="12" fontFamily="system-ui" fill="currentColor">
                      H2
                    </text>
                  </svg>
                  H2
                </button>
                <button type="button" onClick={() => handleAdvancedInsert("heading", "h3")} className="advanced-menu-item">
                  <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                    <text x="4" y="16" fontSize="12" fontFamily="system-ui" fill="currentColor">
                      H3
                    </text>
                  </svg>
                  H3
                </button>
                <button type="button" onClick={() => handleAdvancedInsert("paragraph")} className="advanced-menu-item">
                  <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                    <path d="M5 7h14M5 12h14M5 17h10" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                  Paragraph
                </button>
                <button type="button" onClick={() => handleAdvancedInsert("quote")} className="advanced-menu-item">
                  <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                    <path d="M7 8h4v6H6l1-6Zm9 0h4v6h-5l1-6Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                  Quote
                </button>
                <button type="button" onClick={() => handleAdvancedInsert("list")} className="advanced-menu-item">
                  <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                    <path d="M9 6h10M9 12h10M9 18h10" fill="none" stroke="currentColor" strokeWidth="1.7" />
                    <circle cx="5" cy="6" r="1.5" fill="currentColor" />
                    <circle cx="5" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="5" cy="18" r="1.5" fill="currentColor" />
                  </svg>
                  List
                </button>
                <button type="button" onClick={() => handleAdvancedInsert("media")} className="advanced-menu-item">
                  <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                    <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M9 10l2 2 4-4 5 6" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                  Media
                </button>
                <button type="button" onClick={() => handleAdvancedInsert("gallery")} className="advanced-menu-item">
                  <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                    <rect x="4" y="5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                    <rect x="13" y="5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                    <rect x="4" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                    <rect x="13" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                  Gallery
                </button>
                <button type="button" onClick={() => handleAdvancedInsert("background")} className="advanced-menu-item">
                  <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M6 16l3-3 3 3 4-5 3 5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                  Cover Photo
                </button>
                <button type="button" onClick={() => handleAdvancedInsert("divider")} className="advanced-menu-item">
                  <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                    <path d="M4 12h16" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                  Divider
                </button>
              </div>
              {activeBlockId ? (
                <>
                  <div className="advanced-menu-divider" />
                  <p className="advanced-menu-label">Current block</p>
                  <div className="advanced-menu-row">
                    <button type="button" onClick={() => convertBlock(activeBlockId, "paragraph")} className="advanced-menu-item">
                      <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                        <path d="M6 7h12M6 12h12M6 17h8" fill="none" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                      To paragraph
                    </button>
                    <button type="button" onClick={() => convertBlock(activeBlockId, "quote")} className="advanced-menu-item">
                      <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                        <path d="M7 8h4v6H6l1-6Zm9 0h4v6h-5l1-6Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                      To quote
                    </button>
                    <button type="button" onClick={() => convertBlock(activeBlockId, "list")} className="advanced-menu-item">
                      <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                        <path d="M10 7h10M10 12h10M10 17h10" fill="none" stroke="currentColor" strokeWidth="1.7" />
                        <circle cx="6" cy="7" r="1.5" fill="currentColor" />
                        <circle cx="6" cy="12" r="1.5" fill="currentColor" />
                        <circle cx="6" cy="17" r="1.5" fill="currentColor" />
                      </svg>
                      To list
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlock(activeBlockId)}
                      className="advanced-menu-item advanced-menu-danger"
                    >
                      <svg aria-hidden viewBox="0 0 24 24" className="advanced-menu-icon">
                        <path d="M6 7h12M9 7v10m6-10v10M8 7l1-2h6l1 2" fill="none" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                      Remove
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="editor-command">
          <div className="editor-command-hint">
            Start typing. Use /h1, /h2, /h3, /paragraph, /media, /gallery, /cover.
          </div>
          <div className="editor-command-row">
            <div className="relative flex-1">
              <input
                value={command}
                onChange={(event) => {
                  setCommand(event.target.value);
                  setCommandIndex(0);
                }}
                onKeyDown={(event) => {
                  const normalized = command.trim().toLowerCase();
                  const isSlash = normalized.startsWith("/");
                  const query = normalized.replace("/", "");
                  const matches = isSlash
                    ? COMMAND_OPTIONS.filter((option) => option.value.startsWith(query))
                    : [];

                  if (matches.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                    event.preventDefault();
                    const delta = event.key === "ArrowDown" ? 1 : -1;
                    setCommandIndex((value) => {
                      const nextIndex = (value + delta + matches.length) % matches.length;
                      return nextIndex;
                    });
                    return;
                  }

                  if (matches.length > 0 && (event.key === "Enter" || event.key === "Tab")) {
                    event.preventDefault();
                    const selected = matches[commandIndex] ?? matches[0];
                    if (selected) {
                      const nextCommand = `/${selected.value}`;
                      setCommand(nextCommand);
                      handleCommandSubmit(nextCommand);
                    }
                    return;
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCommandSubmit();
                  }
                }}
                placeholder="Type a command and press enter"
                className="editor-command-input"
              />
              {commandMatches.length > 0 ? (
                <div className="editor-command-suggestions">
                  {commandMatches.map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`editor-command-suggestion ${index === commandIndex ? "is-active" : ""}`}
                      onClick={() => {
                        const nextCommand = `/${option.value}`;
                        setCommand(nextCommand);
                        handleCommandSubmit(nextCommand);
                      }}
                    >
                      <span className="editor-command-label">/{option.value}</span>
                      <span className="editor-command-meta">{option.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={handleCommandSubmit} className="editor-command-button">
              Add
            </button>
          </div>
        </div>
      )}
      {blocks.map((block, index) => {
        const headingLevel = normalizeHeadingLevel(block.level);
        const headingClass = HEADING_TEXT_CLASSES[headingLevel];
        return (
        <div
          key={block.id}
          draggable={!isAdvanced && activeBlockId !== block.id}
          onFocusCapture={() => setActiveBlockId(block.id)}
          onBlurCapture={(event) => {
            const nextTarget = event.relatedTarget as Node | null;
            if (nextTarget && event.currentTarget.contains(nextTarget)) return;
            setActiveBlockId(null);
          }}
          onDragStart={(event) => {
            if (isAdvanced) return;
            const target = event.target as HTMLElement | null;
            const isInteractive = target?.closest("input, textarea, select, button, a");
            if (isInteractive || activeBlockId === block.id) {
              event.preventDefault();
              return;
            }
            event.dataTransfer.effectAllowed = "move";
            setDragId(block.id);
          }}
          onDragOver={(event) => {
            if (isAdvanced) return;
            event.preventDefault();
          }}
          onDragEnd={() => setDragId(null)}
          onDrop={() => {
            if (isAdvanced) return;
            if (dragId && dragId !== block.id) {
              moveBlockTo(dragId, block.id);
            }
            setDragId(null);
          }}
          className={`editor-block ${isAdvanced ? "editor-block-advanced" : ""} ${dragId === block.id ? "editor-block-drag" : ""}`}
        >
          {!isAdvanced ? (
            <div className="editor-block-header flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="editor-drag-handle" aria-hidden="true">
                  ⋮⋮
                </span>
                <select
                  value={block.type}
                  onChange={(event) => {
                    const nextType = event.target.value as BlockType;
                    if (nextType === "heading") {
                      const baseText = block.text ?? (block.items ? block.items.join("\n") : "");
                      updateBlock(block.id, {
                        type: nextType,
                        text: baseText,
                        items: undefined,
                        level: normalizeHeadingLevel(block.level),
                      });
                      return;
                    }
                    updateBlock(block.id, { type: nextType, level: undefined });
                  }}
                  className="editor-block-type"
                >
                  <option value="heading">Heading</option>
                  <option value="paragraph">Paragraph</option>
                  <option value="quote">Quote</option>
                  <option value="list">List</option>
                  <option value="media">Media</option>
                  <option value="gallery">Gallery</option>
                  <option value="background">Cover Photo</option>
                  <option value="divider">Divider</option>
                </select>
              </div>
              <div className="editor-block-actions flex gap-2 text-xs uppercase tracking-[0.2em]">
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "up")}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "down")}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}
          {!isAdvanced && activeBlockId === block.id ? (
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
              <button type="button" onClick={() => addBlockAfter(block.id, "heading", "h1")}>
                + H1
              </button>
              <button type="button" onClick={() => addBlockAfter(block.id, "heading", "h2")}>
                + H2
              </button>
              <button type="button" onClick={() => addBlockAfter(block.id, "heading", "h3")}>
                + H3
              </button>
              <button type="button" onClick={() => addBlockAfter(block.id, "paragraph")}>
                + Paragraph
              </button>
              <button type="button" onClick={() => addBlockAfter(block.id, "quote")}>
                + Quote
              </button>
              <button type="button" onClick={() => addBlockAfter(block.id, "list")}>
                + List
              </button>
              <button type="button" onClick={() => addBlockAfter(block.id, "media")}>
                + Media
              </button>
              <button type="button" onClick={() => addBlockAfter(block.id, "gallery")}>
                + Gallery
              </button>
              <button type="button" onClick={() => addBlockAfter(block.id, "background")}>
                + Cover Photo
              </button>
              <button type="button" onClick={() => addBlockAfter(block.id, "divider")}>
                + Divider
              </button>
            </div>
          ) : null}

          {block.type === "heading" ? (
            <div className={isAdvanced ? "mt-4" : "mt-4"}>
              <div
                className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em]"
                style={{ color: "var(--text-muted)" }}
              >
                <span>Heading level</span>
                <div className="flex gap-2">
                  {HEADING_LEVELS.map((level) => {
                    const isActive = headingLevel === level;
                    return (
                      <button
                        key={`${block.id}-${level}`}
                        type="button"
                        onClick={() => updateBlock(block.id, { level })}
                        className="rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition"
                        style={{
                          borderColor: isActive ? "var(--accent)" : "var(--border-gray)",
                          backgroundColor: isActive ? "var(--accent)" : "transparent",
                          color: isActive ? "var(--bg-white)" : "var(--text-secondary)",
                        }}
                      >
                        {level.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
              <input
                value={block.text ?? ""}
                onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                onContextMenu={(event) => openFormatMenu(event, { blockId: block.id, field: "text" })}
                placeholder={headingLevel === "h1" ? "Section headline" : headingLevel === "h2" ? "Section heading" : "Subheading"}
                className={
                  isAdvanced
                    ? `mt-2 w-full border-none bg-transparent px-0 py-0 focus:outline-none ${headingClass}`
                    : `mt-4 w-full border rounded-lg px-4 py-3 ${headingClass}`
                }
                style={{
                  color: "var(--text-primary)",
                  backgroundColor: isAdvanced ? "transparent" : "var(--bg-gray-50)",
                  borderColor: isAdvanced ? "transparent" : "var(--border-gray)",
                }}
                data-block-id={block.id}
                data-field="text"
                onFocus={() => setActiveBlockId(block.id)}
              />
            </div>
          ) : null}

          {block.type === "paragraph" ? (
            <textarea
              value={block.text ?? ""}
              onChange={(event) => updateBlock(block.id, { text: event.target.value })}
              onInput={handleTextareaInput}
              onContextMenu={(event) => openFormatMenu(event, { blockId: block.id, field: "text" })}
              placeholder={
                isAdvanced ? (index === 0 ? "Tell your story..." : "Continue writing...") : "Paragraph text"
              }
              data-autoresize={isAdvanced ? "true" : undefined}
              className={
                isAdvanced
                  ? "mt-2 w-full resize-none border-none bg-transparent px-0 py-0 text-[18px] leading-[30px] focus:outline-none"
                  : "mt-4 w-full border rounded-lg px-4 py-3 min-h-[140px]"
              }
              style={{ 
                color: 'var(--text-primary)',
                backgroundColor: isAdvanced ? 'transparent' : 'var(--bg-gray-50)',
                borderColor: isAdvanced ? 'transparent' : 'var(--border-gray)'
              }}
              data-block-id={block.id}
              data-field="text"
              onFocus={() => setActiveBlockId(block.id)}
            />
          ) : null}

          {block.type === "quote" ? (
            <textarea
              value={block.text ?? ""}
              onChange={(event) => updateBlock(block.id, { text: event.target.value })}
              onInput={handleTextareaInput}
              onContextMenu={(event) => openFormatMenu(event, { blockId: block.id, field: "text" })}
              placeholder="Quote text"
              data-autoresize={isAdvanced ? "true" : undefined}
              className={
                isAdvanced
                  ? "mt-3 w-full resize-none border-none bg-transparent px-0 py-0 text-[18px] italic leading-[30px] focus:outline-none"
                  : "mt-4 w-full border rounded-lg px-4 py-3 min-h-[120px]"
              }
              style={{ 
                color: 'var(--text-primary)',
                backgroundColor: isAdvanced ? 'transparent' : 'var(--bg-gray-50)',
                borderColor: isAdvanced ? 'transparent' : 'var(--border-gray)'
              }}
              data-block-id={block.id}
              data-field="text"
              onFocus={() => setActiveBlockId(block.id)}
            />
          ) : null}

          {block.type === "list" ? (
            <div className="mt-4 grid gap-2">
              {(block.items ?? [""]).map((item, idx) => (
                <input
                  key={`${block.id}-item-${idx}`}
                  value={item}
                  onChange={(event) => {
                    const items = [...(block.items ?? [])];
                    items[idx] = event.target.value;
                    updateBlock(block.id, { items });
                  }}
                  onContextMenu={(event) =>
                    openFormatMenu(event, { blockId: block.id, field: "items", itemIndex: idx })
                  }
                  placeholder={`List item ${idx + 1}`}
                  className={
                    isAdvanced
                      ? "border-none bg-transparent px-0 py-2 text-[18px] focus:outline-none"
                      : "border rounded-lg px-4 py-2"
                  }
                  style={{ 
                    color: 'var(--text-primary)',
                    backgroundColor: isAdvanced ? 'transparent' : 'var(--bg-gray-50)',
                    borderColor: isAdvanced ? 'transparent' : 'var(--border-gray)'
                  }}
                  data-block-id={block.id}
                  data-field="items"
                  data-item-index={idx}
                  onFocus={() => setActiveBlockId(block.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => updateBlock(block.id, { items: [...(block.items ?? []), ""] })}
                className="text-xs uppercase tracking-[0.2em]"
                style={{ color: 'var(--accent)' }}
              >
                Add item
              </button>
            </div>
          ) : null}

          {block.type === "media" ? (
            <div className="mt-4 grid gap-3">
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                Media order #{blocks.filter((item, idx) => ["media", "gallery", "background"].includes(item.type) && idx <= index).length}
              </p>
              <input
                type="file"
                name="mediaFiles"
                accept="image/*,video/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  updateBlock(block.id, { mediaFileName: file ? file.name : "" });
                  if (file) {
                    const nextUrl = URL.createObjectURL(file);
                    setPreviews((current) => ({
                      ...current,
                      [block.id]: { url: nextUrl, isVideo: file.type.startsWith("video") },
                    }));
                  }
                }}
                className="border rounded-lg px-4 py-2"
                style={{ 
                  borderColor: 'var(--border-gray)', 
                  backgroundColor: 'var(--bg-gray-50)',
                  color: 'var(--text-primary)'
                }}
                onFocus={() => setActiveBlockId(block.id)}
                data-block-id={block.id}
                data-block-type="media"
              />
              {block.mediaFileName ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Selected: {block.mediaFileName}</p>
              ) : null}
              {previews[block.id]?.url ? (
                <div className={`editor-media-resize-wrapper ${resizingBlockId === block.id ? "is-resizing" : ""}`}>
                  <div
                    className="editor-media-preview"
                    style={{ height: `${typeof block.height === "number" ? block.height : DEFAULT_MEDIA_HEIGHT}px` }}
                  >
                    {previews[block.id].isVideo ? (
                      <video controls className="editor-media-frame">
                        <source src={previews[block.id].url} />
                      </video>
                    ) : (
                      <img
                        src={previews[block.id].url}
                        alt=""
                        className="editor-media-frame"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    className="editor-media-resize-handle"
                    onPointerDown={(event) => startResize(event, block)}
                    aria-label="Drag to resize media height"
                  >
                    <span />
                    <span />
                    <span />
                  </button>
                  <p className="editor-media-resize-label">
                    Height {Math.round(typeof block.height === "number" ? block.height : DEFAULT_MEDIA_HEIGHT)}px
                  </p>
                </div>
              ) : null}
              <input
                value={block.altText ?? ""}
                onChange={(event) => updateBlock(block.id, { altText: event.target.value })}
                placeholder="Alt text for the media"
                className="border rounded-lg px-4 py-2"
                style={{ 
                  borderColor: 'var(--border-gray)', 
                  backgroundColor: 'var(--bg-gray-50)',
                  color: 'var(--text-primary)'
                }}
                onFocus={() => setActiveBlockId(block.id)}
              />
              {!block.altText ? (
                <p className="text-xs text-red-700">Alt text required for accessibility and SEO.</p>
              ) : null}
              <input
                value={block.caption ?? ""}
                onChange={(event) => updateBlock(block.id, { caption: event.target.value })}
                placeholder="Caption (optional)"
                className="border rounded-lg px-4 py-2"
                style={{ 
                  borderColor: 'var(--border-gray)', 
                  backgroundColor: 'var(--bg-gray-50)',
                  color: 'var(--text-primary)'
                }}
                onFocus={() => setActiveBlockId(block.id)}
              />
            </div>
          ) : null}

          {block.type === "gallery" ? (
            <div className="mt-4 grid gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Drop multiple images or videos to build a gallery.
              </p>
              <label
                className={`editor-dropzone ${dropOverId === block.id ? "is-active" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropOverId(block.id);
                }}
                onDragLeave={() => setDropOverId(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropOverId(null);
                  handleGalleryFiles(block.id, event.dataTransfer.files);
                }}
              >
                <input
                  type="file"
                  name="mediaFiles"
                  accept="image/*,video/*"
                  multiple
                  onChange={(event) => {
                    if (event.target.files) {
                      handleGalleryFiles(block.id, event.target.files);
                    }
                  }}
                  className="sr-only"
                  onFocus={() => setActiveBlockId(block.id)}
                  data-block-id={block.id}
                  data-block-type="gallery"
                />
                <div className="editor-dropzone-inner">
                  <span className="editor-dropzone-title">Drag and drop files</span>
                  <span className="editor-dropzone-subtitle">or click to upload multiple photos and videos</span>
                </div>
              </label>
              {galleryPreviews[block.id]?.length ? (
                <div className="editor-gallery-grid">
                  {galleryPreviews[block.id].map((preview, previewIndex) => {
                    const details = block.galleryItems?.[previewIndex];
                    const hasDetails = Boolean(details?.altText || details?.caption || details?.keywords);
                    return (
                      <button
                        key={preview.id}
                        type="button"
                        className="editor-gallery-card"
                        onClick={() => setGalleryModal({ blockId: block.id, index: previewIndex })}
                        aria-label={`Edit gallery item ${previewIndex + 1}`}
                        aria-haspopup="dialog"
                      >
                        {preview.isVideo ? <span className="editor-gallery-tag">Video</span> : null}
                        <div className="editor-gallery-frame">
                          {preview.isVideo ? (
                            <video controls className="editor-gallery-media">
                              <source src={preview.url} />
                            </video>
                          ) : (
                            <img src={preview.url} alt="" className="editor-gallery-media" />
                          )}
                        </div>
                        <div className="editor-gallery-overlay">
                          <span>{hasDetails ? "Edit details" : "Add details"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {block.galleryItems?.some((item) => !item.altText.trim()) ? (
                <p className="text-xs text-red-700">Alt text required for gallery images.</p>
              ) : null}
            </div>
          ) : null}

          {block.type === "background" ? (
            <div className="mt-4 grid gap-3">
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                Full-width cover photo with overlay copy.
              </p>
              <input
                type="file"
                name="mediaFiles"
                accept="image/*,video/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  updateBlock(block.id, { mediaFileName: file ? file.name : "" });
                  if (file) {
                    const nextUrl = URL.createObjectURL(file);
                    setPreviews((current) => ({
                      ...current,
                      [block.id]: { url: nextUrl, isVideo: file.type.startsWith("video") },
                    }));
                  }
                }}
                className="border rounded-lg px-4 py-2"
                style={{ 
                  borderColor: 'var(--border-gray)', 
                  backgroundColor: 'var(--bg-gray-50)',
                  color: 'var(--text-primary)'
                }}
                onFocus={() => setActiveBlockId(block.id)}
                data-block-id={block.id}
                data-block-type="background"
              />
              {previews[block.id]?.url ? (
                <div className={`editor-media-resize-wrapper ${resizingBlockId === block.id ? "is-resizing" : ""}`}>
                  <div
                    className="editor-media-preview"
                    style={{ height: `${typeof block.height === "number" ? block.height : DEFAULT_MEDIA_HEIGHT}px` }}
                  >
                    {previews[block.id].isVideo ? (
                      <video controls className="editor-media-frame">
                        <source src={previews[block.id].url} />
                      </video>
                    ) : (
                      <img
                        src={previews[block.id].url}
                        alt=""
                        className="editor-media-frame"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    className="editor-media-resize-handle"
                    onPointerDown={(event) => startResize(event, block)}
                    aria-label="Drag to resize cover height"
                  >
                    <span />
                    <span />
                    <span />
                  </button>
                  <p className="editor-media-resize-label">
                    Height {Math.round(typeof block.height === "number" ? block.height : DEFAULT_MEDIA_HEIGHT)}px
                  </p>
                </div>
              ) : null}
              <input
                value={block.altText ?? ""}
                onChange={(event) => updateBlock(block.id, { altText: event.target.value })}
                placeholder="Alt text for the cover photo"
                className="border rounded-lg px-4 py-2"
                style={{ 
                  borderColor: 'var(--border-gray)', 
                  backgroundColor: 'var(--bg-gray-50)',
                  color: 'var(--text-primary)'
                }}
                onFocus={() => setActiveBlockId(block.id)}
              />
              {!block.altText ? (
                <p className="text-xs text-red-700">Alt text required for accessibility and SEO.</p>
              ) : null}
              <input
                value={block.overlayTitle ?? ""}
                onChange={(event) => updateBlock(block.id, { overlayTitle: event.target.value })}
                onContextMenu={(event) => openFormatMenu(event, { blockId: block.id, field: "overlayTitle" })}
                placeholder="Overlay headline"
                className="border rounded-lg px-4 py-2"
                style={{ 
                  borderColor: 'var(--border-gray)', 
                  backgroundColor: 'var(--bg-gray-50)',
                  color: 'var(--text-primary)'
                }}
                data-block-id={block.id}
                data-field="overlayTitle"
                onFocus={() => setActiveBlockId(block.id)}
              />
              <textarea
                value={block.overlayText ?? ""}
                onChange={(event) => updateBlock(block.id, { overlayText: event.target.value })}
                onInput={handleTextareaInput}
                onContextMenu={(event) => openFormatMenu(event, { blockId: block.id, field: "overlayText" })}
                placeholder="Overlay description"
                data-autoresize={isAdvanced ? "true" : undefined}
                className="border rounded-lg px-4 py-3 min-h-[120px]"
                style={{ 
                  borderColor: 'var(--border-gray)', 
                  backgroundColor: 'var(--bg-gray-50)',
                  color: 'var(--text-primary)'
                }}
                data-block-id={block.id}
                data-field="overlayText"
                onFocus={() => setActiveBlockId(block.id)}
              />
            </div>
          ) : null}

          {block.type === "divider" ? (
            <div className="mt-6">
              <hr className="border" style={{ borderColor: 'var(--border-gray)' }} />
            </div>
          ) : null}
        </div>
        );
      })}
      </div>

      {galleryModal ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setGalleryModal(null)}
        >
          <div
            className="modal-panel modal-panel-light editor-gallery-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="editor-gallery-modal-header">
              <div>
                <p className="editor-gallery-modal-eyebrow">Gallery item</p>
                <h3 className="editor-gallery-modal-title">Add image details</h3>
              </div>
              <button
                type="button"
                className="editor-gallery-modal-close"
                onClick={() => setGalleryModal(null)}
                aria-label="Close"
              >
                x
              </button>
            </div>
            <div className="editor-gallery-modal-body">
              <div className="editor-gallery-modal-preview">
                {activeGalleryPreview ? (
                  activeGalleryPreview.isVideo ? (
                    <video controls className="editor-gallery-modal-media">
                      <source src={activeGalleryPreview.url} />
                    </video>
                  ) : (
                    <img src={activeGalleryPreview.url} alt="" className="editor-gallery-modal-media" />
                  )
                ) : (
                  <div className="editor-gallery-modal-fallback">
                    <p>Preview unavailable</p>
                    <span>{activeGalleryItem?.fileName ?? "Gallery item"}</span>
                  </div>
                )}
              </div>
              <div className="editor-gallery-modal-fields">
                <label className="editor-gallery-modal-label" htmlFor="gallery-alt">
                  Alt text
                </label>
                <input
                  id="gallery-alt"
                  value={galleryDraft.altText}
                  onChange={(event) => setGalleryDraft((current) => ({ ...current, altText: event.target.value }))}
                  placeholder="Describe the image for accessibility"
                  className="editor-gallery-modal-input"
                />
                {!galleryDraft.altText.trim() ? (
                  <p className="editor-gallery-modal-help">Alt text required for accessibility and SEO.</p>
                ) : null}
                <label className="editor-gallery-modal-label" htmlFor="gallery-caption">
                  Caption (optional)
                </label>
                <input
                  id="gallery-caption"
                  value={galleryDraft.caption}
                  onChange={(event) => setGalleryDraft((current) => ({ ...current, caption: event.target.value }))}
                  placeholder="Short caption"
                  className="editor-gallery-modal-input"
                />
                <label className="editor-gallery-modal-label" htmlFor="gallery-keywords">
                  Keywords
                </label>
                <input
                  id="gallery-keywords"
                  value={galleryDraft.keywords}
                  onChange={(event) => setGalleryDraft((current) => ({ ...current, keywords: event.target.value }))}
                  placeholder="Comma separated keywords"
                  className="editor-gallery-modal-input"
                />
                <p className="editor-gallery-modal-help">Keywords help search and recommendation.</p>
              </div>
            </div>
            <div className="editor-gallery-modal-actions">
              <button type="button" className="editor-gallery-modal-secondary" onClick={() => setGalleryModal(null)}>
                Cancel
              </button>
              <button type="button" className="editor-gallery-modal-primary" onClick={saveGalleryDetails}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isAdvanced ? (
        <div className="editor-add-row flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addBlock("heading", "h1")}
            className="border border-[color:var(--border)] px-3 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
          >
            Add H1
          </button>
          <button
            type="button"
            onClick={() => addBlock("heading", "h2")}
            className="border border-[color:var(--border)] px-3 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
          >
            Add H2
          </button>
          <button
            type="button"
            onClick={() => addBlock("heading", "h3")}
            className="border border-[color:var(--border)] px-3 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
          >
            Add H3
          </button>
          <button
            type="button"
            onClick={() => addBlock("paragraph")}
            className="border border-[color:var(--border)] px-3 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
          >
            Add Paragraph
          </button>
          <button
            type="button"
            onClick={() => addBlock("quote")}
            className="border border-[color:var(--border)] px-3 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
          >
            Add Quote
          </button>
          <button
            type="button"
            onClick={() => addBlock("list")}
            className="border border-[color:var(--border)] px-3 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
          >
            Add List
          </button>
          <button
            type="button"
            onClick={() => addBlock("media")}
            className="border border-[color:var(--border)] px-3 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
          >
            Add Media
          </button>
          <button
            type="button"
            onClick={() => addBlock("gallery")}
            className="border border-[color:var(--border)] px-3 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
          >
            Add Gallery
          </button>
          <button
            type="button"
            onClick={() => addBlock("background")}
            className="border border-[color:var(--border)] px-3 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
          >
            Add Cover Photo
          </button>
          <button
            type="button"
            onClick={() => addBlock("divider")}
            className="border border-[color:var(--border)] px-3 py-2 rounded-full text-xs uppercase tracking-[0.2em]"
          >
            Add Divider
          </button>
        </div>
      ) : null}

      {formatMenu ? (
        <div
          className="editor-format-menu"
          role="menu"
          aria-label="Text formatting"
          style={{ top: formatMenu.y, left: formatMenu.x }}
        >
          <button type="button" role="menuitem" className="editor-format-item" onClick={() => applyFormat("**")}>
            Bold
          </button>
          <button type="button" role="menuitem" className="editor-format-item" onClick={() => applyFormat("*")}>
            Italic
          </button>
          <button type="button" role="menuitem" className="editor-format-item" onClick={() => applyFormat("__")}>
            Underline
          </button>
          <button type="button" role="menuitem" className="editor-format-item" onClick={() => applyFormat("~~")}>
            Strike
          </button>
          <button type="button" role="menuitem" className="editor-format-item" onClick={() => applyFormat("`")}>
            Code
          </button>
          <button type="button" role="menuitem" className="editor-format-item" onClick={applyLinkFormat}>
            Link
          </button>
        </div>
      ) : null}
    </div>
  );
}
