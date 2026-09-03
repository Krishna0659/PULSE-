import React, { useEffect, useRef } from "react";

/**
 * DataOrb — 3D rotating data-sphere using canvas.
 * Renders a wireframe/dot sphere with classification-colored arcs.
 * Mouse/scroll parallax tilt for depth.
 * Pure canvas, no external deps.
 */
export default function DataOrb({ className = "", size = 420 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    const DPR = window.devicePixelRatio || 1;

    canvas.width = size * DPR;
    canvas.height = size * DPR;
    ctx.scale(DPR, DPR);

    const CX = size / 2, CY = size / 2;
    const R = size * 0.38;

    let rotY = 0, rotX = 0.3;
    let targetRotY = 0, targetRotX = 0.3;
    let animId;

    // ── Build sphere lattice ──
    const LATS = 14, LONS = 20;
    const dots = [];
    for (let i = 0; i <= LATS; i++) {
      const phi = (Math.PI * i) / LATS;
      for (let j = 0; j < LONS; j++) {
        const theta = (2 * Math.PI * j) / LONS;
        dots.push({
          x0: R * Math.sin(phi) * Math.cos(theta),
          y0: R * Math.cos(phi),
          z0: R * Math.sin(phi) * Math.sin(theta),
          // classification color assignment by latitude band
          colorIdx: Math.floor((i / LATS) * 5),
        });
      }
    }

    // ── Classification arc overlays (great circle segments) ──
    const ARCS = [
      { color: "#FFB300", phi: 0.55, startTheta: 0.2, endTheta: 2.1, label: "DISTRESS" },
      { color: "#F44336", phi: 1.0,  startTheta: 3.5, endTheta: 5.5, label: "FRAUD" },
      { color: "#00E676", phi: 0.3,  startTheta: 1.5, endTheta: 4.0, label: "BREAKOUT" },
      { color: "#0E76FF", phi: 1.7,  startTheta: 0.8, endTheta: 2.8, label: "SEASONAL" },
    ];

    const ZONE_COLORS = ["#0E76FF", "#00E676", "#FFB300", "#F44336", "#64D2C9"];

    const project = (x, y, z) => {
      // Rotate Y
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      let rx = x * cosY - z * sinY;
      let ry = y;
      let rz = x * sinY + z * cosY;
      // Rotate X
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      let ry2 = ry * cosX - rz * sinX;
      let rz2 = ry * sinX + rz * cosX;
      return { sx: CX + rx, sy: CY + ry2, z: rz2 };
    };

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetRotY = nx * 1.2;
      targetRotX = 0.3 + ny * 0.6;
    };

    window.addEventListener("mousemove", onMouseMove);

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // Smooth rotation
      rotY += (targetRotY - rotY) * 0.04;
      rotX += (targetRotX - rotX) * 0.04;
      targetRotY += 0.003; // slow auto-rotation

      // ── Ambient glow ──
      const grd = ctx.createRadialGradient(CX, CY, R * 0.2, CX, CY, R * 1.1);
      grd.addColorStop(0, "rgba(14,118,255,0.06)");
      grd.addColorStop(0.5, "rgba(14,118,255,0.03)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(CX, CY, R * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // ── Wireframe longitude lines ──
      for (let j = 0; j < LONS; j++) {
        const theta = (2 * Math.PI * j) / LONS;
        const points = [];
        for (let k = 0; k <= 32; k++) {
          const phi = (Math.PI * k) / 32;
          const x0 = R * Math.sin(phi) * Math.cos(theta);
          const y0 = R * Math.cos(phi);
          const z0 = R * Math.sin(phi) * Math.sin(theta);
          points.push(project(x0, y0, z0));
        }
        ctx.beginPath();
        points.forEach((p, i) => {
          // eslint-disable-next-line no-unused-vars
          const _alpha = (p.z / R + 1) / 2; // depth fade — available for future use
          if (i === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        });
        ctx.strokeStyle = `rgba(253,251,247,0.04)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── Latitude circles ──
      for (let i = 1; i < LATS; i++) {
        const phi = (Math.PI * i) / LATS;
        const points = [];
        for (let k = 0; k <= 40; k++) {
          const theta = (2 * Math.PI * k) / 40;
          const x0 = R * Math.sin(phi) * Math.cos(theta);
          const y0 = R * Math.cos(phi);
          const z0 = R * Math.sin(phi) * Math.sin(theta);
          points.push(project(x0, y0, z0));
        }
        ctx.beginPath();
        points.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        });
        ctx.closePath();
        ctx.strokeStyle = `rgba(253,251,247,0.04)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── Classification arc highlights ──
      for (const arc of ARCS) {
        const steps = 48;
        const points = [];
        for (let k = 0; k <= steps; k++) {
          const t = arc.startTheta + ((arc.endTheta - arc.startTheta) * k) / steps;
          const x0 = R * 1.01 * Math.sin(arc.phi) * Math.cos(t);
          const y0 = R * 1.01 * Math.cos(arc.phi);
          const z0 = R * 1.01 * Math.sin(arc.phi) * Math.sin(t);
          points.push(project(x0, y0, z0));
        }
        // Only draw front-facing segments
        ctx.beginPath();
        let started = false;
        for (const p of points) {
          if (p.z > -R * 0.1) {
            if (!started) { ctx.moveTo(p.sx, p.sy); started = true; }
            else ctx.lineTo(p.sx, p.sy);
          } else {
            started = false;
          }
        }
        ctx.strokeStyle = arc.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = arc.color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.75;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // ── Depth-sorted dots ──
      const projected = dots.map((d) => ({ ...d, ...project(d.x0, d.y0, d.z0) }));
      projected.sort((a, b) => a.z - b.z);

      for (const d of projected) {
        const depth = (d.z / R + 1) / 2; // 0=far, 1=near
        if (depth < 0.15) continue; // skip deep back-face dots
        const r = 0.8 + depth * 1.8;
        const alpha = 0.2 + depth * 0.55;
        const col = ZONE_COLORS[d.colorIdx % ZONE_COLORS.length];
        ctx.beginPath();
        ctx.arc(d.sx, d.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── Equator pulse ring ──
      const t = Date.now() / 1000;
      const ringR = R * 1.04;
      const grd2 = ctx.createRadialGradient(CX, CY, ringR - 4, CX, CY, ringR + 4);
      const pulse = 0.4 + Math.sin(t * 2) * 0.3;
      grd2.addColorStop(0, `rgba(14,118,255,${pulse * 0.35})`);
      grd2.addColorStop(1, "rgba(14,118,255,0)");
      ctx.beginPath();
      ctx.ellipse(CX, CY, ringR, ringR * 0.28, 0, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(14,118,255,${pulse * 0.6})`;
      ctx.shadowColor = "#0E76FF";
      ctx.shadowBlur = 12 * pulse;
      ctx.stroke();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
