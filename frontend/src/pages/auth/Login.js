import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Phone } from "lucide-react";
import AuthLayout from "../../components/AuthLayout";
import { OtpStep } from "../../components/OtpStep";
import useCountdown from "../../hooks/useCountdown";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import { authApi, apiError } from "../../lib/api";
import { isValidPhone } from "../../lib/utils";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const { login } = useAuth();
  const { seconds, start } = useCountdown(0);

  const [step, setStep] = useState(0); // 0 creds, 1 login-otp, 2 verify-account
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(loc.state?.phone_number || "");
  const [password, setPassword] = useState("");

  const phoneValid = isValidPhone(phoneNumber);
  const credsValid = phoneValid && password.length > 0;

  const submitCreds = async (e) => {
    e.preventDefault();
    if (!credsValid) return;
    setLoading(true);
    try {
      const { data } = await authApi.login(phoneNumber, password);
      toast.success("Credentials verified. Check your phone for a login code.");
      setStep(1);
      start(120);
      setOtp(data?.dev_otp || "");
    } catch (err) {
      const httpStatus = err?.response?.status;
      if (httpStatus === 403) {
        // Account exists but phone is unverified
        toast.info("This account isn't verified yet. Enter the code we just sent to your phone.");
        try {
          const { data: resData } = await authApi.signupResend(phoneNumber);
          setOtp("");
          if (resData?.dev_otp) {
            setTimeout(() => setOtp(resData.dev_otp), 1000);
          }
        } catch (_) {}
        setStep(2);
        start(120);
      } else {
        toast.error(apiError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyLogin = async (code) => {
    setLoading(true);
    try {
      const { data } = await authApi.loginVerify(phoneNumber, code);
      login(data, phoneNumber);
      toast.success("Welcome back.");
      nav("/dashboard");
    } catch (err) {
      toast.error(apiError(err));
      setOtp("");
    } finally { setLoading(false); }
  };

  const verifyAccount = async (code) => {
    setLoading(true);
    try {
      await authApi.signupVerify(phoneNumber, code);
      toast.success("Phone verified — you can now log in.");
      setStep(0); setOtp("");
    } catch (err) {
      toast.error(apiError(err));
      setOtp("");
    } finally { setLoading(false); }
  };

  const resendLogin = async () => {
    try {
      const { data } = await authApi.login(phoneNumber, password);
      toast.info("A fresh login code is on its way to your phone.");
      start(120);
      setOtp("");
      if (data?.dev_otp) setTimeout(() => setOtp(data.dev_otp), 1000);
    } catch (err) { toast.error(apiError(err)); }
  };

  const resendAccount = async () => {
    try {
      const { data } = await authApi.signupResend(phoneNumber);
      toast.info("A fresh code is on its way to your phone.");
      start(120);
      setOtp(data?.dev_otp || "");
    } catch (err) { toast.error(apiError(err)); }
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
                <label className="data-label text-[11px] text-muted block mb-2">Phone number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-faint absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    data-testid="login-phone"
                    type="tel"
                    className="field pl-11"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <p className="text-[11px] text-faint mt-1">Include country code e.g. +91 for India</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="data-label text-[11px] text-muted">Password</label>
                  <Link to="/forgot-password" data-testid="forgot-link" className="data-label text-[11px] text-cobalt hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <input data-testid="login-password" autoComplete="current-password" type={showPw ? "text" : "password"} className="field pr-11" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-faint hover:text-ink">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button data-testid="login-submit" type="submit" disabled={!credsValid || loading} className="btn btn-cobalt w-full justify-center">
                {loading ? "Checking…" : "Continue"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}

        {step === 1 && (
          <OtpStep
            key="login-otp"
            identifier={phoneNumber}
            identifierLabel="phone"
            otp={otp} setOtp={setOtp}
            onVerify={verifyLogin}
            onResend={resendLogin}
            seconds={seconds}
            loading={loading}
            onBack={() => setStep(0)}
            title="Confirm it's you"
          />
        )}

        {step === 2 && (
          <OtpStep
            key="verify-otp"
            identifier={phoneNumber}
            identifierLabel="phone"
            otp={otp} setOtp={setOtp}
            onVerify={verifyAccount}
            onResend={resendAccount}
            seconds={seconds}
            loading={loading}
            onBack={() => setStep(0)}
            title="Verify your phone"
            subtitle="Your account needs verification. We sent a code to"
          />
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
