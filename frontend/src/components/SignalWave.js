import React, { useEffect, useRef } from "react";

/**
 * SignalWave — 2D SVG animated signal waveform.
 * Renders a financial-style candlestick/waveform with:
 *   - Animated line drawing via CSS stroke-dashoffset
 *   - Classification event markers (vertical lines + colored dots)
 *   - Shaded anomaly zones
 * Integrates with the editorial grid as a decorative-functional element.
 */
export default function SignalWave({ className = "", width = 600, height = 160 }) {
  const pathRef = useRef(null);
  const areaRef = useRef(null);

  // Generate realistic-looking financial signal data
  const points = (() => {
    const pts = [];
    let y = height * 0.55;
    const n = 80;
    for (let i = 0; i < n; i++) {
      const noise = (Math.random() - 0.5) * 14;
      // Add structured patterns
      let drift = 0;
      if (i < 20) drift = -0.2; // slight decline
      if (i >= 20 && i < 28) drift = -2.5; // distress event
      if (i >= 28 && i < 40) drift = 0.8; // recovery
      if (i >= 40 && i < 50) drift = 3.5; // breakout
      if (i >= 50 && i < 58) drift = 1.5; // continued growth
      if (i >= 58 && i < 70) drift = -1.0; // seasonal dip
      if (i >= 70) drift = 0.3; // stabilize
      y = Math.max(height * 0.15, Math.min(height * 0.85, y + drift + noise * 0.4));
      pts.push({ x: (i / (n - 1)) * width, y });
    }
    return pts;
  })();

  // Smooth the path using cubic bezier
  const pathD = points.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cpx1 = prev.x + (p.x - prev.x) * 0.5;
    const cpx2 = p.x - (p.x - prev.x) * 0.5;
    return `${d} C ${cpx1} ${prev.y}, ${cpx2} ${p.y}, ${p.x} ${p.y}`;
  }, "");

  const areaD = pathD + ` L ${width} ${height} L 0 ${height} Z`;

  // Event markers
  const events = [
    { x: points[24]?.x, color: "#FFB300", label: "DISTRESS", y: points[24]?.y },
    { x: points[45]?.x, color: "#00E676", label: "BREAKOUT", y: points[45]?.y },
    { x: points[63]?.x, color: "#0E76FF", label: "SEASONAL", y: points[63]?.y },
  ];

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          path.style.transition = `stroke-dashoffset 2.4s cubic-bezier(0.16, 1, 0.3, 1) 0.2s`;
          path.style.strokeDashoffset = "0";
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(path);
    return () => obs.disconnect();
  }, []);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="waveArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0E76FF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0E76FF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="waveStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0E76FF" stopOpacity="0.4" />
          <stop offset="40%" stopColor="#0E76FF" stopOpacity="0.9" />
          <stop offset="65%" stopColor="#00E676" stopOpacity="0.8" />
          <stop offset="85%" stopColor="#0E76FF" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#0E76FF" stopOpacity="0.3" />
        </linearGradient>
        {/* Distress zone gradient */}
        <linearGradient id="distressZone" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFB300" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFB300" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFB300" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="breakoutZone" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00E676" stopOpacity="0" />
          <stop offset="50%" stopColor="#00E676" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#00E676" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Distress zone shading */}
      <rect
        x={(points[20]?.x ?? 0)}
        y={0}
        width={(points[30]?.x ?? 0) - (points[20]?.x ?? 0)}
        height={height}
        fill="url(#distressZone)"
      />

      {/* Breakout zone shading */}
      <rect
        x={(points[40]?.x ?? 0)}
        y={0}
        width={(points[55]?.x ?? 0) - (points[40]?.x ?? 0)}
        height={height}
        fill="url(#breakoutZone)"
      />

      {/* Area fill */}
      <path ref={areaRef} d={areaD} fill="url(#waveArea)" />

      {/* Main signal line */}
      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke="url(#waveStroke)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Baseline */}
      <line
        x1="0" y1={height * 0.65}
        x2={width} y2={height * 0.65}
        stroke="rgba(253,251,247,0.08)"
        strokeWidth="1"
        strokeDasharray="4,8"
      />

      {/* Event markers */}
      {events.map((ev) => ev.x != null && (
        <g key={ev.label}>
          {/* Vertical line */}
          <line
            x1={ev.x} y1={ev.y}
            x2={ev.x} y2={height}
            stroke={ev.color}
            strokeWidth="1"
            strokeDasharray="3,4"
            opacity="0.5"
          />
          {/* Dot on the signal */}
          <circle
            cx={ev.x} cy={ev.y} r="4"
            fill={ev.color}
            opacity="0.9"
          />
          <circle
            cx={ev.x} cy={ev.y} r="8"
            fill={ev.color}
            opacity="0.15"
          />
          {/* Label */}
          <text
            x={ev.x}
            y={height - 4}
            textAnchor="middle"
            fill={ev.color}
            fontSize="8"
            fontFamily="'Space Mono', monospace"
            fontWeight="700"
            letterSpacing="0.08em"
            opacity="0.7"
          >
            {ev.label}
          </text>
        </g>
      ))}

      {/* Live pulse at end */}
      {points.length > 0 && (
        <g>
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="3"
            fill="#00E676"
          >
            <animate
              attributeName="opacity"
              values="1;0.3;1"
              dur="1.8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="8"
            fill="none"
            stroke="#00E676"
            strokeWidth="1"
            opacity="0.4"
          >
            <animate
              attributeName="r"
              values="4;14;4"
              dur="1.8s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.5;0;0.5"
              dur="1.8s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      )}
    </svg>
  );
}
