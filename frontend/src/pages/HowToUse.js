import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  UserPlus, ShieldCheck, Users, UploadCloud, Radar,
  MessageSquareText, CheckCheck, Plus, ArrowUpRight,
} from "lucide-react";
import Reveal from "../components/Reveal";
import CharReveal from "../components/CharReveal";
import MagneticButton from "../components/MagneticButton";
import ParallaxLayer from "../components/ParallaxLayer";
import DetectionPipeline from "../components/DetectionPipeline";

const steps = [
  { icon: UserPlus,         title: "Create your account",           body: "Sign up as a merchant, analyst or admin. Merchants name their business; analysts get the multi-merchant view.",                          color: "#0E76FF" },
  { icon: ShieldCheck,      title: "Verify with a one-time code",   body: "We send a 6-digit code to your phone that lives for 60 seconds. Enter it and your account is verified.",                               color: "#00E676" },
  { icon: Users,            title: "Land in the right view",        body: "Your role decides what you see. Merchants see only themselves; analysts see the whole book of merchants.",                              color: "#64D2C9" },
  { icon: UploadCloud,      title: "Upload a CSV or run a simulation", body: "Drop real transaction data, or launch the built-in simulator with one of five personas to watch Pulse work live.",                  color: "#FFB300" },
  { icon: Radar,            title: "Watch patterns get detected",   body: "Features roll up daily, three detection layers score each day, and classifications appear with a 0–1 severity.",                      color: "#F44336" },
  { icon: MessageSquareText, title: "Read an explained alert",      body: "Open any alert for a plain-English verdict, the exact metrics behind it, and one bounded recommended action.",                         color: "#C0FE04" },
  { icon: CheckCheck,       title: "Acknowledge or dismiss",        body: "You decide. Every acknowledge and dismiss is written to the audit trail with your identity and a timestamp.",                          color: "#FDFBF7" },
];

const faqs = [
  {
    q: "Why not just ask an LLM to detect the anomalies?",
    a: "Because an LLM guesses; it doesn't measure. Pulse detects with math it can defend — z-scores, CUSUM drift, and an IsolationForest — then uses the LLM only to explain a decision that was already made. The model reads evidence, it doesn't invent it.",
  },
  {
    q: "How does it avoid crying wolf on a normal seasonal dip?",
    a: "A dip alone isn't enough. Pulse looks for a sustained turn across multiple correlated features and checks it against the merchant's own baseline and history. A drop that fits a known seasonal rhythm is labelled 'seasonal dip' — expected, not alarming.",
  },
  {
    q: "Does Pulse ever move money on its own?",
    a: "Never. Pulse outputs exactly one of four bounded recommendations — capital outreach, risk review, growth upsell, or no action — and stops there. A human is always the gate between a signal and any real-world decision.",
  },
  {
    q: "What's the difference between a fraud ring and a viral breakout?",
    a: "Both spike volume. A breakout keeps healthy refund rates and a mix of returning customers. A fraud ring is a wave of brand-new customers whose payments turn into refunds and chargebacks days later — a cash-out signature.",
  },
  {
    q: "What data does Pulse need to work?",
    a: "Just transaction rows: a timestamp, amount, status, payment method and a pseudonymous customer id. From those it derives velocity, ticket-size stats, refund and chargeback ratios and repeat-customer rate — no PII required.",
  },
];

