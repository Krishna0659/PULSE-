import React, { useEffect, useRef, useState } from "react";

/**
 * Cursor — Custom dot + ring cursor.
 * Uses direct DOM manipulation for performance (no React re-renders on mousemove).
 * Expands on hover over interactive elements.
 * Hidden on touch devices.
 */
export default function Cursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const pos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const rafId = useRef(null);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Don't show on touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const onMove = (e) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (!visible) setVisible(true);

      // Check if hovering over interactive element
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const isInteractive = el?.closest(
        "button, a, [role='button'], input, select, textarea, label, .cursor-expand"
      );
      setExpanded(!!isInteractive);
    };

    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);

    const LERP = 0.12;
    const animate = () => {
      // Dot follows exactly
      dot.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) translate(-50%, -50%)`;

      // Ring lags behind with lerp
      ringPos.current.x += (pos.current.x - ringPos.current.x) * LERP;
      ringPos.current.y += (pos.current.y - ringPos.current.y) * LERP;
      ring.style.transform = `translate(${ringPos.current.x}px, ${ringPos.current.y}px) translate(-50%, -50%)`;

      rafId.current = requestAnimationFrame(animate);
    };
    rafId.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      cancelAnimationFrame(rafId.current);
    };
  }, []); // eslint-disable-line

  // Don't render on touch
  if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
    return null;
  }

  return (
    <>
      <div
        ref={dotRef}
        className="cursor-dot"
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 200ms",
        }}
      />
      <div
        ref={ringRef}
        className={`cursor-ring ${expanded ? "expanded" : ""}`}
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 200ms, width 280ms cubic-bezier(0.16,1,0.3,1), height 280ms cubic-bezier(0.16,1,0.3,1), border-color 200ms, background-color 200ms",
        }}
      />
    </>
  );
}
