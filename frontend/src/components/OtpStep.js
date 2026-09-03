import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import OtpInput from "./OtpInput";

// Shared OTP step — used by Signup, Login, and ForgotPassword flows.
export function OtpStep({ identifier, identifierLabel = "phone", otp, setOtp, onVerify, onResend, seconds, loading, onBack, title, subtitle }) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35 }}>
      <button onClick={onBack} className="flex items-center gap-2 text-muted hover:text-ink transition-colors mb-8 data-label text-[11px]">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <p className="data-label text-[11px] text-cobalt mb-3">One-time code</p>
      <h1 className="font-display font-extrabold text-4xl tracking-tight mb-3">{title}</h1>
      <p className="text-muted mb-8 leading-relaxed">
        {subtitle || `We sent a 6-digit SMS code to`} <span className="text-ink font-medium">{identifier}</span>. It expires in 2 minutes.
      </p>

      <OtpInput value={otp} onChange={setOtp} onComplete={onVerify} disabled={loading} />

      <div className="flex items-center justify-between mt-8">
        <div className="data-label text-[11px] text-muted">
          {seconds > 0 ? (
            <span>Expires in <span className="text-ink tabular-nums">0:{String(seconds).padStart(2, "0")}</span></span>
          ) : (
            <span className="text-caution">Code expired</span>
          )}
        </div>
        <button
          data-testid="otp-resend"
          onClick={onResend}
          disabled={seconds > 0}
          className="flex items-center gap-2 data-label text-[11px] disabled:opacity-40 disabled:cursor-not-allowed text-cobalt hover:opacity-80 transition-opacity"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Resend code
        </button>
      </div>

      <button data-testid="otp-verify" onClick={() => onVerify(otp)} disabled={otp.length !== 6 || loading} className="btn btn-cobalt w-full justify-center mt-8">
        {loading ? "Verifying…" : "Verify"} <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
