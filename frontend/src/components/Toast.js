import React, { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

const ToastCtx = createContext(null);

const CONFIG = {
  success: { icon: CheckCircle2, color: "#00E676", bar: "#00E676" },
  error:   { icon: AlertTriangle, color: "#F44336", bar: "#F44336" },
  info:    { icon: Info,          color: "#0E76FF", bar: "#0E76FF" },
};

function Toast({ toast, onDismiss }) {
  const cfg = CONFIG[toast.type] || CONFIG.info;
  const Icon = cfg.icon;

  return (
    <motion.div
      data-testid="toast"
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex items-start gap-3 bg-surface border border-line px-4 py-4 shadow-2xl overflow-hidden"
      style={{ minWidth: 280, maxWidth: 360 }}
    >
      {/* Color left bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: cfg.bar }}
      />

      {/* Countdown bar at bottom */}
      <motion.div
        className="absolute bottom-0 left-0 h-[2px] opacity-40"
        style={{ background: cfg.bar }}
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: 5, ease: "linear" }}
      />

      <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: cfg.color }} />
      <p className="text-sm text-ink leading-snug flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-faint hover:text-ink transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((type, message) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  const toast = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[10010] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <Toast toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
