import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  motion, useScroll, useTransform, AnimatePresence,
} from "framer-motion";
import {
  ArrowUpRight, TrendingDown, TrendingUp, ShieldAlert, Waves,
  Radar, MessageSquareText, ScrollText, Gauge, Lock, ChevronDown,
} from "lucide-react";
import Reveal from "../components/Reveal";
import CharReveal from "../components/CharReveal";
import MagneticButton from "../components/MagneticButton";
import ParallaxLayer from "../components/ParallaxLayer";
import CountUp from "../components/CountUp";
import HeroCanvas from "../components/HeroCanvas";
import DataOrb from "../components/DataOrb";
import SignalWave from "../components/SignalWave";
import { CLASSIFICATIONS } from "../lib/constants";

// ─── Data ───────────────────────────────────────────────────────────────────

const callouts = [
  {
    n: "01", icon: TrendingDown,
    title: "Catch distress and breakout early",
    body: "Pulse reads velocity, ticket size and repeat-customer rate to spot a business quietly declining — or genuinely taking off — weeks before it shows up on a standard dashboard.",
    color: "#FFB300",
  },
  {
    n: "02", icon: ShieldAlert,
    title: "Separate fraud from real growth",
    body: "A viral spike and a fraud ring both look like 'more money'. Pulse tells them apart by watching who the customers are and what happens to those payments days later.",
    color: "#F44336",
  },
  {
    n: "03", icon: MessageSquareText,
    title: "Every alert explains itself",
    body: "No black box. Each classification comes with a plain-English verdict, the exact metrics that drove it, and one bounded recommendation a human signs off on.",
    color: "#0E76FF",
  },
];

const props = [
  { key: "Detection", icon: Radar, title: "Three layers, one verdict",
    body: "Statistical z-scores and CUSUM catch drift. An IsolationForest catches the shapes rules miss. A rule-based classifier turns it into a name you can act on. They vote — you get one answer with a 0–1 severity." },
  { key: "Explainability", icon: MessageSquareText, title: "Language, not log files",
    body: "An LLM turns the model's evidence into a short, auditable paragraph — citing the specific features that moved. Written for a merchant, trusted by an analyst." },
  { key: "Transparency", icon: ScrollText, title: "A full audit trail",
    body: "Every signup, upload, simulation, score and decision is logged with an actor and a timestamp. Open the trail on any alert and see exactly how it came to be." },
  { key: "Speed", icon: Gauge, title: "Weeks of warning",
    body: "Because Pulse watches behaviour, not just totals, it flags a turn while there's still time to act — not in the post-mortem after the quarter closes." },
  { key: "Safety", icon: Lock, title: "Recommends, never moves money",
    body: "Pulse proposes exactly one of four bounded actions. It never touches a rupee automatically. A human is always the gate between a signal and a decision." },
];

const wasteGrid = [
  { icon: Waves,         title: "Buried in aggregates",   body: "Daily totals hide the shape of a decline until it's already a cliff.",                    color: "#FFB300" },
  { icon: TrendingUp,    title: "Growth looks like fraud", body: "Legit breakouts get frozen; real fraud rides in on the same spike.",                      color: "#F44336" },
  { icon: ScrollText,    title: "Alerts with no 'why'",   body: "A red number nobody trusts is a red number nobody acts on.",                              color: "#0E76FF" },
  { icon: ShieldAlert,   title: "Signal arrives too late", body: "By the time a dashboard reacts, the merchant already felt it.",                           color: "#64D2C9" },
];

// ─── Animated metric bar ─────────────────────────────────────────────────────
function MetricBar({ label, val, color, delay }) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="data-label text-[10px] text-muted">{label}</span>
        <span className="data-label text-[10px]" style={{ color }}>
          <CountUp value={val * 100} suffix="%" decimals={0} duration={1200} />
        </span>
      </div>
      <div className="h-[3px] rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${val * 100}%` }}
          transition={{ duration: 1.4, delay, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
        />
      </div>
    </div>
  );
}

