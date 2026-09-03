import React from "react";
import { motion } from "framer-motion";

/**
 * DetectionPipeline — 2D SVG illustrated flow diagram.
 * Shows: Transactions → Feature Engine → 3-Layer Detection → Verdict
 * Scroll-triggered with staggered node/connector reveals.
 */
export default function DetectionPipeline({ className = "" }) {
  const stages = [
    {
      id: "input",
      label: "Transaction\nStream",
      sublabel: "CSV · Simulation · Live",
      x: 60, y: 120,
      color: "#FDFBF7",
      shape: "rect",
      icon: "T",
    },
    {
      id: "features",
      label: "Feature\nEngine",
      sublabel: "velocity · ticket · repeat",
      x: 200, y: 120,
      color: "#0E76FF",
      shape: "rect",
      icon: "F",
    },
    {
      id: "zscore",
      label: "Z-Score\n+ CUSUM",
      sublabel: "Statistical drift",
      x: 360, y: 60,
      color: "#FFB300",
      shape: "hex",
      icon: "Z",
    },
    {
      id: "iforest",
      label: "Isolation\nForest",
      sublabel: "Shape anomalies",
      x: 360, y: 130,
      color: "#F44336",
      shape: "hex",
      icon: "IF",
    },
    {
      id: "rules",
      label: "Rule\nClassifier",
      sublabel: "Named patterns",
      x: 360, y: 200,
      color: "#64D2C9",
      shape: "hex",
      icon: "RC",
    },
    {
      id: "verdict",
      label: "Verdict\n+ Severity",
      sublabel: "0–1 score · label",
      x: 520, y: 130,
      color: "#00E676",
      shape: "rect",
      icon: "V",
    },
    {
      id: "explain",
      label: "LLM\nExplanation",
      sublabel: "Plain-English audit",
      x: 660, y: 130,
      color: "#C0FE04",
      shape: "rect",
      icon: "✦",
    },
  ];

  const connectors = [
    { from: "input", to: "features" },
    { from: "features", to: "zscore" },
    { from: "features", to: "iforest" },
    { from: "features", to: "rules" },
    { from: "zscore", to: "verdict" },
    { from: "iforest", to: "verdict" },
    { from: "rules", to: "verdict" },
    { from: "verdict", to: "explain" },
  ];

  const getPos = (id) => stages.find((s) => s.id === id);
  const W = 760, H = 280;
  const nodeW = 80, nodeH = 52;

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
  };
  const nodeVariants = {
    hidden: { opacity: 0, scale: 0.7 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  };
  const lineVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { pathLength: 1, opacity: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <motion.div
      className={`relative ${className}`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={containerVariants}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="auto"
        aria-label="Pulse detection pipeline diagram"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Glow filters */}
          {["cobalt", "caution", "critical", "safe", "lime", "seasonal", "ink"].map((name) => (
            <filter key={name} id={`glow-${name}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M 0 0 L 6 3 L 0 6 Z" fill="rgba(253,251,247,0.25)" />
          </marker>
          <marker id="arrow-cobalt" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M 0 0 L 6 3 L 0 6 Z" fill="rgba(14,118,255,0.6)" />
          </marker>
        </defs>

        {/* Connector lines */}
        {connectors.map((c, i) => {
          const from = getPos(c.from);
          const to = getPos(c.to);
          if (!from || !to) return null;
          const x1 = from.x + nodeW / 2;
          const y1 = from.y;
          const x2 = to.x - nodeW / 2;
          const y2 = to.y;
          const isToVerdict = c.to === "verdict";
          return (
            <motion.path
              key={i}
              d={`M ${x1} ${y1} C ${x1 + 30} ${y1}, ${x2 - 30} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={isToVerdict ? "rgba(0,230,118,0.3)" : "rgba(253,251,247,0.12)"}
              strokeWidth={isToVerdict ? "1.5" : "1"}
              strokeDasharray={isToVerdict ? "none" : "4 4"}
              markerEnd={isToVerdict ? "url(#arrow-cobalt)" : "url(#arrow)"}
              variants={lineVariants}
            />
          );
        })}

        {/* Nodes */}
        {stages.map((s, i) => {
          const x = s.x - nodeW / 2;
          const y = s.y - nodeH / 2;
          // eslint-disable-next-line no-unused-vars
          const _isHex = s.shape === "hex"; // reserved for shape variant rendering

          return (
            <motion.g key={s.id} variants={nodeVariants}>
              {/* Glow backdrop */}
              <rect
                x={x - 4} y={y - 4}
                width={nodeW + 8} height={nodeH + 8}
                rx="4"
                fill={s.color}
                opacity="0.06"
              />
              {/* Node background */}
              <rect
                x={x} y={y}
                width={nodeW} height={nodeH}
                rx="3"
                fill="#101319"
                stroke={s.color}
                strokeWidth={s.id === "explain" || s.id === "verdict" ? "1.5" : "1"}
                opacity={s.id === "explain" || s.id === "verdict" ? "1" : "0.7"}
              />
              {/* Icon label */}
              <text
                x={s.x}
                y={s.y - 8}
                textAnchor="middle"
                fill={s.color}
                fontSize="10"
                fontFamily="'Space Mono', monospace"
                fontWeight="700"
                letterSpacing="0.08em"
              >
                {s.icon}
              </text>
              {/* Main label */}
              {s.label.split("\n").map((line, li) => (
                <text
                  key={li}
                  x={s.x}
                  y={s.y + 4 + li * 12}
                  textAnchor="middle"
                  fill="rgba(253,251,247,0.85)"
                  fontSize="8.5"
                  fontFamily="'Archivo', sans-serif"
                  fontWeight="700"
                >
                  {line}
                </text>
              ))}
              {/* Sublabel */}
              <text
                x={s.x}
                y={s.y + nodeH / 2 + 12}
                textAnchor="middle"
                fill={s.color}
                fontSize="7"
                fontFamily="'Space Mono', monospace"
                opacity="0.65"
                letterSpacing="0.06em"
              >
                {s.sublabel}
              </text>

              {/* Active glow for verdict + explain */}
              {(s.id === "verdict" || s.id === "explain") && (
                <rect
                  x={x} y={y}
                  width={nodeW} height={nodeH}
                  rx="3"
                  fill="none"
                  stroke={s.color}
                  strokeWidth="1"
                  opacity="0.3"
                >
                  <animate
                    attributeName="opacity"
                    values="0.3;0.8;0.3"
                    dur={s.id === "explain" ? "2.5s" : "2s"}
                    repeatCount="indefinite"
                  />
                </rect>
              )}
            </motion.g>
          );
        })}

        {/* Layer bracket label */}
        <motion.g variants={nodeVariants}>
          <line
            x1={330} y1={30}
            x2={330} y2={240}
            stroke="rgba(253,251,247,0.08)"
            strokeWidth="1"
            strokeDasharray="2,6"
          />
          <line
            x1={490} y1={30}
            x2={490} y2={240}
            stroke="rgba(253,251,247,0.08)"
            strokeWidth="1"
            strokeDasharray="2,6"
          />
          <text
            x={410} y={22}
            textAnchor="middle"
            fill="rgba(253,251,247,0.35)"
            fontSize="7.5"
            fontFamily="'Space Mono', monospace"
            letterSpacing="0.12em"
          >
            3-LAYER DETECTION
          </text>
        </motion.g>
      </svg>
    </motion.div>
  );
}
