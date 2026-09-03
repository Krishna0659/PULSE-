import React from "react";
import { Link } from "react-router-dom";
import { Activity, Phone, Mail, ArrowUpRight } from "lucide-react";
import CharReveal from "./CharReveal";
import MagneticButton from "./MagneticButton";
import Reveal from "./Reveal";

export default function Footer() {
  return (
    <footer data-testid="footer" className="relative border-t border-line bg-void overflow-hidden">
      {/* Grid lines */}
      <div className="absolute inset-0 grid-lines opacity-20" />
      {/* Glow accent */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] rounded-full bg-cobalt/6 blur-[80px] pointer-events-none" />

      {/* ── Large editorial quote ── */}
      <div className="relative max-w-grid mx-auto px-7 py-20 md:py-28 border-b border-line">
        <Reveal>
          <p className="data-label text-[10px] text-cobalt mb-6">The Pulse thesis</p>
        </Reveal>
        <blockquote
          data-testid="footer-quote"
          className="font-display font-extrabold tracking-tight leading-[1.02] text-3xl md:text-5xl lg:text-6xl max-w-5xl"
        >
          <CharReveal
            text="The signal was always"
            mode="words"
            delay={0}
            stagger={0.05}
          />
          {" "}
          <CharReveal
            text="in the data."
            mode="words"
            delay={0.35}
            stagger={0.06}
          />
          <span className="text-muted">
            {" "}
            <CharReveal
              text="We just finally stopped to listen."
              mode="words"
              delay={0.65}
              stagger={0.04}
            />
          </span>
        </blockquote>
      </div>

      {/* ── Links grid ── */}
      <div className="relative max-w-grid mx-auto px-7 py-16 grid grid-cols-1 md:grid-cols-12 gap-10">
        {/* Brand column */}
        <div className="md:col-span-5">
          <Reveal>
            <div className="flex items-center gap-2.5 mb-5">
              <span className="flex items-center justify-center w-8 h-8 border border-ink/70">
                <Activity className="w-4 h-4 text-cobalt" strokeWidth={2.5} />
              </span>
              <span className="font-display font-extrabold text-lg">PULSE</span>
            </div>
            <p className="text-muted max-w-sm leading-relaxed">
              AI-powered payment anomaly detection. Distress, breakout, fraud, or
              just the season — named, explained, and gated behind a human.
            </p>
          </Reveal>
        </div>

        {/* Contact column */}
        <div className="md:col-span-4">
          <Reveal delay={0.05}>
            <p className="data-label text-[10px] text-faint mb-5">Contact</p>
            <div className="space-y-4">
              <MagneticButton className="block">
                <a
                  data-testid="footer-phone"
                  href="tel:+917307379811"
                  className="flex items-center gap-3 group text-ink hover:text-cobalt transition-colors duration-200"
                >
                  <Phone className="w-4 h-4" />
                  <span className="font-narrow tracking-wide text-lg">+91 7307379811</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </MagneticButton>
              <MagneticButton className="block">
                <a
                  data-testid="footer-email"
                  href="mailto:gaur54827@gmail.com"
                  className="flex items-center gap-3 group text-ink hover:text-cobalt transition-colors duration-200"
                >
                  <Mail className="w-4 h-4" />
                  <span className="font-narrow tracking-wide text-lg">gaur54827@gmail.com</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </MagneticButton>
            </div>
          </Reveal>
        </div>

        {/* Nav column */}
        <div className="md:col-span-3">
          <Reveal delay={0.1}>
            <p className="data-label text-[10px] text-faint mb-5">Navigate</p>
            <ul className="space-y-3">
              {[
                { to: "/", label: "Home" },
                { to: "/research-report", label: "3D Research Report" },
                { to: "/how-it-works", label: "How it works" },
                { to: "/dashboard", label: "Live dashboard" },
                { to: "/signup", label: "Get started" },
              ].map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="group inline-flex items-center gap-1.5 text-muted hover:text-ink transition-colors duration-200"
                  >
                    {l.label}
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="relative max-w-grid mx-auto px-7 py-6 border-t border-line flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="data-label text-[10px] text-faint">© {new Date().getFullYear()} Pulse — Razorpay "Open" build</p>
        <p className="data-label text-[10px] text-faint">Recommends only. A human always decides.</p>
      </div>
    </footer>
  );
}
