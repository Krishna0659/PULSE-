import React, { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import MagneticButton from "./MagneticButton";

const NAV_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/dashboard", label: "Dashboard" },
];

export default function Navbar() {
  const { isAuthed, role, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activeLink = NAV_LINKS.find((l) => {
    if (l.end) return location.pathname === l.to;
    return location.pathname.startsWith(l.to);
  });
  const activeLabel = activeLink?.label || NAV_LINKS[0].label;

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-400 ${
        scrolled
          ? "bg-bg/88 backdrop-blur-2xl border-b border-line shadow-lg shadow-black/20"
          : "bg-transparent"
      }`}
      style={{ transition: "background-color 400ms, backdrop-filter 400ms, border-color 400ms" }}
    >
      <div className="max-w-grid mx-auto px-7 h-[72px] flex items-center justify-between gap-6">
        {/* ── Logo ── */}
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2.5 group shrink-0">
          <motion.span
            className="relative flex items-center justify-center w-8 h-8 border border-ink/70 overflow-hidden"
            whileHover={{ borderColor: "rgba(14,118,255,0.8)" }}
          >
            <Activity className="w-4 h-4 text-cobalt" strokeWidth={2.5} />
            {/* Pulse ring animation */}
            <motion.span
              className="absolute inset-0 rounded-sm border border-cobalt/0"
              animate={{ scale: [1, 1.6, 1], opacity: [0, 0.4, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
            />
          </motion.span>
          <span className="font-display font-extrabold text-lg tracking-tight">PULSE</span>
        </Link>

        {/* ── Glass Pill Nav (desktop) ── */}
        <nav
          className={
            "hidden md:flex items-center p-1 gap-0.5 " +
            "bg-white/[0.04] backdrop-blur-xl " +
            "border border-white/10 " +
            "rounded-full shadow-lg shadow-black/30"
          }
        >
          {NAV_LINKS.map((l) => {
            const isActive = activeLabel === l.label;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                data-testid={`nav-${l.label.toLowerCase().replace(/\s/g, "-")}`}
                className="relative px-4 py-1.5 rounded-full"
              >
                {isActive && (
                  <motion.div
                    layoutId="glass-pill"
                    className={
                      "absolute inset-0 rounded-full " +
                      "bg-cobalt/20 border border-cobalt/40 " +
                      "shadow-[0_0_14px_rgba(14,118,255,0.28)]"
                    }
                    transition={{ type: "spring", bounce: 0.22, duration: 0.5 }}
                  />
                )}
                <span
                  className={
                    "relative z-10 font-mono text-[12px] uppercase tracking-label transition-colors duration-200 " +
                    (isActive ? "text-cobalt font-bold" : "text-muted hover:text-ink")
                  }
                >
                  {l.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* ── Right actions (desktop) ── */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {isAuthed ? (
            <>
              <span className="data-label text-[10px] text-muted">{role}</span>
              <MagneticButton>
                <button
                  data-testid="nav-logout-btn"
                  onClick={() => { logout(); nav("/"); }}
                  className="btn py-2.5 px-5"
                >
                  <span>Log out</span>
                </button>
              </MagneticButton>
            </>
          ) : (
            <>
              <button
                data-testid="nav-login-btn"
                onClick={() => nav("/login")}
                className="nav-link font-mono text-[12px] uppercase tracking-label"
              >
                Log in
              </button>
              <MagneticButton>
                <button
                  data-testid="nav-signup-btn"
                  onClick={() => nav("/signup")}
                  className="btn btn-cobalt py-2.5 px-5"
                >
                  <span>Get started</span>
                </button>
              </MagneticButton>
            </>
          )}
        </div>

        {/* ── Mobile hamburger ── */}
        <button
          data-testid="nav-mobile-toggle"
          className="md:hidden p-2 relative"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
            {open ? <X className="w-6 h-6" /> : (
              <div className="flex flex-col gap-1.5 w-6">
                <motion.span animate={{ width: open ? "100%" : "100%" }} className="h-px bg-ink block" />
                <motion.span animate={{ width: open ? "75%" : "75%" }} className="h-px bg-ink block" />
                <motion.span animate={{ width: open ? "50%" : "50%" }} className="h-px bg-ink block" />
              </div>
            )}
          </motion.div>
        </button>
      </div>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden bg-bg/97 backdrop-blur-2xl border-b border-line overflow-hidden"
          >
            <div className="px-7 py-6 flex flex-col gap-1">
              {NAV_LINKS.map((l, i) => (
                <motion.div
                  key={l.to}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <NavLink
                    to={l.to}
                    end={l.end}
                    onClick={() => setOpen(false)}
                    data-testid={`nav-mobile-${l.label.toLowerCase().replace(/\s/g, "-")}`}
                    className={({ isActive }) =>
                      "block py-3 font-mono text-sm uppercase tracking-label " +
                      (isActive ? "text-cobalt font-bold" : "text-muted")
                    }
                  >
                    {l.label}
                  </NavLink>
                </motion.div>
              ))}
              <div className="h-px bg-line my-2" />
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.3 }}
                className="flex flex-col gap-3 pt-1"
              >
                {isAuthed ? (
                  <button
                    data-testid="nav-mobile-logout"
                    onClick={() => { logout(); nav("/"); setOpen(false); }}
                    className="btn w-full justify-center"
                  >
                    <span>Log out</span>
                  </button>
                ) : (
                  <>
                    <button
                      data-testid="nav-mobile-login"
                      onClick={() => { nav("/login"); setOpen(false); }}
                      className="btn"
                    >
                      <span>Log in</span>
                    </button>
                    <button
                      data-testid="nav-mobile-signup"
                      onClick={() => { nav("/signup"); setOpen(false); }}
                      className="btn btn-cobalt"
                    >
                      <span>Get started</span>
                    </button>
                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
