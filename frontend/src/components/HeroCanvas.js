import React, { useEffect, useRef } from "react";

/**
 * HeroCanvas — Ambient reactive particle field.
 * Pure canvas, no external dependencies.
 * Mouse-reactive depth parallax. Graceful fallback if canvas unsupported.
 */
export default function HeroCanvas({ className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");

    let W = canvas.offsetWidth;
    let H = canvas.offsetHeight;
    canvas.width = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    let mouse = { x: W / 2, y: H / 2 };
    let animId;

    const N = Math.min(120, Math.floor((W * H) / 14000));
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: Math.random(), // 0=far, 1=near
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.12,
      baseR: Math.random() * 1.8 + 0.4,
      hue: [210, 150, 60, 0][Math.floor(Math.random() * 4)], // cobalt/safe/caution/critical
      opacity: Math.random() * 0.5 + 0.15,
      pulse: Math.random() * Math.PI * 2,
    }));

    const COLORS = {
      210: "rgba(14,118,255,",   // cobalt
      150: "rgba(0,230,118,",    // safe
      60: "rgba(255,179,0,",     // caution
      0: "rgba(253,251,247,",    // ink
    };

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const onResize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * window.devicePixelRatio;
      canvas.height = H * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);

    const draw = (t) => {
      ctx.clearRect(0, 0, W, H);

      // Sort by z for proper depth (far to near)
      particles.sort((a, b) => a.z - b.z);

      for (const p of particles) {
        p.pulse += 0.008;

        // Mouse attraction (subtle)
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const attract = 0.00008 * p.z;
        if (dist < 320) {
          p.vx += dx * attract;
          p.vy += dy * attract;
        }

        p.vx *= 0.98;
        p.vy *= 0.98;
        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;

        const r = p.baseR * (0.5 + p.z * 0.8) * (1 + Math.sin(p.pulse) * 0.15);
        const alpha = p.opacity * (0.4 + p.z * 0.6);
        const color = COLORS[p.hue] || COLORS[0];

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color + alpha + ")";
        ctx.fill();
      }

      // Draw connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const maxD = 100 + (a.z + b.z) * 40;
          if (d < maxD) {
            const alpha = (1 - d / maxD) * 0.08 * ((a.z + b.z) / 2);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(253,251,247,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ display: "block" }}
      aria-hidden="true"
    />
  );
}
