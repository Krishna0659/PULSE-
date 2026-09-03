import React, { useRef, useEffect, useState } from "react";

/**
 * CountUp — animates a number from 0 to its target value when scrolled into view.
 * Handles: plain integers, decimals, suffix strings (ms, days, %, x).
 *
 * Examples:
 *   <CountUp value={94.8} suffix="%" decimals={1} />
 *   <CountUp value={18} suffix=" ms" />
 *   <CountUp value={21} suffix=" days" />
 */
export default function CountUp({
  value,           // numeric target
  suffix = "",     // appended after number (e.g. "ms", "%", " days")
  prefix = "",     // prepended before number (e.g. "₹")
  decimals = 0,
  duration = 1600, // ms
  className = "",
}) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(`${prefix}${(0).toFixed(decimals)}${suffix}`);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const from = 0;

          const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out expo
            const eased = 1 - Math.pow(1 - progress, 4);
            const current = from + (value - from) * eased;
            setDisplay(`${prefix}${current.toFixed(decimals)}${suffix}`);
            if (progress < 1) requestAnimationFrame(tick);
          };

          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, suffix, prefix, decimals, duration]);

  return (
    <span ref={ref} className={className} aria-label={`${prefix}${value}${suffix}`}>
      {display}
    </span>
  );
}
