"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";

type MobileMenuProps = {
  summary: ReactNode;
  children: ReactNode;
  panelClassName?: string;
  panelStyle?: CSSProperties;
};

export function MobileMenu({ summary, children, panelClassName, panelStyle }: MobileMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const details = detailsRef.current;
      if (!details?.open) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (details.contains(target)) return;
      details.open = false;
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  const handlePanelClick = (event: React.MouseEvent) => {
    const details = detailsRef.current;
    if (!details?.open) return;
    const target = event.target as Element | null;
    if (!target) return;
    if (target.closest("a")) {
      details.open = false;
    }
  };

  return (
    <details ref={detailsRef} className="relative md:hidden">
      <summary className="list-none [&::-webkit-details-marker]:hidden">{summary}</summary>
      <div className={panelClassName} style={panelStyle} onClick={handlePanelClick}>
        {children}
      </div>
    </details>
  );
}
