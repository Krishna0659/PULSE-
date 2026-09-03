import React from "react";
import { motion } from "framer-motion";

/**
 * CharReveal — Animates text character-by-character or word-by-word.
 * mode: "chars" | "words" | "lines"
 * Respects prefers-reduced-motion.
 */
export default function CharReveal({
  text,
  as: Tag = "span",
  delay = 0,
  duration = 0.6,
  stagger = 0.025,
  y = 40,
  mode = "words",
  className = "",
  once = true,
}) {
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    return <Tag className={className}>{text}</Tag>;
  }

  const units = mode === "chars"
    ? text.split("")
    : mode === "words"
    ? text.split(" ")
    : text.split("\n");

  const container = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  const child = {
    hidden: { opacity: 0, y, clipPath: "inset(0 0 100% 0)" },
    visible: {
      opacity: 1,
      y: 0,
      clipPath: "inset(0 0 0% 0)",
      transition: { duration, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <motion.span
      className={`inline-block ${className}`}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-40px" }}
      aria-label={text}
    >
      {units.map((unit, i) => (
        <React.Fragment key={i}>
          <span className="inline-block overflow-hidden">
            <motion.span
              className="inline-block"
              variants={child}
            >
              {unit}
            </motion.span>
          </span>
          {mode === "words" && i < units.length - 1 ? " " : ""}
        </React.Fragment>
      ))}
    </motion.span>
  );
}
