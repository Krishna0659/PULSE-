import React, { useEffect, useRef } from "react";

/**
 * AuthVisual — Animated canvas for the auth left rail.
 * Renders a flowing neural/data network:
 *   - Floating nodes connected by glowing edges
 *   - Nodes pulse with classification colors
 *   - Depth layering for 3D feel
 *   - Slow drift animation
 */
export default function AuthVisual({ className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    const DPR = window.devicePixelRatio || 1;
    let W = canvas.offsetWidth;
    let H = canvas.offsetHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.scale(DPR, DPR);

    const COLORS = ["#0E76FF", "#00E676", "#FFB300", "#F44336", "#64D2C9", "#FDFBF7"];
    const N = 22;

    const nodes = Array.from({ length: N }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 2 + Math.random() * 4,
      color: COLORS[i % COLORS.length],
      pulse: Math.random() * Math.PI * 2,
      depth: 0.3 + Math.random() * 0.7,
    }));

    let animId;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Slight vignette
      const vgn = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
      vgn.addColorStop(0, "rgba(0,0,0,0)");
      vgn.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = vgn;
      ctx.fillRect(0, 0, W, H);

      for (const n of nodes) {
        n.pulse += 0.012;
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = W + 20;
        if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20;
        if (n.y > H + 20) n.y = -20;
      }

      // Edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const maxD = 130;
          if (d < maxD) {
            const alpha = (1 - d / maxD) * 0.18 * ((a.depth + b.depth) / 2);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(14,118,255,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Nodes
      for (const n of nodes) {
        const pulse = 1 + Math.sin(n.pulse) * 0.18;
        const r = n.r * pulse * n.depth;
        const alpha = 0.4 + n.depth * 0.5;

        // Glow
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4);
        grd.addColorStop(0, n.color + "44");
        grd.addColorStop(1, n.color + "00");
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Flowing data packets along edges
      const t = Date.now() / 1000;
      for (let i = 0; i < Math.min(5, nodes.length - 1); i++) {
        const a = nodes[i], b = nodes[i + 3 < nodes.length ? i + 3 : 0];
        const frac = ((t * 0.4 + i * 0.2) % 1);
        const px = a.x + (b.x - a.x) * frac;
        const py = a.y + (b.y - a.y) * frac;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#0E76FF";
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    const onResize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.scale(DPR, DPR);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      aria-hidden="true"
    />
  );
}
