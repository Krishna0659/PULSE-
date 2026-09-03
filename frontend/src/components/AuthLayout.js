import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import AuthVisual from "./AuthVisual";


// Split-screen auth shell: animated canvas left rail + form panel on the right.
export default function AuthLayout({ children, step, steps }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-bg">
      {/* ── Left brand rail ── */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 border-r border-line bg-void overflow-hidden">
        {/* Animated canvas background */}
        <AuthVisual className="absolute inset-0 w-full h-full" />

        {/* Overlay vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 pointer-events-none" />

        {/* Grid lines */}
        <div className="absolute inset-0 grid-lines opacity-20" />

        {/* Logo */}
        <Link to="/" className="relative flex items-center gap-2.5 z-10">
          <span className="flex items-center justify-center w-8 h-8 border border-ink/70">
            <Activity className="w-4 h-4 text-cobalt" strokeWidth={2.5} />
          </span>
          <span className="font-display font-extrabold text-lg">PULSE</span>
        </Link>

        {/* Hero copy */}
        <div className="relative z-10">
          <p className="data-label text-[10px] text-cobalt mb-6">Secured by design</p>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="font-display font-extrabold text-4xl xl:text-5xl leading-[1.02] tracking-tight max-w-md"
          >
            Two steps, always.
            <br />
            <span className="text-muted">Never one leaked<br />password away.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="text-muted mt-6 max-w-sm leading-relaxed"
          >
            Every sign-in is verified twice — credentials, then a one-time code.
            The same rigour we bring to reading your payment data.
          </motion.p>
        </div>

        {/* Step indicators */}
        {steps && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="relative z-10 flex items-center gap-3"
          >
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                    style={{ background: i === step ? "#0E76FF" : "rgba(253,251,247,0.25)" }}
                  />
                  <span className={`data-label text-[10px] ${i === step ? "text-ink" : "text-faint"}`}>
                    {String(i + 1).padStart(2, "0")} {s}
                  </span>
                </div>
                {i < steps.length - 1 && <span className="w-6 h-px bg-line" />}
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Right form panel ── */}
      <div className="relative flex flex-col items-center justify-center px-6 py-16 sm:px-12">
        {/* Subtle gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-cobalt/5 blur-3xl pointer-events-none" />

        {/* Mobile logo */}
        <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-10">
          <span className="flex items-center justify-center w-8 h-8 border border-ink/70">
            <Activity className="w-4 h-4 text-cobalt" strokeWidth={2.5} />
          </span>
          <span className="font-display font-extrabold text-lg">PULSE</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md relative z-10"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
