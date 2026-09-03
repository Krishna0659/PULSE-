import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid,
} from "recharts";
import { ChevronRight, Store, Activity } from "lucide-react";
import ClassificationBadge from "./ClassificationBadge";
import { classificationMeta } from "../../lib/constants";

function SeverityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const m = classificationMeta(p.classification);
  return (
    <div className="bg-surface border border-line px-3 py-2 shadow-2xl">
      <p className="data-label text-[10px] text-faint mb-1">{p.day}</p>
      <p className="data-label text-[11px]" style={{ color: m.color }}>{m.label}</p>
      <p className="font-narrow text-sm tabular-nums text-ink mt-0.5">sev {Number(p.severity).toFixed(2)}</p>
    </div>
  );
}

function SeverityTimeline({ anomalies }) {
  const data = anomalies.map((a) => ({
    day: (a.day || "").slice(5),
    severity: Number(a.severity) || 0,
    classification: a.classification,
    contributing: a.contributing_features,
    fullDay: a.day,
  }));

  // annotate classification-change points
  const changes = [];
  for (let i = 1; i < anomalies.length; i++) {
    if (anomalies[i].classification !== anomalies[i - 1].classification) {
      changes.push(anomalies[i]);
    }
  }

  return (
    <div>
      <div className="h-[180px] w-full" data-testid="severity-timeline">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="rgba(253,251,247,0.05)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "rgba(253,251,247,0.35)", fontSize: 9, fontFamily: "Archivo Narrow" }} tickLine={false} axisLine={{ stroke: "rgba(253,251,247,0.1)" }} minTickGap={16} />
            <YAxis domain={[0, 1]} tick={{ fill: "rgba(253,251,247,0.35)", fontSize: 9, fontFamily: "Archivo Narrow" }} tickLine={false} axisLine={false} />
            <Tooltip content={<SeverityTooltip />} cursor={{ fill: "rgba(253,251,247,0.04)" }} />
            <Bar dataKey="severity" radius={[1, 1, 0, 0]}>
              {data.map((d, i) => <Cell key={i} fill={classificationMeta(d.classification).color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {changes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="data-label text-[10px] text-faint">Classification shifts:</span>
          {changes.slice(-6).map((c, i) => (
            <span key={i} className="data-label text-[10px]" style={{ color: classificationMeta(c.classification).color }}>
              {(c.day || "").slice(5)} → {classificationMeta(c.classification).label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MerchantPanel({ merchants, selectedId, onSelect, anomalies, loadingAnomalies, latestByMerchant }) {
  return (
    <div className="card rounded-card" data-testid="merchant-panel">
      <div className="flex items-center gap-2.5 p-5 border-b border-line">
        <Store className="w-4 h-4 text-cobalt" />
        <h3 className="font-display font-bold text-lg">Merchants</h3>
        <span className="data-label text-[10px] text-faint ml-auto tabular-nums">{merchants.length}</span>
      </div>

      <div className="divide-y divide-line">
        {merchants.length === 0 && (
          <div className="p-8 text-center text-muted text-sm">No merchants yet.</div>
        )}
        {merchants.map((m) => {
          const selected = selectedId === m.id;
          const latest = latestByMerchant?.[m.id];
          return (
            <div key={m.id} data-testid={`merchant-row-${m.id}`}>
              <button
                onClick={() => onSelect(selected ? null : m.id)}
                className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors duration-200 ${selected ? "bg-surface" : "hover:bg-surface/50"}`}
              >
                <ChevronRight className={`w-4 h-4 text-faint transition-transform duration-300 ${selected ? "rotate-90 text-cobalt" : ""}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold truncate">{m.name}</p>
                  <p className="data-label text-[10px] text-faint mt-0.5">
                    {m.persona || "—"}{m.category ? ` · ${m.category}` : ""}
                  </p>
                </div>
                {latest ? (
                  <ClassificationBadge classification={latest.classification} severity={latest.severity} contributing={latest.contributing_features} day={latest.day} size="sm" />
                ) : selected ? null : (
                  <span className="data-label text-[10px] text-faint">select →</span>
                )}
              </button>

              <AnimatePresence>
                {selected && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-6 pt-1 bg-surface/40">
                      <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-3.5 h-3.5 text-cobalt" />
                        <span className="data-label text-[10px] text-muted">Anomaly severity timeline</span>
                      </div>
                      {loadingAnomalies ? (
                        <div className="h-[180px] flex items-center justify-center data-label text-[11px] text-faint animate-pulse">Loading…</div>
                      ) : anomalies && anomalies.length > 0 ? (
                        <SeverityTimeline anomalies={anomalies} />
                      ) : (
                        <div className="h-[120px] flex flex-col items-center justify-center text-center">
                          <p className="text-muted text-sm mb-1">No anomaly scores yet</p>
                          <p className="text-[12px] text-faint max-w-xs">Feed this merchant data, then run analysis to score each day.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
