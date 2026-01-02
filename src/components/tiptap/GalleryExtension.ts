import { Node } from "@tiptap/core";

type GalleryItem = {
  src: string;
  alt?: string;
  title?: string;
  caption?: string;
};

export const GalleryExtension = Node.create({
  name: "gallery",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      items: {
        default: [] as GalleryItem[],
      },
      columns: {
        default: 3,
      },
    };
  },

  parseHTML() {
    const getItems = (node: HTMLElement) => {
      const figures = Array.from(node.querySelectorAll("figure"));
      const items: GalleryItem[] = [];
      figures.forEach((figure) => {
        const img = figure.querySelector("img");
        if (!img || !img.getAttribute("src")) return;
        const caption = figure.querySelector("figcaption")?.textContent?.trim() ?? "";
        items.push({
          src: img.getAttribute("src") ?? "",
          alt: img.getAttribute("alt") ?? "",
          title: img.getAttribute("title") ?? "",
          caption,
        });
      });
      const columnsAttr = Number(node.dataset.columns || "");
      const columns = Number.isFinite(columnsAttr) && columnsAttr > 0 ? columnsAttr : 3;
      if (items.length) return { items, columns };
      return { items: [], columns };
    };

    return [
      {
        tag: "div.editor-gallery-grid",
        getAttrs: (node) =>
          node instanceof HTMLElement ? getItems(node) : false,
      },
      {
        tag: "div.tiptap-gallery",
        getAttrs: (node) =>
          node instanceof HTMLElement ? getItems(node) : false,
      },
    ];
  },

  renderHTML({ node }) {
    const items = (node.attrs.items ?? []) as GalleryItem[];
    const columns = Number(node.attrs.columns) || 3;
    const children = items.map((item) => {
      const figure: (string | Record<string, string> | unknown[])[] = [
        "figure",
        { class: "editor-gallery-card" },
        [
          "div",
          { class: "editor-gallery-frame" },
          [
            "img",
            {
              src: item.src,
              alt: item.alt ?? "",
              title: item.title ?? "",
            },
          ],
        ],
      ];

      if (item.caption) {
        figure.push(["figcaption", {}, item.caption]);
      }

      return figure;
    });

    return ["div", { class: "editor-gallery-grid", "data-columns": String(columns) }, ...children];
  },
});
