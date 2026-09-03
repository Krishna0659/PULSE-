import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/**
 * ParallaxLayer — wraps children and applies vertical parallax.
 * speed: 0 = no movement, 0.3 = 30% offset relative to scroll, negative = moves opposite direction.
 * Scoped to the nearest scroll container (pass containerRef for section-local parallax).
 */
export default function ParallaxLayer({
  children,
  speed = 0.15,
  className = "",
  containerRef = null,
}) {
  const ref = useRef(null);

  const { scrollYProgress } = useScroll(
    containerRef
      ? { target: containerRef, offset: ["start end", "end start"] }
      : { target: ref, offset: ["start end", "end start"] }
  );

  // Convert scroll 0→1 into a Y offset
  // speed=0.15 → element moves 15% of section height upward as you scroll through
  const y = useTransform(scrollYProgress, [0, 1], [`${speed * 60}px`, `${-speed * 60}px`]);

  return (
    <div ref={ref} className={className || "relative"}>
      <motion.div style={{ y }} className="will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}
