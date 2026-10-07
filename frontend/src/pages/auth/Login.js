import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Mail } from "lucide-react";
import AuthLayout from "../../components/AuthLayout";
import { OtpStep } from "../../components/OtpStep";
import useCountdown from "../../hooks/useCountdown";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import { authApi, apiError } from "../../lib/api";
import { maskEmail } from "../../lib/utils";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const { login } = useAuth();
  const { seconds, start } = useCountdown(0);

  const [step, setStep] = useState(0); // 0 creds, 1 verify-account
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");
  const [identifier, setIdentifier] = useState(loc.state?.email || loc.state?.phone_number || "");
  const [password, setPassword] = useState("");

  const credsValid = identifier.trim().length > 0 && password.length > 0;

  const submitCreds = async (e) => {
    e.preventDefault();
    if (!credsValid) return;
    setLoading(true);
    try {
      const { data } = await authApi.login(identifier.trim(), password);
      if (data?.token) {
        login(data, data.email || identifier);
        toast.success("Welcome back!");
        nav("/dashboard");
        return;
      }
      toast.success("Credentials verified. Check your email for a verification code.");
      setStep(1);
      start(120);
    } catch (err) {
      const httpStatus = err?.response?.status;
      if (httpStatus === 403) {
        // Account exists but email is unverified
        toast.info("This account isn't verified yet. Enter the verification code sent to your email.");
        try {
          await authApi.signupResend(identifier.trim());
        } catch (_) {}
        setStep(1);
        start(120);
      } else {
        toast.error(apiError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyAccount = async (code) => {
    setLoading(true);
    try {
      await authApi.signupVerify(identifier.trim(), code);
      toast.success("Email verified! You can now log in.");
      setStep(0);
      setOtp("");
    } catch (err) {
      toast.error(apiError(err));
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const resendAccount = async () => {
    try {
      await authApi.signupResend(identifier.trim());
      toast.info("A fresh verification code is on its way to your email.");
      start(120);
      setOtp("");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <AuthLayout step={step === 0 ? 0 : 1} steps={["Credentials", "Verify"]}>
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="creds" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35 }}>
            <p className="data-label text-[11px] text-cobalt mb-3">Welcome back</p>
            <h1 className="font-display font-extrabold text-4xl tracking-tight mb-2">Log in to Pulse.</h1>
            <p className="text-muted mb-8">New here? <Link to="/signup" className="text-cobalt hover:underline">Create an account</Link></p>

            <form onSubmit={submitCreds} className="space-y-5" data-testid="login-form">
              <div>
                <label className="data-label text-[11px] text-muted block mb-2">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-faint absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    data-testid="login-email"
                    type="text"
                    className="field pl-11 pr-4 py-2.5 w-full"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="ada@example.com"
                    required
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="data-label text-[11px] text-muted">Password</label>
                  <Link to="/forgot-password" data-testid="forgot-link" className="data-label text-[11px] text-cobalt hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <input
                    data-testid="login-password"
                    autoComplete="current-password"
                    type={showPw ? "text" : "password"}
                    className="field pl-4 pr-11 py-2.5 w-full"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-faint hover:text-ink">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button data-testid="login-submit" type="submit" disabled={!credsValid || loading} className="btn btn-cobalt w-full justify-center">
                {loading ? "Signing in…" : "Sign in"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}

        {step === 1 && (
          <OtpStep
            key="verify-otp"
            identifier={identifier}
            maskedIdentifier={maskEmail(identifier)}
            otp={otp}
            setOtp={setOtp}
            onVerify={verifyAccount}
            onResend={resendAccount}
            seconds={seconds}
            loading={loading}
            onBack={() => setStep(0)}
            title="Verify your email"
            subtitle={
              <>
                Your account needs verification. Enter the 6-digit code sent to{" "}
                <span className="text-ink font-medium">{maskEmail(identifier)}</span>.
              </>
            }
          />
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
