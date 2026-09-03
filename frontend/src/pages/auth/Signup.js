import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Building2, Phone } from "lucide-react";
import AuthLayout from "../../components/AuthLayout";
import { OtpStep } from "../../components/OtpStep";
import PasswordChecklist, { passwordValid } from "../../components/PasswordChecklist";
import useCountdown from "../../hooks/useCountdown";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import { authApi, apiError } from "../../lib/api";
import { ROLES } from "../../lib/constants";
import { isValidPhone } from "../../lib/utils";

export default function Signup() {
  const nav = useNavigate();
  const toast = useToast();
  // eslint-disable-next-line no-unused-vars
  const { login } = useAuth();
  const { seconds, start } = useCountdown(0);

  const [step, setStep] = useState(0); // 0 form, 1 otp
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");

  const [form, setForm] = useState({
    name: "", phone_number: "", password: "", confirm_password: "",
    role: "merchant", merchant_name: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const formValid =
    form.name.trim().length > 0 &&
    isValidPhone(form.phone_number) &&
    passwordValid(form.password) &&
    form.password === form.confirm_password &&
    (form.role !== "merchant" || form.merchant_name.trim());

  const submitForm = async (e) => {
    e.preventDefault();
    if (!formValid) return;
    setLoading(true);
    try {
      const payload = { ...form };
      if (form.role !== "merchant") delete payload.merchant_name;
      const { data } = await authApi.signup(payload);
      toast.success("Account created. Check your phone for a 6-digit code.");
      if (data?.dev_otp) setOtp(data.dev_otp);
      setStep(1);
      start(120);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (code) => {
    setLoading(true);
    try {
      await authApi.signupVerify(form.phone_number, code);
      toast.success("Phone verified. You can log in now.");
      nav("/login", { state: { phone_number: form.phone_number } });
    } catch (err) {
      toast.error(apiError(err));
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      const { data } = await authApi.signupResend(form.phone_number);
      toast.info("A fresh code is on its way to your phone.");
      start(120);
      setOtp("");
      if (data?.dev_otp) {
        setTimeout(() => setOtp(data.dev_otp), 1000);
      }
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <AuthLayout step={step} steps={["Details", "Verify", "Done"]}>
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35 }}>
            <p className="data-label text-[11px] text-cobalt mb-3">Step 01 — Create account</p>
            <h1 className="font-display font-extrabold text-4xl tracking-tight mb-2">Start listening.</h1>
            <p className="text-muted mb-8">Already have an account? <Link to="/login" className="text-cobalt hover:underline">Log in</Link></p>

            <form onSubmit={submitForm} className="space-y-5" data-testid="signup-form">
              <div>
                <label className="data-label text-[11px] text-muted block mb-2">Full name</label>
                <input data-testid="signup-name" className="field" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ada Lovelace" />
              </div>
              <div>
                <label className="data-label text-[11px] text-muted block mb-2">Phone number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-faint absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    data-testid="signup-phone"
                    type="tel"
                    className="field pl-11"
                    value={form.phone_number}
                    onChange={(e) => set("phone_number", e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <p className="text-[11px] text-faint mt-1">Include country code e.g. +91 for India, +1 for US</p>
              </div>

              {/* role selector */}
              <div>
                <label className="data-label text-[11px] text-muted block mb-2">I am a…</label>
                <div className="grid grid-cols-3 gap-2" data-testid="signup-role">
                  {ROLES.map((r) => (
                    <button
                      type="button" key={r.id}
                      data-testid={`role-${r.id}`}
                      onClick={() => set("role", r.id)}
                      className={`px-3 py-3 text-left border transition-colors duration-200 ${
                        form.role === r.id ? "border-cobalt bg-cobalt/10" : "border-ink/14 hover:border-ink/30"
                      }`}
                    >
                      <span className="font-narrow uppercase tracking-label text-[11px] block">{r.label.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-faint mt-2">{ROLES.find((r) => r.id === form.role)?.desc}</p>
              </div>

              <AnimatePresence>
                {form.role === "merchant" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <label className="data-label text-[11px] text-muted block mb-2">Business name</label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-faint absolute left-4 top-1/2 -translate-y-1/2" />
                      <input data-testid="signup-merchant-name" className="field pl-11" value={form.merchant_name} onChange={(e) => set("merchant_name", e.target.value)} placeholder="Acme Payments Pvt Ltd" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="data-label text-[11px] text-muted block mb-2">Password</label>
                <div className="relative">
                  <input data-testid="signup-password" autoComplete="new-password" type={showPw ? "text" : "password"} className="field pr-11" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-faint hover:text-ink">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordChecklist password={form.password} />
              </div>

              <div>
                <label className="data-label text-[11px] text-muted block mb-2">Confirm password</label>
                <input data-testid="signup-confirm" autoComplete="new-password" type={showPw ? "text" : "password"} className="field" value={form.confirm_password} onChange={(e) => set("confirm_password", e.target.value)} placeholder="••••••••" />
                {form.confirm_password && form.password !== form.confirm_password && (
                  <p className="text-[12px] text-critical mt-2">Passwords don't match.</p>
                )}
              </div>

              <button data-testid="signup-submit" type="submit" disabled={!formValid || loading} className="btn btn-cobalt w-full justify-center">
                {loading ? "Creating…" : "Create account"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}

        {step === 1 && (
          <OtpStep
            key="otp"
            identifier={form.phone_number}
            identifierLabel="phone"
            otp={otp} setOtp={setOtp}
            onVerify={verify}
            onResend={resend}
            seconds={seconds}
            loading={loading}
            onBack={() => setStep(0)}
            title="Verify your phone"
          />
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}

