import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ChevronDown, Sparkles, Inbox, Bell } from "lucide-react";
import { actionMeta, classificationMeta, ALERT_STATUS } from "../../lib/constants";

function AlertCard({ alert, onAck, onDismiss, busyId }) {
  const [open, setOpen] = useState(false);
  const a = actionMeta(alert.recommended_action);
  const cls = classificationMeta(alert.classification);
  const st = ALERT_STATUS[alert.status] || ALERT_STATUS.open;
  const resolved = alert.status === "acknowledged" || alert.status === "dismissed";
  const busy = busyId === alert.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border-l-2 bg-void border border-line ${resolved ? "opacity-60" : ""}`}
      style={{ borderLeftColor: a.color }}
      data-testid={`alert-card-${alert.id}`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="inline-flex items-center gap-2 px-2.5 py-1 border" style={{ borderColor: a.color + "55", background: a.color + "14" }}>
            <span className="data-label text-[10px]" style={{ color: a.color }}>{a.label}</span>
          </span>
          <span className="data-label text-[10px] text-faint tabular-nums">{alert.day}</span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full" style={{ background: cls.color }} />
          <span className="data-label text-[10px]" style={{ color: cls.color }}>{cls.label}</span>
          <span className="data-label text-[10px] ml-auto" style={{ color: st.color }}>{st.label}</span>
        </div>

        <p className={`text-[13px] text-muted leading-relaxed ${open ? "" : "line-clamp-2"}`} data-testid="alert-explanation">
          {alert.explanation_text || "No explanation text available."}
        </p>

        {alert.explanation_text && alert.explanation_text.length > 120 && (
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 data-label text-[10px] text-cobalt mt-2 hover:opacity-80">
            {open ? "Show less" : "Read full explanation"}
            <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}

        {!resolved && (
          <div className="flex gap-2 mt-4">
            <button
              data-testid={`alert-ack-${alert.id}`}
              onClick={() => onAck(alert.id)}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-safe/50 text-safe hover:bg-safe/10 transition-colors duration-200 data-label text-[10px] disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" /> Acknowledge
            </button>
            <button
              data-testid={`alert-dismiss-${alert.id}`}
              onClick={() => onDismiss(alert.id)}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-ink/20 text-muted hover:bg-surface hover:text-ink transition-colors duration-200 data-label text-[10px] disabled:opacity-40"
            >
              <X className="w-3.5 h-3.5" /> Dismiss
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AlertFeed({ alerts, loading, onAck, onDismiss, onGenerate, generating, busyId, canGenerate }) {
  const open = alerts.filter((a) => a.status === "open");
  const resolved = alerts.filter((a) => a.status !== "open");

  return (
    <div className="card rounded-card flex flex-col h-full" data-testid="alert-feed">
      <div className="flex items-center justify-between p-5 border-b border-line">
        <div className="flex items-center gap-2.5">
          <Bell className="w-4 h-4 text-cobalt" />
          <h3 className="font-display font-bold text-lg">Alert feed</h3>
          {open.length > 0 && (
            <span className="data-label text-[10px] px-2 py-0.5 bg-cobalt/15 text-cobalt tabular-nums">{open.length} open</span>
          )}
        </div>
        {canGenerate && (
          <button data-testid="generate-alerts" onClick={onGenerate} disabled={generating} className="flex items-center gap-1.5 data-label text-[10px] text-cobalt hover:opacity-80 disabled:opacity-40">
            <Sparkles className="w-3.5 h-3.5" /> {generating ? "Explaining…" : "Explain"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[640px]">
        {loading && alerts.length === 0 && (
          <div className="text-center py-12 data-label text-[11px] text-faint animate-pulse">Loading alerts…</div>
        )}
        {!loading && alerts.length === 0 && (
          <div className="text-center py-12">
            <Inbox className="w-8 h-8 mx-auto mb-3 text-faint" strokeWidth={1.5} />
            <p className="text-muted text-sm mb-1">No alerts yet</p>
            <p className="text-[12px] text-faint max-w-[220px] mx-auto">Run a simulation, analyse the days, then explain to generate alerts.</p>
          </div>
        )}
        <AnimatePresence>
          {open.map((a) => <AlertCard key={a.id} alert={a} onAck={onAck} onDismiss={onDismiss} busyId={busyId} />)}
        </AnimatePresence>
        {resolved.length > 0 && (
          <>
            <p className="data-label text-[10px] text-faint pt-3">Resolved</p>
            <AnimatePresence>
              {resolved.map((a) => <AlertCard key={a.id} alert={a} onAck={onAck} onDismiss={onDismiss} busyId={busyId} />)}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