// ─── Marquee ticker ──────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  "DISTRESS DRIFT", "FRAUD RING INFILTRATION", "ORGANIC BREAKOUT",
  "SEASONAL DIP", "94.8% F1 SCORE", "18 ms LATENCY",
  "21-DAY LEAD TIME", "0.42% FALSE POSITIVES", "100% LLM-CODED",
];

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]; // double for seamless loop
  return (
    <div className="relative overflow-hidden border-y border-line py-3 bg-void">
      <div
        className="flex gap-12 whitespace-nowrap"
        style={{ animation: "ticker 28s linear infinite" }}
      >
        {items.map((item, i) => (
          <span key={i} className="data-label text-[10px] text-faint flex items-center gap-4">
            <span className="text-cobalt opacity-50">✦</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Sticky step card (for pin-scroll storytelling) ──────────────────────────
// Each "step" pins its number while the rest scrolls.
const STORY_STEPS = [
  {
    n: "01", color: "#0E76FF",
    label: "INGEST",
    headline: "Transactions arrive raw.",
    body: "CSV upload, live simulator, or real-time feed. Pulse reads timestamp, amount, status, payment method, and a pseudonymous customer ID. Nothing more is needed.",
  },
  {
    n: "02", color: "#FFB300",
    label: "FEATURES",
    headline: "Features crystallise each day.",
    body: "Daily velocity, median ticket size, new-vs-repeat customer ratio, refund and chargeback rates. These are the language the model speaks.",
  },
  {
    n: "03", color: "#F44336",
    label: "DETECT",
    headline: "Three layers vote.",
    body: "Z-score + CUSUM catches statistical drift. IsolationForest flags anomalous shapes. Rule classifier names the pattern. Together: one verdict with a 0–1 severity.",
  },
  {
    n: "04", color: "#00E676",
    label: "EXPLAIN",
    headline: "An LLM writes the case.",
    body: "Not guessing — citing. The model reads the exact features that moved and writes a plain-English audit paragraph. A merchant can understand it; an analyst can verify it.",
  },
  {
    n: "05", color: "#C0FE04",
    label: "DECIDE",
    headline: "A human acts — or doesn't.",
    body: "Pulse recommends exactly one bounded action. It never moves money. Acknowledge, dismiss, or escalate — every choice is timestamped and logged.",
  },
];

function StorySection() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // 5 steps → each takes 1/5 of scroll progress
  const stepIndex = useTransform(scrollYProgress, (v) =>
    Math.min(Math.floor(v * STORY_STEPS.length), STORY_STEPS.length - 1)
  );

  const [activeStep, setActiveStep] = React.useState(0);
  React.useEffect(() => {
    return stepIndex.onChange((v) => setActiveStep(v));
  }, [stepIndex]);

  const step = STORY_STEPS[activeStep];

  // Parallax on the big number label
  const numberY = useTransform(scrollYProgress, [0, 1], [0, -30]);

  return (
    <section
      ref={containerRef}
      className="relative border-t border-line bg-void"
      style={{ height: `${STORY_STEPS.length * 100}vh` }}
    >
      {/* ── Sticky panel ── */}
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 grid-lines opacity-30 pointer-events-none" />

        {/* Parallax floating orb behind active step */}
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute right-0 top-0 w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none"
          style={{ background: `${step.color}10` }}
        />

        <div className="relative max-w-grid mx-auto px-7 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: big step indicator */}
          <div className="lg:col-span-5">
            <motion.div style={{ y: numberY }}>
              {/* Label */}
              <motion.p
                key={`label-${activeStep}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="data-label text-[11px] mb-6"
                style={{ color: step.color }}
              >
                {step.label}
              </motion.p>

              {/* Giant step number */}
              <div
                className="font-narrow font-black select-none leading-none mb-8"
                style={{
                  fontSize: "clamp(6rem, 18vw, 14rem)",
                  color: `${step.color}18`,
                  lineHeight: 0.9,
                }}
              >
                {step.n}
              </div>

              {/* Step dots */}
              <div className="flex gap-2">
                {STORY_STEPS.map((s, i) => (
                  <div
                    key={i}
                    className="transition-all duration-500"
                    style={{
                      width: i === activeStep ? 24 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: i === activeStep ? step.color : "rgba(253,251,247,0.15)",
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right: content */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Accent line */}
                <div
                  className="w-8 h-[3px] rounded-full mb-10"
                  style={{ background: step.color }}
                />
                <h2
                  className="font-display font-extrabold tracking-tight mb-6"
                  style={{
                    fontSize: "clamp(2rem, 4vw, 3.5rem)",
                    lineHeight: 1.05,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {step.headline}
                </h2>
                <p className="text-muted text-lg md:text-xl leading-relaxed max-w-lg">
                  {step.body}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Scroll progress within this section */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="w-[1px] bg-line relative overflow-hidden" style={{ height: 48 }}>
            <motion.div
              className="absolute top-0 left-0 right-0 bg-cobalt"
              style={{
                height: "100%",
                scaleY: useTransform(scrollYProgress, [0, 1], [0, 1]),
                transformOrigin: "top",
              }}
            />
          </div>
          <span className="data-label text-[9px] text-faint">
            {activeStep + 1}/{STORY_STEPS.length}
          </span>
        </div>
      </div>
    </section>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function Home() {
  const nav = useNavigate();
  const [tab, setTab] = useState(0);
  const heroRef = useRef(null);
  const calloutsRef = useRef(null);

  // Hero-scoped scroll for DataOrb parallax
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const orbY = useTransform(heroProgress, [0, 1], [0, 80]);
  const orbScale = useTransform(heroProgress, [0, 1], [1, 0.8]);
  const orbOpacity = useTransform(heroProgress, [0, 0.6], [1, 0]);
  const heroTextY = useTransform(heroProgress, [0, 1], [0, -50]);

  // Callouts section — heading parallaxes slower than content
  const { scrollYProgress: calloutsProgress } = useScroll({
    target: calloutsRef,
    offset: ["start end", "end start"],
  });
  const calloutsHeadY = useTransform(calloutsProgress, [0, 1], [30, -30]);

  return (
    <div data-testid="home-page">
      {/* ══════════════════════════════════════════════════════ HERO */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden"
      >
        <HeroCanvas className="opacity-70" />
        <div className="absolute inset-0 grid-lines opacity-50" />

        {/* Parallax gradient orbs (drift at different speeds) */}
        <ParallaxLayer speed={0.12} className="absolute top-1/3 -right-32 w-[500px] h-[500px]">
          <div className="w-full h-full rounded-full bg-cobalt/10 blur-[140px]" />
        </ParallaxLayer>
        <ParallaxLayer speed={-0.08} className="absolute bottom-0 -left-32 w-[400px] h-[400px]">
          <div className="w-full h-full rounded-full bg-safe/7 blur-[140px]" />
        </ParallaxLayer>

        <div className="relative max-w-grid mx-auto px-7 w-full z-10">
          {/* Status label */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="data-label text-[11px] text-cobalt mb-10 flex items-center gap-3"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-safe live-dot" />
            Payment anomaly detection · risk analytics
          </motion.p>

          <div className="flex flex-col lg:flex-row justify-between items-center gap-12 w-full">
            {/* ── Left: hero text (slow upward parallax on scroll) */}
            <motion.div className="w-full lg:w-[62%] shrink-0 text-left" style={{ y: heroTextY }}>
              <h1 className="h1 max-w-none text-[clamp(2.5rem,5vw,3.75rem)] lg:text-[4.2rem] tracking-tight leading-[1.05]">
                <CharReveal text="Your payments are" mode="words" delay={0.1} stagger={0.06} />
                <br />
                <span className="text-muted">
                  <CharReveal text="already talking." mode="words" delay={0.3} stagger={0.06} />
                </span>
                <br />
                <CharReveal text="Pulse listens." mode="words" delay={0.55} stagger={0.07} />
              </h1>

              <Reveal delay={0.5} y={20}>
                <p className="text-lg md:text-xl text-muted max-w-xl mt-8 leading-relaxed">
                  Distress, breakout, a fraud ring, or just the season — Pulse names what's
                  happening inside a merchant's transactions weeks before a normal dashboard would.
                </p>
              </Reveal>

              <Reveal delay={0.65} y={16}>
                <div className="flex flex-wrap items-center gap-4 mt-10">
                  <MagneticButton>
                    <button
                      data-testid="hero-dashboard-cta"
                      onClick={() => nav("/dashboard")}
                      className="btn btn-cobalt"
                    >
                      <span>Launch Dashboard</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </MagneticButton>
                  <MagneticButton>
                    <button
                      data-testid="hero-research-cta"
                      onClick={() => nav("/research-report")}
                      className="btn"
                    >
                      <span>Research Report</span>
                    </button>
                  </MagneticButton>
                </div>
              </Reveal>

              {/* Classification legend */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.8 }}
                className="mt-12 flex flex-wrap gap-x-8 gap-y-3"
              >
                {Object.entries(CLASSIFICATIONS).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: v.color }} />
                    <span className="data-label text-[10px] text-muted">{v.label}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* ── Right: 3D DataOrb + analytics card (scroll parallax) */}
            <div className="w-full lg:w-[35%] relative flex items-center justify-center shrink-0">
              {/* DataOrb — faster downward scroll (exits first) */}
              <motion.div
                style={{ y: orbY, scale: orbScale, opacity: orbOpacity }}
                className="absolute -top-8 -right-8 pointer-events-none select-none"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <DataOrb size={320} className="opacity-80" />
              </motion.div>

              {/* Analytics card — slower parallax (stays longer) */}
              <motion.div
                style={{ y: useTransform(heroProgress, [0, 1], [0, 30]) }}
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full max-w-sm"
              >
                <div className="absolute -inset-1 bg-gradient-to-br from-cobalt/25 to-safe/15 rounded-2xl blur-xl opacity-60" />
                <div className="relative glass rounded-2xl overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-safe live-dot" />
                      <span className="data-label text-[10px] text-muted">LIVE · ANOMALY ENGINE</span>
                    </div>
                    <span className="data-label text-[10px] text-cobalt font-bold">
                      <CountUp value={94.8} suffix="% F1" decimals={1} duration={1800} />
                    </span>
                  </div>
                  <div className="px-5 py-5 space-y-4">
                    <MetricBar label="Distress Drift"  val={0.82} color="#FFB300" delay={0.6} />
                    <MetricBar label="Fraud Ring"      val={0.17} color="#F44336" delay={0.75} />
                    <MetricBar label="Breakout Surge"  val={0.61} color="#00E676" delay={0.9} />
                    <MetricBar label="Seasonal Dip"    val={0.44} color="#0E76FF" delay={1.05} />
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-white/8 border-t border-white/8">
                    {[
                      { stat: 18,   suffix: " ms",  label: "Latency",   decimals: 0 },
                      { stat: 21,   suffix: " days", label: "Lead Time", decimals: 0 },
                      { stat: 0.42, suffix: "%",     label: "False Pos.", decimals: 2 },
                    ].map((s) => (
                      <div key={s.label} className="py-4 text-center">
                        <div className="font-stat font-bold text-base text-ink">
                          <CountUp value={s.stat} suffix={s.suffix} decimals={s.decimals} duration={1600} />
                        </div>
                        <div className="data-label text-[9px] text-faint mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.8 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <span className="data-label text-[9px] text-faint">SCROLL</span>
            <ChevronDown className="w-4 h-4 text-faint scroll-bounce" />
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ MARQUEE TICKER */}
      <Ticker />

      {/* ══════════════════════════════════════════════════════ SIGNAL WAVE INTERLUDE */}
      <section className="relative py-8 border-t border-line overflow-hidden bg-void">
        <div className="max-w-grid mx-auto px-7">
          <Reveal y={16}>
            <div className="flex items-center justify-between mb-4">
              <p className="data-label text-[10px] text-faint">TRANSACTION SIGNAL OVER TIME</p>
              <p className="data-label text-[10px] text-faint">60-day window · live detection</p>
            </div>
            <SignalWave width={1200} height={140} className="w-full h-auto max-w-full" />
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ NUMBERED CALLOUTS */}
      <section ref={calloutsRef} className="relative py-28 border-t border-line overflow-hidden">
        {/* Parallax background orb */}
        <ParallaxLayer speed={0.2} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 right-0 w-[400px] h-[400px] -translate-y-1/2 rounded-full bg-caution/5 blur-[140px]" />
        </ParallaxLayer>

        <div className="relative max-w-grid mx-auto px-7">
          {/* Section heading — slower parallax than the cards */}
          <motion.div style={{ y: calloutsHeadY }}>
            <Reveal>
              <p className="data-label text-[11px] text-cobalt mb-4">What Pulse does</p>
              <h2 className="h2 max-w-3xl">Three questions,<br />answered before they hurt.</h2>
            </Reveal>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line mt-16 border border-line">
            {callouts.map((c, i) => (
              <Reveal key={c.n} delay={i * 0.1}>
                <div className="group bg-bg h-full p-9 md:p-10 transition-all duration-500 hover:bg-surface relative overflow-hidden">
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[2px] scale-y-0 group-hover:scale-y-100 transition-transform duration-500 origin-top"
                    style={{ background: c.color }}
                  />
                  <div
                    className="absolute -bottom-4 -right-2 font-narrow text-[7rem] font-black tabular-nums select-none pointer-events-none opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500"
                    style={{ color: c.color }}
                  >
                    {c.n}
                  </div>
                  <div className="flex items-start justify-between mb-10">
                    <span className="font-narrow text-5xl font-bold tabular-nums" style={{ color: c.color }}>
                      {c.n}
                    </span>
                    <c.icon className="w-6 h-6 transition-all duration-400 group-hover:scale-110" style={{ color: c.color }} strokeWidth={1.5} />
                  </div>
                  <h3 className="h3 mb-4">{c.title}</h3>
                  <p className="text-muted leading-relaxed">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ PIN-SCROLL STORY */}
      {/* 5-step sticky storytelling: "How Pulse works" inline journey */}
      <StorySection />

      {/* ══════════════════════════════════════════════════════ 5-TAB PROPOSITIONS */}
      <section className="relative py-28 border-t border-line bg-void">
        <div className="max-w-grid mx-auto px-7">
          <Reveal>
            <p className="data-label text-[11px] text-cobalt mb-4">Why it holds up</p>
            <h2 className="h2 max-w-3xl">Built to be trusted,<br />not just impressive.</h2>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-line mt-16 border border-line">
            {/* Tab rail */}
            <div className="lg:col-span-4 bg-bg">
              {props.map((p, i) => (
                <button
                  key={p.key}
                  data-testid={`prop-tab-${p.key.toLowerCase()}`}
                  onClick={() => setTab(i)}
                  className={`w-full text-left px-8 py-6 border-b border-line last:border-b-0 flex items-center justify-between group transition-all duration-300 ${
                    tab === i ? "bg-surface" : "hover:bg-surface/40"
                  }`}
                >
                  <span className="flex items-center gap-5">
                    <span className={`data-label text-[10px] font-mono tabular-nums ${tab === i ? "text-cobalt" : "text-faint"}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className={`font-display font-bold text-lg transition-colors ${tab === i ? "text-ink" : "text-muted"}`}>
                      {p.key}
                    </span>
                  </span>
                  <motion.div
                    animate={{ x: tab === i ? 0 : -8, opacity: tab === i ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ArrowUpRight className="w-4 h-4 text-cobalt" />
                  </motion.div>
                </button>
              ))}
            </div>

            {/* Tab panel */}
            <div className="lg:col-span-8 bg-bg p-10 md:p-14 flex flex-col justify-center min-h-[360px] relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  {React.createElement(props[tab].icon, { className: "w-8 h-8 text-cobalt mb-8", strokeWidth: 1.5 })}
                  <h3 className="font-display font-extrabold text-3xl md:text-4xl tracking-tight mb-6">
                    {props[tab].title}
                  </h3>
                  <p className="text-lg text-muted leading-relaxed max-w-xl">{props[tab].body}</p>
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 grid-lines opacity-20 pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ WASTE GRID */}
      <section className="relative py-28 border-t border-line">
        <div className="max-w-grid mx-auto px-7">
          <Reveal>
            <p className="data-label text-[11px] text-caution mb-4">The gap today</p>
            <h2 className="h2 max-w-3xl">This signal exists.<br />It just goes to waste.</h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-16">
            {wasteGrid.map((w, i) => (
              <Reveal key={w.title} delay={i * 0.08}>
                <div className="card rounded-card h-full p-8 group cursor-expand card-lift relative overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: `radial-gradient(circle at 30% 30%, ${w.color}12, transparent 70%)` }}
                  />
                  <w.icon className="w-7 h-7 mb-8 transition-transform duration-400 group-hover:scale-110" style={{ color: w.color }} strokeWidth={1.5} />
                  <h3 className="font-display font-bold text-xl mb-3 leading-tight">{w.title}</h3>
                  <p className="text-muted leading-relaxed text-[15px]">{w.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15}>
            <div className="mt-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-t border-line pt-10">
              <p className="text-xl md:text-2xl font-display font-semibold max-w-2xl tracking-tight">
                Pulse turns that wasted signal into a warning you can act on — in time.
              </p>
              <MagneticButton>
                <button data-testid="waste-cta" onClick={() => nav("/signup")} className="btn btn-cobalt shrink-0">
                  <span>Get started</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </MagneticButton>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ CINEMATIC CLOSER */}
      <section className="relative py-24 border-t border-line bg-void overflow-hidden">
        <div className="absolute inset-0 grid-lines opacity-30" />
        <ParallaxLayer speed={-0.1} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-cobalt/8 blur-[100px]" />
        </ParallaxLayer>
        <div className="relative max-w-grid mx-auto px-7 text-center">
          <Reveal>
            <p className="data-label text-[11px] text-cobalt mb-8">The Pulse principle</p>
          </Reveal>
          <Reveal delay={0.1} y={40}>
            <blockquote className="display-xl text-ink">
              Signal first.
              <span className="text-muted"> Verdict second.</span>
              <br />
              <span className="text-faint">Human always last.</span>
            </blockquote>
          </Reveal>
          <Reveal delay={0.3} y={20}>
            <div className="mt-12 flex flex-wrap justify-center gap-4">
              <MagneticButton>
                <button onClick={() => nav("/how-it-works")} className="btn btn-cobalt">
                  <span>See how it works</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </MagneticButton>
              <MagneticButton>
                <button onClick={() => nav("/research-report")} className="btn">
                  <span>Read the research</span>
                </button>
              </MagneticButton>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
