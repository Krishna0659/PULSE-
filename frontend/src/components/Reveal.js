import React from "react";
import { motion } from "framer-motion";

/**
 * Reveal — Enhanced scroll-triggered reveal.
 * Supports: fade-up (default), blur, clipPath modes.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 28,
  blur = false,
  clip = false,
  className = "",
  once = true,
}) {
  const initial = {
    opacity: 0,
    y,
    ...(blur ? { filter: "blur(8px)" } : {}),
    ...(clip ? { clipPath: "inset(0 0 40px 0)" } : {}),
  };
  const animate = {
    opacity: 1,
    y: 0,
    ...(blur ? { filter: "blur(0px)" } : {}),
    ...(clip ? { clipPath: "inset(0 0 0px 0)" } : {}),
  };

  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={animate}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
