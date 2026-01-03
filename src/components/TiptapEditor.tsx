"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import { GalleryExtension } from "@/components/tiptap/GalleryExtension";
import { NodeSelection } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (family: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
  }
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width"),
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      align: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-align"),
        renderHTML: (attributes) => {
          if (!attributes.align) return {};
          return { "data-align": attributes.align };
        },
      },
    };
  },
});

const FontFamily = Mark.create({
  name: "fontFamily",
  addAttributes() {
    return {
      family: {
        default: null,
        parseHTML: (element) =>
          element.style.fontFamily ? element.style.fontFamily.replace(/['"]/g, "") : null,
        renderHTML: (attributes) => {
          if (!attributes.family) return {};
          return { style: `font-family: ${attributes.family}` };
        },
      },
    };
  },
  parseHTML() {
    return [{ style: "font-family" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setFontFamily:
        (family: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { family }),
      unsetFontFamily:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

type TiptapEditorProps = {
  name?: string;
  initialContent?: string | null;
  placeholder?: string;
};

type MediaType = "image" | "gallery" | "youtube";
type GalleryItem = {
  src: string;
  alt?: string;
  title?: string;
  caption?: string;
};

function getYoutubeId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "").trim() || null;
    }
    if (parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }
    const match = parsed.pathname.match(/\/embed\/(.*)$/);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    return null;
  }
  return null;
}

function reorderList<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function TiptapEditor({
  name = "content",
  initialContent = "",
  placeholder = "Tell your story...",
}: TiptapEditorProps) {
  const [html, setHtml] = useState(initialContent ?? "");
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [titleReady, setTitleReady] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [mediaError, setMediaError] = useState("");
  const [mediaUploading, setMediaUploading] = useState(false);
  const [galleryDeleteActive, setGalleryDeleteActive] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarHovered, setToolbarHovered] = useState(false);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({});
  const [seoTitle, setSeoTitle] = useState("");
  const [seoAlt, setSeoAlt] = useState("");
  const [seoCaption, setSeoCaption] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubePreview, setYoutubePreview] = useState<string | null>(null);
  const [galleryMenu, setGalleryMenu] = useState<{
    pos: number;
    x: number;
    y: number;
  } | null>(null);
  const [showGalleryResize, setShowGalleryResize] = useState(false);
  const [imageResizeActive, setImageResizeActive] = useState(false);
  const [imageResizeTarget, setImageResizeTarget] = useState<{
    pos: number;
    rect: DOMRect;
  } | null>(null);
  const activeImageRef = useRef<HTMLElement | null>(null);
  const activeImagePosRef = useRef<number | null>(null);
  const resizeDragRef = useRef<{
    pos: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [editingGallery, setEditingGallery] = useState<{
    pos: number;
    items: GalleryItem[];
  } | null>(null);
  const dragIndex = useRef<number | null>(null);
  const hasCreatedDraft = useRef(false);
  const mediaPreviewsRef = useRef<string[]>([]);
  const shellRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hasDefaultHeading = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: {},
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ResizableImage.configure({ inline: false, allowBase64: false }),
      FontFamily,
      Superscript,
      Subscript,
      GalleryExtension,
    ],
    content: html,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
      handleDOMEvents: {
        mousedown: (view, event) => {
          const target = event.target as HTMLElement | null;
          if (!target) return false;
          const galleryEl = target.closest(".editor-gallery-grid") as HTMLElement | null;
          if (!galleryEl) return false;
          const pos = view.posAtDOM(galleryEl, 0);
          const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos));
          view.dispatch(tr);
          const rect = galleryEl.getBoundingClientRect();
          const menuWidth = 220;
          const x = Math.min(rect.left, window.innerWidth - menuWidth - 12);
          const y = Math.max(12, rect.top - 48);
          setGalleryMenu({ pos, x, y });
          setShowGalleryResize(false);
          setImageResizeActive(false);
          return true;
        },
      },
    },
    onUpdate({ editor }) {
      setHtml(editor.getHTML());
    },
    onSelectionUpdate() {
      setSelectionVersion((value) => value + 1);
    },
  });

  const resolveTitleReady = () => {
    const input =
      (document.getElementById("editor-title") as HTMLInputElement | null) ??
      (document.querySelector('[data-autosave="title"]') as HTMLInputElement | null);
    if (!input) {
      setTitleReady(true);
      return true;
    }
    const ready = Boolean(input.value.trim());
    setTitleReady(ready);
    if (ready && !hasCreatedDraft.current) {
      void ensurePostId().then(() => {
        hasCreatedDraft.current = true;
      });
    }
    return ready;
  };

  useEffect(() => {
    const input = document.getElementById("editor-title") as HTMLInputElement | null;
    if (!input) return;
    resolveTitleReady();
    const update = () => resolveTitleReady();
    input.addEventListener("input", update);
    input.addEventListener("change", update);
    input.addEventListener("keyup", update);
    return () => {
      input.removeEventListener("input", update);
      input.removeEventListener("change", update);
      input.removeEventListener("keyup", update);
    };
  }, []);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(titleReady);
  }, [editor, titleReady]);

  useEffect(() => {
    if (!editor) return;
    const updatePosition = () => {
      if (!shellRef.current || !surfaceRef.current || !toolbarRef.current) return;
      const shellRect = shellRef.current.getBoundingClientRect();
      const surfaceRect = surfaceRef.current.getBoundingClientRect();
      const toolbarRect = toolbarRef.current.getBoundingClientRect();
      const header = document.querySelector("header");
      const headerHeight = header ? header.getBoundingClientRect().height : 0;
      const safeTop = headerHeight + 12;
      const top = surfaceRect.top - shellRect.top - toolbarRect.height - 20;
      const availableWidth = surfaceRect.width;
      const toolbarWidth = Math.min(toolbarRect.width, availableWidth);
      const leftBase = surfaceRect.left - shellRect.left;
      const centeredLeft =
        toolbarRect.width > availableWidth
          ? leftBase
          : leftBase + Math.max(0, (availableWidth - toolbarWidth) / 2);
      setToolbarStyle({
        top: Math.max(safeTop - shellRect.top, top),
        left: Math.max(0, centeredLeft),
        width: toolbarRect.width > availableWidth ? availableWidth : "fit-content",
        maxWidth: availableWidth,
      });
    };
    const handleFocus = () => {
      const ready = resolveTitleReady();
      setToolbarVisible(true);
      requestAnimationFrame(updatePosition);
      if (ready && editor && editor.isEmpty && !hasDefaultHeading.current) {
        editor.chain().focus().setParagraph().run();
        hasDefaultHeading.current = true;
      }
    };
    const handleBlur = () => {
      setTimeout(() => {
        if (toolbarHovered) return;
        setToolbarVisible(false);
      }, 0);
    };
    editor.on("focus", handleFocus);
    editor.on("blur", handleBlur);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      editor.off("focus", handleFocus);
      editor.off("blur", handleBlur);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [editor, toolbarHovered]);

  useEffect(() => {
    if (!editor) return;
    const updateGalleryMenu = () => {
      const selection = editor.state.selection;
      if (selection instanceof NodeSelection && selection.node.type.name === "gallery") {
        const nodePos = selection.from;
        const dom = editor.view.nodeDOM(nodePos) as HTMLElement | null;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        const menuWidth = 220;
        const x = Math.min(rect.left, window.innerWidth - menuWidth - 12);
        const y = Math.max(12, rect.top - 48);
        setGalleryMenu({ pos: nodePos, x, y });
        return;
      }
      setGalleryMenu(null);
      setShowGalleryResize(false);
    };
    editor.on("selectionUpdate", updateGalleryMenu);
    return () => {
      editor.off("selectionUpdate", updateGalleryMenu);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const handleResizeTarget = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const figure = target.closest(".tiptap-media") as HTMLElement | null;
      const image = target.closest(".tiptap-editor img:not(.editor-gallery-grid img)") as HTMLImageElement | null;
      const allImages = editor.view.dom.querySelectorAll<HTMLImageElement>(".tiptap-editor img.is-resize-active");
      allImages.forEach((node) => {
        if (node !== image) {
          node.classList.remove("is-resize-active");
        }
      });
      const resolvedImage = image ?? (figure ? (figure.querySelector("img") as HTMLImageElement | null) : null);
      if (resolvedImage) {
        activeImageRef.current = resolvedImage;
      } else if (figure) {
        activeImageRef.current = figure;
      }
      if (resolvedImage) {
        const pos = editor.view.posAtDOM(resolvedImage, 0);
        const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos));
        editor.view.dispatch(tr);
        const rect = resolvedImage.getBoundingClientRect();
        setImageResizeActive(true);
        setImageResizeTarget({ pos, rect });
        activeImagePosRef.current = pos;
        setGalleryMenu(null);
        return;
      }
      activeImageRef.current = null;
      activeImagePosRef.current = null;
      setImageResizeActive(false);
      setImageResizeTarget(null);
    };
    editor.view.dom.addEventListener("mousedown", handleResizeTarget);
    return () => {
      editor.view.dom.removeEventListener("mousedown", handleResizeTarget);
    };
  }, [editor]);

  useEffect(() => {
    if (!imageResizeTarget) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const handle = document.querySelector(".tiptap-image-resize-handle");
      if (handle && handle.contains(target)) return;
      const removeHandle = document.querySelector(".tiptap-image-remove-handle");
      if (removeHandle && removeHandle.contains(target)) return;
      if (activeImageRef.current && activeImageRef.current.contains(target)) return;
      setImageResizeTarget(null);
      setImageResizeActive(false);
    };
    const handleBlur = () => {
      setImageResizeTarget(null);
      setImageResizeActive(false);
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        handleBlur();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [imageResizeTarget]);

  useEffect(() => {
    if (!editor || !imageResizeTarget) return;
    const updateRect = () => {
      const dom = editor.view.nodeDOM(imageResizeTarget.pos) as HTMLElement | null;
      if (!dom) return;
      setImageResizeTarget({ pos: imageResizeTarget.pos, rect: dom.getBoundingClientRect() });
    };
    const handleMove = (event: MouseEvent) => {
      const drag = resizeDragRef.current;
      if (!drag) return;
      const delta = event.clientX - drag.startX;
      const nextWidth = Math.max(160, Math.round(drag.startWidth + delta));
      const node = editor.state.doc.nodeAt(drag.pos);
      if (!node) return;
      const tr = editor.state.tr.setNodeMarkup(drag.pos, undefined, {
        ...node.attrs,
        width: String(nextWidth),
      });
      editor.view.dispatch(tr);
      const dom = editor.view.nodeDOM(drag.pos) as HTMLElement | null;
      if (dom) {
        setImageResizeTarget({ pos: drag.pos, rect: dom.getBoundingClientRect() });
      }
    };
    const handleUp = () => {
      resizeDragRef.current = null;
      setImageResizeActive(true);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [editor, imageResizeTarget]);

  useEffect(() => {
    if (!editor) return;
    if (initialContent) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  useEffect(() => {
    mediaPreviewsRef.current = mediaPreviews;
  }, [mediaPreviews]);

  useEffect(() => {
    return () => {
      mediaPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!youtubeUrl) {
      setYoutubePreview(null);
      return;
    }
    const id = getYoutubeId(youtubeUrl);
    if (!id) {
      setYoutubePreview(null);
      return;
    }
    setYoutubePreview(`https://img.youtube.com/vi/${id}/hqdefault.jpg`);
  }, [youtubeUrl]);

  const activeStates = useMemo(
    () => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      underline: editor?.isActive("underline") ?? false,
      strike: editor?.isActive("strike") ?? false,
      link: editor?.isActive("link") ?? false,
      code: editor?.isActive("code") ?? false,
      codeBlock: editor?.isActive("codeBlock") ?? false,
      superscript: editor?.isActive("superscript") ?? false,
      subscript: editor?.isActive("subscript") ?? false,
      h1: editor?.isActive("heading", { level: 1 }) ?? false,
      h2: editor?.isActive("heading", { level: 2 }) ?? false,
      h3: editor?.isActive("heading", { level: 3 }) ?? false,
      h4: editor?.isActive("heading", { level: 4 }) ?? false,
      h5: editor?.isActive("heading", { level: 5 }) ?? false,
      h6: editor?.isActive("heading", { level: 6 }) ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false,
      blockquote: editor?.isActive("blockquote") ?? false,
      alignLeft: editor?.isActive({ textAlign: "left" }) ?? false,
      alignCenter: editor?.isActive({ textAlign: "center" }) ?? false,
      alignRight: editor?.isActive({ textAlign: "right" }) ?? false,
      alignJustify: editor?.isActive({ textAlign: "justify" }) ?? false,
    }),
    [editor, html, selectionVersion]
  );

  const headingValue = activeStates.h1
    ? "h1"
    : activeStates.h2
      ? "h2"
      : activeStates.h3
        ? "h3"
        : activeStates.h4
          ? "h4"
          : activeStates.h5
            ? "h5"
            : activeStates.h6
              ? "h6"
              : "text";
  const toolbarDisabled = !titleReady || !editor;
  const fontValue = editor?.getAttributes("fontFamily")?.family ?? "var(--font-body)";

  const applyAlignment = (value: "left" | "center" | "right" | "justify") => {
    if (!editor) return;
    const selection = editor.state.selection;
    if (selection instanceof NodeSelection && selection.node.type.name === "image") {
      const node = selection.node;
      const nextAlign = value === "justify" ? "justify" : value;
      const tr = editor.state.tr.setNodeMarkup(selection.from, undefined, {
        ...node.attrs,
        align: nextAlign,
      });
      editor.view.dispatch(tr);
      return;
    }
    if (activeImagePosRef.current != null) {
      const node = editor.state.doc.nodeAt(activeImagePosRef.current);
      if (node?.type.name === "image") {
        const nextAlign = value === "justify" ? "justify" : value;
        const tr = editor.state.tr.setNodeMarkup(activeImagePosRef.current, undefined, {
          ...node.attrs,
          align: nextAlign,
        });
        editor.view.dispatch(tr);
        return;
      }
    }
    editor.chain().focus().setTextAlign(value).run();
  };

  const handleToolMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter link URL", previousUrl || "");
    if (url === null) return;
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  function resetMediaState() {
    setMediaFiles([]);
    setMediaPreviews((current) => {
      current.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setMediaError("");
    setSeoTitle("");
    setSeoAlt("");
    setSeoCaption("");
    setSeoKeywords("");
    setYoutubeUrl("");
    setYoutubePreview(null);
    setEditingGallery(null);
    setGalleryMenu(null);
    setImageResizeActive(false);
    setImageResizeTarget(null);
  }

  const closeMedia = () => {
    setMediaOpen(false);
    resetMediaState();
  };

  async function ensurePostId() {
    const form = document.getElementById("editor-form") as HTMLFormElement | null;
    const postInput = form?.querySelector<HTMLInputElement>('input[name="postId"]');
    const postId = postInput?.value?.trim() ?? "";
    const values: Record<string, string> = {};
    if (form) {
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-autosave]").forEach((el) => {
        const key = el.getAttribute("data-autosave");
        if (key) {
          values[key] = el.value;
        }
      });
    }
    values.content = html;
    if (postId) {
      values.postId = postId;
    }
    try {
      const response = await fetch("/api/editor/autosave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        if (postId) {
          return postId;
        }
        return "";
      }
      const data = (await response.json()) as { postId?: string };
      if (data.postId && postInput) {
        postInput.value = data.postId;
      }
      return data.postId ?? postId;
    } catch {
      return postId ?? "";
    }
  }

  async function saveDraft(postId: string) {
    const form = document.getElementById("editor-form") as HTMLFormElement | null;
    const values: Record<string, string> = { postId, content: editor?.getHTML() ?? html };
    if (form) {
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-autosave]").forEach((el) => {
        const key = el.getAttribute("data-autosave");
        if (key) {
          values[key] = el.value;
        }
      });
    }
    await fetch("/api/editor/autosave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
  }

  const handleMediaFiles = (files: File[]) => {
    if (mediaType === "youtube") {
      setMediaError("Paste a YouTube link.");
      return;
    }
    if (mediaType === "gallery" && editingGallery) {
      setMediaError("Use Edit gallery to rearrange or remove images.");
      return;
    }
    if (!files.length) return;
    const filtered = files.filter((file) => file.type.startsWith("image"));
    if (mediaType === "gallery") {
      if (filtered.length !== files.length) {
        setMediaError("Gallery supports images only.");
        return;
      }
      setMediaFiles((current) => [...current, ...filtered]);
      setMediaPreviews((current) => [
        ...current,
        ...filtered.map((file) => URL.createObjectURL(file)),
      ]);
      setMediaError("");
      return;
    }

    const file = filtered[0];
    if (!file) {
      setMediaError("Select an image file.");
      return;
    }
    setMediaFiles([file]);
    setMediaPreviews((current) => {
      current.forEach((url) => URL.revokeObjectURL(url));
      return [URL.createObjectURL(file)];
    });
    setMediaError("");
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    handleMediaFiles(files);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (mediaType === "youtube") {
      const text = event.dataTransfer.getData("text/plain").trim();
      if (text) {
        setYoutubeUrl(text);
      }
      return;
    }
    if (mediaType === "gallery" && editingGallery) {
      setMediaError("Use Edit gallery to rearrange or remove images.");
      return;
    }
    const files = Array.from(event.dataTransfer.files ?? []);
    handleMediaFiles(files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
  };

  const handleReorder = (from: number, to: number) => {
    if (from === to) return;
    if (editingGallery) {
      setEditingGallery((current) => {
        if (!current) return current;
        return { ...current, items: reorderList(current.items, from, to) };
      });
      setMediaPreviews((current) => reorderList(current, from, to));
      return;
    }
    setMediaFiles((current) => reorderList(current, from, to));
    setMediaPreviews((current) => reorderList(current, from, to));
  };

  const removeGalleryItem = (index: number) => {
    if (editingGallery) {
      setEditingGallery((current) => {
        if (!current) return current;
        return { ...current, items: current.items.filter((_, idx) => idx !== index) };
      });
    } else {
      setMediaFiles((current) => current.filter((_, idx) => idx !== index));
    }
    setMediaPreviews((current) => {
      const next = current.filter((_, idx) => idx !== index);
      const removed = current[index];
      if (removed && removed.startsWith("blob:")) {
        URL.revokeObjectURL(removed);
      }
      return next;
    });
  };

  const uploadMedia = async () => {
    if (!editor) return;
    if (!titleReady) {
      setMediaError("Add a title before uploading media.");
      return;
    }
    if (!seoTitle.trim()) {
      setMediaError("SEO title is required.");
      return;
    }
    if (mediaType !== "youtube" && mediaFiles.length === 0 && !editingGallery) {
      setMediaError("Select a file to upload.");
      return;
    }
    if (mediaType === "gallery" && mediaFiles.length < 1 && !editingGallery) {
      setMediaError("Select at least 1 image.");
      return;
    }

    setMediaUploading(true);
    setMediaError("");
    try {
      const postId = await ensurePostId();
      if (!postId) {
        throw new Error("Missing post id");
      }
      const altText = seoAlt.trim() || seoTitle.trim();
      const caption = seoCaption.trim();
      if (mediaType === "gallery" && editingGallery && mediaFiles.length === 0) {
        const nextItems = editingGallery.items.map((item) => ({
          ...item,
          alt: altText || item.alt || "",
          title: seoTitle.trim() || item.title || "",
          caption: caption || item.caption || "",
        }));
        const node = editor.state.doc.nodeAt(editingGallery.pos);
        if (node) {
          const tr = editor.state.tr.setNodeMarkup(editingGallery.pos, undefined, {
            ...node.attrs,
            items: nextItems,
          });
          editor.view.dispatch(tr);
          await saveDraft(postId);
          closeMedia();
          return;
        }
      }
      if (mediaType === "youtube") {
        const id = getYoutubeId(youtubeUrl.trim());
        if (!id) {
          throw new Error("Enter a valid YouTube link");
        }
        const embedHtml = `
          <div class="tiptap-embed">
            <iframe
              src="https://www.youtube.com/embed/${id}"
              title="${seoTitle.trim()}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
        `;
        editor.chain().focus().insertContent(embedHtml).run();
        await saveDraft(postId);
        closeMedia();
        return;
      }

      const uploads = [] as { id: string; fileName: string; mimeType: string; type: string }[];
      for (let i = 0; i < mediaFiles.length; i += 1) {
        const file = mediaFiles[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("postId", postId);
        formData.append("altText", altText);
        formData.append("sortOrder", String(i));
        const response = await fetch("/api/media", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          throw new Error("Upload failed");
        }
        const data = (await response.json()) as { id: string; fileName: string; mimeType: string; type: string };
        uploads.push(data);
      }

      if (mediaType === "image") {
        const media = uploads[0];
        const figure = `
          <figure class="tiptap-media">
            <img src="/api/media/${media.id}" alt="${altText}" title="${seoTitle.trim()}" />
            ${caption ? `<figcaption>${caption}</figcaption>` : ""}
          </figure>
        `;
        editor.chain().focus().insertContent(figure).run();
      }

      if (mediaType === "gallery") {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "gallery",
            attrs: {
              items: uploads.map((item) => ({
                src: `/api/media/${item.id}`,
                alt: altText,
                title: seoTitle.trim(),
                caption,
              })),
            },
          })
          .run();
      }

      await saveDraft(postId);
      closeMedia();
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setMediaUploading(false);
    }
  };

  return (
    <div className="tiptap-shell" ref={shellRef}>
      <input type="hidden" name={name} value={html} data-autosave="content" />
      <div
        className={`tiptap-toolbar ${toolbarVisible ? "is-visible" : "is-hidden"}`}
        ref={toolbarRef}
        style={toolbarStyle}
        onMouseEnter={() => setToolbarHovered(true)}
        onMouseLeave={() => setToolbarHovered(false)}
        onMouseDown={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("select")) return;
          event.preventDefault();
        }}
      >
        <button
          type="button"
          className="tiptap-tool"
          onClick={() => editor?.chain().focus().undo().run()}
          onMouseDown={handleToolMouseDown}
          aria-label="Undo"
          disabled={toolbarDisabled || !editor?.can().undo()}
        >
          ↺
        </button>
        <button
          type="button"
          className="tiptap-tool"
          onClick={() => editor?.chain().focus().redo().run()}
          onMouseDown={handleToolMouseDown}
          aria-label="Redo"
          disabled={toolbarDisabled || !editor?.can().redo()}
        >
          ↻
        </button>
        <span className="tiptap-divider" aria-hidden />
        <label className="tiptap-toolbar-select" aria-label="Font family">
          <span className="sr-only">Font family</span>
          <select
            value={fontValue}
            onChange={(event) => {
              if (!editor) return;
              const value = event.target.value;
              editor.chain().focus().setFontFamily(value).run();
            }}
            disabled={toolbarDisabled}
          >
            <option value="var(--font-body)">Inter</option>
            <option value="var(--font-display)">Playfair Display</option>
            <option value="var(--font-mono)">Mono</option>
          </select>
        </label>
        <label className="tiptap-toolbar-select" aria-label="Heading level">
          <span className="sr-only">Heading level</span>
          <select
            value={headingValue}
            onChange={(event) => {
              const value = event.target.value;
              if (!editor) return;
              if (value === "text") {
                editor.chain().focus().setParagraph().run();
              } else if (value === "h1") {
                editor.chain().focus().setHeading({ level: 1 }).run();
              } else if (value === "h2") {
                editor.chain().focus().setHeading({ level: 2 }).run();
              } else if (value === "h3") {
                editor.chain().focus().setHeading({ level: 3 }).run();
              } else if (value === "h4") {
                editor.chain().focus().setHeading({ level: 4 }).run();
              } else if (value === "h5") {
                editor.chain().focus().setHeading({ level: 5 }).run();
              } else if (value === "h6") {
                editor.chain().focus().setHeading({ level: 6 }).run();
              }
            }}
            disabled={toolbarDisabled}
          >
            <option value="text">Text</option>
            <option value="h1">H1</option>
            <option value="h2">H2</option>
            <option value="h3">H3</option>
            <option value="h4">H4</option>
            <option value="h5">H5</option>
            <option value="h6">H6</option>
          </select>
        </label>
        <button
          type="button"
          className={`tiptap-tool ${activeStates.bulletList ? "is-active" : ""}`}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          onMouseDown={handleToolMouseDown}
          aria-label="Bullet list"
          disabled={toolbarDisabled}
        >
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="4" cy="5" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="10" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="15" r="1.5" fill="currentColor" stroke="none" />
            <path d="M8 5h8" />
            <path d="M8 10h8" />
            <path d="M8 15h8" />
          </svg>
        </button>
        <button
          type="button"
          className={`tiptap-tool ${activeStates.orderedList ? "is-active" : ""}`}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          onMouseDown={handleToolMouseDown}
          aria-label="Ordered list"
          disabled={toolbarDisabled}
        >
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M3 6h2" />
            <path d="M4 4v4" />
            <path d="M3 11h2" />
            <path d="M3 14h2l-2 2h2" />
            <path d="M8 5h8" />
            <path d="M8 10h8" />
            <path d="M8 15h8" />
          </svg>
        </button>
        <button
          type="button"
          className={`tiptap-tool ${activeStates.blockquote ? "is-active" : ""}`}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          onMouseDown={handleToolMouseDown}
          aria-label="Blockquote"
          disabled={toolbarDisabled}
        >
          "
        </button>
        <span className="tiptap-divider" aria-hidden />
        <button
          type="button"
          className={`tiptap-tool ${activeStates.bold ? "is-active" : ""}`}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          onMouseDown={handleToolMouseDown}
          aria-label="Bold"
          disabled={toolbarDisabled}
        >
          B
        </button>
        <button
          type="button"
          className={`tiptap-tool ${activeStates.italic ? "is-active" : ""}`}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          onMouseDown={handleToolMouseDown}
          aria-label="Italic"
          disabled={toolbarDisabled}
        >
          i
        </button>
        <button
          type="button"
          className={`tiptap-tool ${activeStates.strike ? "is-active" : ""}`}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          onMouseDown={handleToolMouseDown}
          aria-label="Strike"
          disabled={toolbarDisabled}
        >
          S
        </button>
        <button
          type="button"
          className={`tiptap-tool ${activeStates.underline ? "is-active" : ""}`}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          onMouseDown={handleToolMouseDown}
          aria-label="Underline"
          disabled={toolbarDisabled}
        >
          U
        </button>
        <button
          type="button"
          className={`tiptap-tool ${activeStates.link ? "is-active" : ""}`}
          onClick={setLink}
          onMouseDown={handleToolMouseDown}
          aria-label="Link"
          disabled={toolbarDisabled}
        >
          🔗
        </button>
        <button
          type="button"
          className={`tiptap-tool ${activeStates.superscript ? "is-active" : ""}`}
          onClick={() => editor?.chain().focus().toggleSuperscript().run()}
          onMouseDown={handleToolMouseDown}
          aria-label="Superscript"
          disabled={toolbarDisabled}
        >
          x²
        </button>
        <button
          type="button"
          className={`tiptap-tool ${activeStates.subscript ? "is-active" : ""}`}
          onClick={() => editor?.chain().focus().toggleSubscript().run()}
          onMouseDown={handleToolMouseDown}
          aria-label="Subscript"
          disabled={toolbarDisabled}
        >
          x₂
        </button>
        <span className="tiptap-row-break" aria-hidden />
        <span className="tiptap-divider" aria-hidden />
        <div className="tiptap-align-row" role="group" aria-label="Alignment">
          <button
            type="button"
            className={`tiptap-tool ${activeStates.alignLeft ? "is-active" : ""}`}
            onClick={() => applyAlignment("left")}
            onMouseDown={handleToolMouseDown}
            aria-label="Align left"
            disabled={toolbarDisabled}
          >
            ☰
          </button>
          <button
            type="button"
            className={`tiptap-tool ${activeStates.alignCenter ? "is-active" : ""}`}
            onClick={() => applyAlignment("center")}
            onMouseDown={handleToolMouseDown}
            aria-label="Align center"
            disabled={toolbarDisabled}
          >
            ≡
          </button>
          <button
            type="button"
            className={`tiptap-tool ${activeStates.alignRight ? "is-active" : ""}`}
            onClick={() => applyAlignment("right")}
            onMouseDown={handleToolMouseDown}
            aria-label="Align right"
            disabled={toolbarDisabled}
          >
            ☷
          </button>
          <button
            type="button"
            className={`tiptap-tool ${activeStates.alignJustify ? "is-active" : ""}`}
            onClick={() => applyAlignment("justify")}
            onMouseDown={handleToolMouseDown}
            aria-label="Justify"
            disabled={toolbarDisabled}
          >
            ▤
          </button>
        </div>
        <span className="tiptap-divider" aria-hidden />
        <label className="tiptap-toolbar-select tiptap-toolbar-media" aria-label="Media type">
          <span className="sr-only">Media type</span>
          <select
            value={mediaType}
            onChange={(event) => {
              setMediaType(event.target.value as MediaType);
              resetMediaState();
            }}
            disabled={toolbarDisabled}
          >
            <option value="image">Image</option>
            <option value="gallery">Gallery</option>
            <option value="youtube">YouTube</option>
          </select>
        </label>
        <button
          type="button"
          className="tiptap-tool tiptap-add-media"
          onClick={() => {
            if (!resolveTitleReady()) return;
            setMediaOpen(true);
          }}
          onMouseDown={handleToolMouseDown}
          aria-label="Add media"
          disabled={toolbarDisabled}
        >
          Add Media
        </button>
      </div>
      <div className={`tiptap-surface ${titleReady ? "" : "is-locked"}`} ref={surfaceRef}>
        <EditorContent editor={editor} />
        {!titleReady ? (
          <p className="tiptap-placeholder">Add a title to start writing.</p>
        ) : editor?.isEmpty ? (
          <p className="tiptap-placeholder">{placeholder}</p>
        ) : null}
      </div>
      {imageResizeTarget ? (
        <div
          className="tiptap-image-resize-handle"
          style={{
            left: imageResizeTarget.rect.right - 8,
            top: imageResizeTarget.rect.bottom - 8,
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!editor || !imageResizeTarget) return;
            const dom = editor.view.nodeDOM(imageResizeTarget.pos) as HTMLElement | null;
            if (!dom) return;
            resizeDragRef.current = {
              pos: imageResizeTarget.pos,
              startX: event.clientX,
              startWidth: dom.getBoundingClientRect().width,
            };
          }}
        />
      ) : null}
      {imageResizeTarget ? (
        <button
          type="button"
          className="tiptap-image-remove-handle"
          style={{
            left: imageResizeTarget.rect.right - 92,
            top: imageResizeTarget.rect.top - 18,
          }}
          onClick={() => {
            if (!editor) return;
            const confirmed = window.confirm(
              "I assure you, on remove, it will be removed from the database, and it will upload all the records in the database. Continue?"
            );
            if (!confirmed) return;
            editor.chain().focus().deleteSelection().run();
            setImageResizeActive(false);
            setImageResizeTarget(null);
          }}
        >
          Remove
        </button>
      ) : null}
      {galleryMenu ? (
        <div
          className="tiptap-gallery-menu"
          style={{ top: galleryMenu.y, left: galleryMenu.x }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="tiptap-gallery-action"
            onClick={() => setShowGalleryResize((value) => !value)}
          >
            Resize
          </button>
          <button
            type="button"
            className="tiptap-gallery-action"
            onClick={() => {
              if (!editor) return;
              const node = editor.state.doc.nodeAt(galleryMenu.pos);
              if (!node) return;
              const items = (node.attrs.items ?? []) as GalleryItem[];
              setGalleryMenu(null);
              setEditingGallery({ pos: galleryMenu.pos, items });
              setMediaType("gallery");
              setMediaOpen(true);
              setMediaPreviews(items.map((item) => item.src));
              setMediaFiles([]);
              setSeoTitle(items[0]?.title ?? "");
              setSeoAlt(items[0]?.alt ?? "");
              setSeoCaption(items[0]?.caption ?? "");
              setSeoKeywords("");
              setMediaError("");
              setShowGalleryResize(false);
            }}
          >
            Edit gallery
          </button>
          {showGalleryResize ? (
            <div className="tiptap-gallery-resize">
              {[2, 3, 4].map((columns) => (
                <button
                  key={columns}
                  type="button"
                  onClick={() => {
                    if (!editor) return;
                    const node = editor.state.doc.nodeAt(galleryMenu.pos);
                    if (!node) return;
                    const tr = editor.state.tr.setNodeMarkup(galleryMenu.pos, undefined, {
                      ...node.attrs,
                      columns,
                    });
                    editor.view.dispatch(tr);
                    setShowGalleryResize(false);
                  }}
                >
                  {columns} cols
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {mediaOpen ? (
        <div className="tiptap-modal">
          <div className="tiptap-modal-backdrop" onClick={closeMedia} />
          <div className="tiptap-modal-panel tiptap-media-modal" role="dialog" aria-modal="true">
            <div className="tiptap-modal-header">
              <h3>Add media</h3>
              <button type="button" onClick={closeMedia} className="tiptap-modal-close" aria-label="Close">
                ×
              </button>
            </div>
            <div className="tiptap-media-toolbar">
              <select
                className="tiptap-select"
                value={mediaType}
                onChange={(event) => {
                  setMediaType(event.target.value as MediaType);
                  resetMediaState();
                }}
                disabled={Boolean(editingGallery)}
              >
                <option value="image">Image</option>
                <option value="gallery">Gallery</option>
                <option value="youtube">YouTube Embed</option>
              </select>
            </div>
            <div className="tiptap-media-body">
              <label className="tiptap-media-drop" onDrop={handleDrop} onDragOver={handleDragOver}>
                <div className="tiptap-drop-icon">⬒</div>
                <p className="tiptap-drop-title">
                  {mediaType === "youtube"
                    ? "Paste a YouTube link"
                    : `Drop ${mediaType === "gallery" ? "images" : "an image"} here`}
                </p>
                <span className="tiptap-drop-subtitle">
                  {mediaType === "youtube" ? "or press ⌘/Ctrl + V" : "or click to browse"}
                </span>
                {mediaType !== "youtube" ? (
                  <input
                    type="file"
                    accept="image/*"
                    multiple={mediaType === "gallery"}
                    onChange={handleFileInput}
                    disabled={mediaType === "gallery" && Boolean(editingGallery)}
                  />
                ) : null}
                {mediaType === "youtube" ? (
                  <input
                    type="text"
                    placeholder="Paste YouTube URL"
                    value={youtubeUrl}
                    onChange={(event) => setYoutubeUrl(event.target.value)}
                    onPaste={(event) => {
                      const text = event.clipboardData.getData("text");
                      if (text) {
                        setYoutubeUrl(text.trim());
                      }
                    }}
                  />
                ) : null}
              </label>
              <div className={`tiptap-media-preview ${mediaType === "gallery" ? "is-gallery" : ""}`}>
                {mediaType === "youtube" ? (
                  youtubePreview ? (
                    <div className="tiptap-media-youtube">
                      <img src={youtubePreview} alt="YouTube preview" />
                      <p>Embed preview</p>
                    </div>
                  ) : (
                    <p className="tiptap-media-empty">Paste a YouTube link to preview.</p>
                  )
                ) : mediaPreviews.length ? (
                  <div className={`tiptap-media-grid ${mediaType === "gallery" ? "is-gallery" : ""}`}>
                    {mediaType === "gallery" ? (
                      <div
                        className={`tiptap-delete-zone ${galleryDeleteActive ? "is-active" : ""}`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (dragIndex.current === null) return;
                          const confirmed = window.confirm("Remove this image from the gallery?");
                          if (confirmed) {
                            removeGalleryItem(dragIndex.current);
                          }
                          dragIndex.current = null;
                          setGalleryDeleteActive(false);
                        }}
                      >
                        Drag here to delete
                      </div>
                    ) : null}
                    {mediaPreviews.map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        className="tiptap-media-thumb"
                        draggable={mediaType === "gallery"}
                        onDragStart={() => {
                          dragIndex.current = index;
                          setGalleryDeleteActive(true);
                        }}
                        onDragOver={handleDragOver}
                        onDrop={() => {
                          if (dragIndex.current === null) return;
                          handleReorder(dragIndex.current, index);
                          dragIndex.current = null;
                          setGalleryDeleteActive(false);
                        }}
                        onDragEnd={() => setGalleryDeleteActive(false)}
                      >
                        <img src={url} alt="" />
                        {mediaType === "gallery" ? <span className="tiptap-drag-hint">Drag</span> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="tiptap-media-empty">No files selected yet.</p>
                )}
              </div>
              <div className="tiptap-media-seo">
                <p className="tiptap-media-title">SEO details</p>
                <label>
                  Title (required)
                  <input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
                </label>
                <label>
                  Alt text
                  <input
                    value={seoAlt}
                    onChange={(event) => setSeoAlt(event.target.value)}
                    disabled={!seoTitle.trim()}
                  />
                </label>
                <label>
                  Caption
                  <textarea
                    value={seoCaption}
                    onChange={(event) => setSeoCaption(event.target.value)}
                    disabled={!seoTitle.trim()}
                  />
                </label>
                <label>
                  Keywords
                  <input
                    value={seoKeywords}
                    onChange={(event) => setSeoKeywords(event.target.value)}
                    disabled={!seoTitle.trim()}
                  />
                </label>
                <p className="tiptap-media-note">These details apply to all items in the gallery.</p>
              </div>
            </div>
            {mediaError ? <p className="tiptap-gallery-error">{mediaError}</p> : null}
            <div className="tiptap-modal-actions">
              <button type="button" onClick={closeMedia} className="tiptap-modal-secondary">
                Cancel
              </button>
              <button type="button" onClick={uploadMedia} className="tiptap-modal-primary" disabled={mediaUploading}>
                {mediaUploading
                  ? "Saving..."
                  : mediaType === "youtube" || editingGallery
                    ? "Save"
                    : "Upload"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
