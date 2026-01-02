import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "div",
  "figure",
  "figcaption",
  "span",
  "iframe",
  "video",
  "source",
];

const ALLOWED_ATTRIBUTES = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "title", "width", "data-align"],
  div: ["class", "data-columns"],
  figure: ["class"],
  figcaption: ["class"],
  span: ["style"],
  code: ["class"],
  iframe: ["src", "allow", "allowfullscreen", "title", "frameborder"],
  video: ["controls", "poster"],
  source: ["src", "type"],
};

export function sanitizeRichText(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    allowedIframeHostnames: [
      "www.youtube.com",
      "youtube.com",
      "www.youtube-nocookie.com",
    ],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer", target: "_blank" }),
    },
  });
}
