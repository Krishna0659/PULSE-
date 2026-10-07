import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Eye, EyeOff, RefreshCw, Mail } from "lucide-react";
import AuthLayout from "../../components/AuthLayout";
import OtpInput from "../../components/OtpInput";
import PasswordChecklist, { passwordValid } from "../../components/PasswordChecklist";
import useCountdown from "../../hooks/useCountdown";
import { useToast } from "../../components/Toast";
import { authApi, apiError } from "../../lib/api";
import { isValidEmail, maskEmail } from "../../lib/utils";

export default function ForgotPassword() {
  const nav = useNavigate();
  const toast = useToast();
  const { seconds, start } = useCountdown(0);

  const [step, setStep] = useState(0); // 0 email, 1 otp+password
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPw, setNewPw] = useState("");

  const emailValid = isValidEmail(email);
  const canReset = otp.length === 6 && passwordValid(newPw);

  const sendCode = async (e) => {
    e.preventDefault();
    if (!emailValid) return;
    setLoading(true);
    try {
      await authApi.forgot(email.trim());
      toast.success("If that account exists, a reset code has been sent to your email.");
      setStep(1);
      start(120);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const doReset = async () => {
    if (!canReset) return;
    setLoading(true);
    try {
      await authApi.reset(email.trim(), otp, newPw);
      toast.success("Password reset! Log in with your new password.");
      nav("/login", { state: { email } });
    } catch (err) {
      toast.error(apiError(err));
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await authApi.forgot(email.trim());
      toast.info("A fresh reset code is on its way to your email.");
      start(120);
      setOtp("");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <AuthLayout step={step} steps={["Email", "Reset"]}>
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35 }}>
            <p className="data-label text-[11px] text-cobalt mb-3">Password reset</p>
            <h1 className="font-display font-extrabold text-4xl tracking-tight mb-2">Forgot your password?</h1>
            <p className="text-muted mb-8">Enter your account email address and we'll send a 6-digit reset code.</p>
            <form onSubmit={sendCode} className="space-y-5" data-testid="forgot-form">
              <div>
                <label className="data-label text-[11px] text-muted block mb-2">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-faint absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    data-testid="forgot-email"
                    type="email"
                    className="field pl-11 pr-4 py-2.5 w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ada@example.com"
                    required
                  />
                </div>
              </div>
              <button data-testid="forgot-submit" type="submit" disabled={!emailValid || loading} className="btn btn-cobalt w-full justify-center">
                {loading ? "Sending…" : "Send reset code"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
            <Link to="/login" className="flex items-center gap-2 text-muted hover:text-ink transition-colors mt-8 data-label text-[11px]">
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="reset" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35 }}>
            <button onClick={() => setStep(0)} className="flex items-center gap-2 text-muted hover:text-ink transition-colors mb-8 data-label text-[11px]">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-3 mb-3">
              <Mail className="w-5 h-5 text-cobalt" />
              <p className="data-label text-[11px] text-cobalt">Code sent to {maskEmail(email)}</p>
            </div>
            <h1 className="font-display font-extrabold text-4xl tracking-tight mb-6">Set a new password.</h1>

            <label className="data-label text-[11px] text-muted block mb-3">Reset code</label>
            <OtpInput value={otp} onChange={setOtp} disabled={loading} />
            <div className="flex items-center justify-between mt-4 mb-7">
              <span className="data-label text-[11px] text-muted">
                {seconds > 0 ? <>Expires in <span className="text-ink tabular-nums">{timeFormatted}</span></> : <span className="text-critical font-medium">Code expired</span>}
              </span>
              <button data-testid="reset-resend" onClick={resend} disabled={seconds > 60 || loading} className="flex items-center gap-2 data-label text-[11px] disabled:opacity-40 text-cobalt hover:opacity-80">
                <RefreshCw className="w-3.5 h-3.5" /> {seconds > 60 ? `Resend in ${seconds - 60}s` : "Resend"}
              </button>
            </div>

            <label className="data-label text-[11px] text-muted block mb-2">New password</label>
            <div className="relative">
              <input data-testid="reset-password" autoComplete="new-password" type={showPw ? "text" : "password"} className="field pl-4 pr-11 py-2.5 w-full" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••••" />
              <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-faint hover:text-ink">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordChecklist password={newPw} />

            <button data-testid="reset-submit" onClick={doReset} disabled={!canReset || loading} className="btn btn-cobalt w-full justify-center mt-8">
              {loading ? "Resetting…" : "Reset password"} <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
