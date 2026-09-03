import React from "react";
import { motion, useScroll, useSpring } from "framer-motion";

/**
 * ScrollProgress — thin cobalt bar at top of viewport.
 * Driven by page scroll with spring smoothing.
 * Mounted once in App.js, sits above everything.
 */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[10002] h-[2px] origin-left"
      style={{
        scaleX,
        background: "linear-gradient(90deg, #0E76FF, #00E676, #C0FE04)",
      }}
    />
  );
}