// ─── Scroll-linked vertical progress bar beside the step list ────────────────
function StepsWithProgress({ stepsData }) {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"],
  });

  // The progress bar height grows as user scrolls through the steps section
  const lineScaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={containerRef} className="relative flex gap-6 md:gap-10">
      {/* Scroll-linked vertical progress track */}
      <div className="hidden md:flex flex-col items-center shrink-0 pt-10">
        <div className="relative w-[1px] bg-line" style={{ height: stepsData.length * 88 }}>
          <motion.div
            className="absolute top-0 left-0 right-0 bg-cobalt"
            style={{ scaleY: lineScaleY, transformOrigin: "top", height: "100%" }}
          />
          {/* Step dots on the track */}
          {stepsData.map((_, i) => (
            <motion.div
              key={i}
              className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-cobalt"
              style={{ top: `${(i / (stepsData.length - 1)) * 100}%`, translateY: "-50%" }}
              initial={{ backgroundColor: "transparent" }}
              whileInView={{ backgroundColor: "#0E76FF" }}
              viewport={{ once: true, margin: "-40% 0px" }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            />
          ))}
        </div>
      </div>

      {/* Step rows */}
      <div className="flex-1 space-y-px bg-line border border-line">
        {stepsData.map((s, i) => (
          <Reveal key={s.title} delay={Math.min(i * 0.04, 0.24)}>
            <motion.div
              className="group bg-bg flex flex-col md:flex-row md:items-center gap-6 md:gap-10 p-8 md:px-12 md:py-9 transition-all duration-400 hover:bg-surface relative overflow-hidden"
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2 }}
            >
              {/* Left accent on hover */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px] scale-y-0 group-hover:scale-y-100 transition-transform duration-400 origin-center"
                style={{ background: s.color }}
              />

              {/* Step number */}
              <span
                className="font-narrow text-4xl md:text-5xl font-black tabular-nums w-16 shrink-0 transition-colors duration-300"
                style={{ color: s.color }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              {/* Icon box */}
              <span
                className="flex items-center justify-center w-12 h-12 border shrink-0 transition-all duration-300 group-hover:scale-105"
                style={{ borderColor: `${s.color}44` }}
              >
                <s.icon className="w-5 h-5 text-ink" strokeWidth={1.6} />
              </span>

              {/* Content */}
              <div className="flex-1">
                <h3 className="font-display font-bold text-xl md:text-2xl mb-1.5 tracking-tight">
                  {s.title}
                </h3>
                <p className="text-muted leading-relaxed max-w-2xl">{s.body}</p>
              </div>

              {/* Hover arrow */}
              <motion.div
                className="shrink-0 hidden md:flex"
                initial={{ opacity: 0, x: -8 }}
                whileHover={{ opacity: 1, x: 0 }}
              >
                <ArrowUpRight className="w-5 h-5" style={{ color: s.color }} />
              </motion.div>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function HowToUse() {
  const nav = useNavigate();
  const [open, setOpen] = useState(0);
  const headerRef = useRef(null);

  // Parallax on the hero decorative orbs
  const { scrollYProgress: headerProgress } = useScroll({
    target: headerRef,
    offset: ["start start", "end start"],
  });
  const rightOrbY  = useTransform(headerProgress, [0, 1], [0,  60]);
  const leftOrbY   = useTransform(headerProgress, [0, 1], [0, -40]);
  const headingY   = useTransform(headerProgress, [0, 1], [0, -30]);

  return (
    <div data-testid="how-page" className="pt-24">
      {/* ══════════════════════════════════════════════════════ HEADER */}
      <section ref={headerRef} className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 grid-lines opacity-50" />

        {/* Parallax orbs at different speeds */}
        <motion.div
          style={{ y: rightOrbY }}
          className="absolute -top-24 right-0 w-[440px] h-[440px] rounded-full bg-cobalt/10 blur-[120px] pointer-events-none"
        />
        <motion.div
          style={{ y: leftOrbY }}
          className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-safe/6 blur-[100px] pointer-events-none"
        />

        <div className="relative max-w-grid mx-auto px-7">
          {/* Hero heading with its own parallax layer */}
          <motion.div style={{ y: headingY }}>
            <Reveal>
              <p className="data-label text-[11px] text-cobalt mb-6">Using Pulse</p>
            </Reveal>
            <h1 className="h1 max-w-4xl">
              <CharReveal text="From signup to a signal" mode="words" delay={0.05} />
              <br />
              <span className="text-muted">
                <CharReveal text="you trust." mode="words" delay={0.3} />
              </span>
            </h1>
          </motion.div>

          <Reveal delay={0.4} y={20}>
            <p className="text-lg text-muted max-w-2xl mt-8 leading-relaxed">
              Seven steps from an empty account to a live, explained alert you can
              act on. No setup theatre — sign up and you can be watching detection
              run inside a minute.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ DETECTION PIPELINE */}
      <section className="relative py-16 border-t border-line bg-void overflow-hidden">
        <ParallaxLayer speed={-0.06} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 right-0 w-[300px] h-[300px] -translate-y-1/2 rounded-full bg-cobalt/5 blur-[100px]" />
        </ParallaxLayer>
        <div className="relative max-w-grid mx-auto px-7">
          <Reveal>
            <p className="data-label text-[11px] text-cobalt mb-3">Under the hood</p>
            <h2 className="h3 mb-8 text-muted">The detection pipeline</h2>
          </Reveal>
          <Reveal delay={0.1} y={24}>
            <div className="overflow-x-auto">
              <DetectionPipeline className="min-w-[600px]" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ NUMBERED WALKTHROUGH */}
      {/* Steps with scroll-linked vertical progress bar */}
      <section className="relative py-16 border-t border-line">
        <div className="max-w-grid mx-auto px-7">
          <StepsWithProgress stepsData={steps} />

          <Reveal delay={0.1}>
            <div className="mt-12 flex flex-wrap gap-4">
              <MagneticButton>
                <button data-testid="how-start-cta" onClick={() => nav("/signup")} className="btn btn-cobalt">
                  <span>Create an account</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </MagneticButton>
              <MagneticButton>
                <button data-testid="how-dashboard-cta" onClick={() => nav("/dashboard")} className="btn">
                  <span>Skip to the dashboard</span>
                </button>
              </MagneticButton>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ FAQ */}
      <section className="relative py-28 border-t border-line bg-void overflow-hidden">
        <div className="absolute inset-0 grid-lines opacity-30" />

        {/* Parallax glow behind FAQ */}
        <ParallaxLayer speed={0.1} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[200px] rounded-full bg-cobalt/6 blur-[100px]" />
        </ParallaxLayer>

        <div className="max-w-grid mx-auto px-7 grid grid-cols-1 lg:grid-cols-12 gap-12 relative">
          {/* Left label */}
          <div className="lg:col-span-4">
            <Reveal>
              <p className="data-label text-[11px] text-cobalt mb-4">FAQ</p>
              <h2 className="h2">The honest questions.</h2>
              <p className="text-muted mt-6 leading-relaxed">
                The things a judge, a merchant and a risk analyst all ask before
                they'll trust a call Pulse makes.
              </p>
            </Reveal>
          </div>

          {/* Accordion */}
          <div className="lg:col-span-8">
            <div className="border-t border-line">
              {faqs.map((f, i) => {
                const isOpen = open === i;
                return (
                  <div key={i} className="border-b border-line">
                    <button
                      data-testid={`faq-toggle-${i}`}
                      onClick={() => setOpen(isOpen ? -1 : i)}
                      className="w-full flex items-start justify-between gap-6 py-7 text-left group"
                    >
                      <span className="flex items-start gap-5">
                        <span className="data-label text-[10px] text-cobalt pt-1 tabular-nums">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-display font-bold text-lg md:text-xl tracking-tight group-hover:text-cobalt transition-colors duration-200">
                          {f.q}
                        </span>
                      </span>
                      <motion.span
                        animate={{ rotate: isOpen ? 45 : 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="shrink-0 mt-1"
                      >
                        <Plus className="w-5 h-5 text-muted group-hover:text-cobalt transition-colors" />
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="text-muted leading-relaxed pb-8 pl-10 max-w-2xl">{f.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
