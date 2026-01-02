import type { ReactNode } from "react";

type InlineToken = "**" | "__" | "~~";

const SAFE_LINK_RE = /^(https?:\/\/|mailto:|\/|#)/i;

function sanitizeHref(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return SAFE_LINK_RE.test(trimmed) ? trimmed : null;
}

type InlineFormatOptions = {
  hideMarkers?: boolean;
};

export function renderInlineText(value: string, options: InlineFormatOptions = {}) {
  const nextKey = (() => {
    let index = 0;
    return () => `inline-${index++}`;
  })();

  const parse = (text: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let buffer = "";
    const { hideMarkers } = options;

    const flush = () => {
      if (buffer) {
        nodes.push(buffer);
        buffer = "";
      }
    };

    for (let i = 0; i < text.length; ) {
      const char = text[i];
      const two = text.slice(i, i + 2) as InlineToken;

      if (char === "\n") {
        flush();
        nodes.push(<br key={nextKey()} />);
        i += 1;
        continue;
      }

      if (two === "**" || two === "__" || two === "~~") {
        const end = text.indexOf(two, i + 2);
        if (end !== -1) {
          flush();
          const inner = parse(text.slice(i + 2, end));
          if (two === "**") {
            nodes.push(<strong key={nextKey()}>{inner}</strong>);
          } else if (two === "__") {
            nodes.push(<u key={nextKey()}>{inner}</u>);
          } else {
            nodes.push(<s key={nextKey()}>{inner}</s>);
          }
          i = end + 2;
          continue;
        }
        if (hideMarkers) {
          i += 2;
          continue;
        }
      }

      if (char === "*") {
        const end = text.indexOf("*", i + 1);
        if (end !== -1) {
          flush();
          const inner = parse(text.slice(i + 1, end));
          nodes.push(<em key={nextKey()}>{inner}</em>);
          i = end + 1;
          continue;
        }
        if (hideMarkers) {
          i += 1;
          continue;
        }
      }

      if (char === "`") {
        const end = text.indexOf("`", i + 1);
        if (end !== -1) {
          flush();
          nodes.push(<code key={nextKey()}>{text.slice(i + 1, end)}</code>);
          i = end + 1;
          continue;
        }
        if (hideMarkers) {
          i += 1;
          continue;
        }
      }

      if (char === "[") {
        const closeBracket = text.indexOf("]", i + 1);
        if (closeBracket !== -1 && text[closeBracket + 1] === "(") {
          const closeParen = text.indexOf(")", closeBracket + 2);
          if (closeParen !== -1) {
            const label = text.slice(i + 1, closeBracket);
            const href = text.slice(closeBracket + 2, closeParen);
            const safeHref = sanitizeHref(href);
            flush();
            if (safeHref) {
              const isExternal = safeHref.startsWith("http");
              nodes.push(
                <a
                  key={nextKey()}
                  href={safeHref}
                  className="inline-link"
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noreferrer" : undefined}
                >
                  {parse(label)}
                </a>
              );
            } else {
              if (!hideMarkers) {
                nodes.push(`[${label}](${href})`);
              }
            }
            i = closeParen + 1;
            continue;
          }
        }
      }

      buffer += char;
      i += 1;
    }

    flush();
    return nodes;
  };

  return parse(value);
}
