import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { classificationMeta } from "../../lib/constants";

const fmtNum = (v) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  return Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2);
};

// Turns contributing_features JSON into a short, human list of what moved.
function extractDrivers(cf) {
  if (!cf || typeof cf !== "object") return [];
  const out = [];
  const z = cf.zscores || {};
  Object.entries(z).forEach(([k, v]) => {
    if (typeof v === "number" && Math.abs(v) >= 1.5) {
      out.push({ label: k.replace(/_/g, " "), value: `${v > 0 ? "+" : ""}${fmtNum(v)}σ` });
    }
  });
  if (typeof cf.ml_score === "number") out.push({ label: "ML anomaly score", value: fmtNum(cf.ml_score) });
  const cusum = cf.cusum || {};
  Object.entries(cusum).forEach(([k, v]) => {
    if (typeof v === "number" && Math.abs(v) >= 2) out.push({ label: `cusum ${k.replace(/_/g, " ")}`, value: fmtNum(v) });
  });
  return out.slice(0, 5);
}

function reasoningText(cf) {
  const r = cf?.reasoning;
  if (!r) return null;
  if (Array.isArray(r)) return r.join(" · ");
  if (typeof r === "string") return r;
  return null;
}

// Badge + hover popover with the plain-English explanation and drivers.
export default function ClassificationBadge({ classification, severity, contributing, day, size = "md" }) {
  const [open, setOpen] = useState(false);
  const meta = classificationMeta(classification);
  const drivers = extractDrivers(contributing);
  const reason = reasoningText(contributing);
  const sev = severity !== null && severity !== undefined ? Number(severity) : null;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      data-testid={`classification-badge-${classification}`}
    >
      <span
        className={`inline-flex items-center gap-2 border cursor-help ${size === "sm" ? "px-2.5 py-1" : "px-3 py-1.5"}`}
        style={{ borderColor: meta.color + "66", background: meta.color + "14" }}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
        <span className="data-label text-[11px]" style={{ color: meta.color }}>{meta.label}</span>
        {sev !== null && (
          <span className="data-label text-[11px] text-ink/80 tabular-nums border-l pl-2" style={{ borderColor: meta.color + "44" }}>
            {sev.toFixed(2)}
          </span>
        )}
      </span>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-40 top-full left-0 mt-2 w-[320px] bg-surface border shadow-2xl p-5"
            style={{ borderColor: meta.color + "44" }}
            data-testid="explain-popover"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="data-label text-[11px]" style={{ color: meta.color }}>{meta.label}</span>
              {day && <span className="data-label text-[10px] text-faint">{day}</span>}
            </div>
            {sev !== null && (
              <div className="mb-3">
                <div className="h-1.5 bg-void overflow-hidden">
                  <div className="h-full" style={{ width: `${Math.min(100, sev * 100)}%`, background: meta.color }} />
                </div>
                <p className="data-label text-[10px] text-faint mt-1.5">Severity {sev.toFixed(2)} / 1.00</p>
              </div>
            )}
            <p className="text-[13px] text-muted leading-relaxed mb-3">{reason || meta.blurb}</p>
            {drivers.length > 0 && (
              <div className="border-t border-line pt-3">
                <p className="data-label text-[10px] text-faint mb-2">Contributing metrics</p>
                <div className="space-y-1.5">
                  {drivers.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px]">
                      <span className="text-muted capitalize">{d.label}</span>
                      <span className="font-narrow tabular-nums text-ink">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
