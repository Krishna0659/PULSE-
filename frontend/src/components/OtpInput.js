import React, { useRef, useEffect } from "react";

// 6-digit OTP input with auto-advance, paste support and auto-submit.
export default function OtpInput({ value, onChange, onComplete, disabled }) {
  const refs = useRef([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setDigit = (i, d) => {
    const next = value.split("");
    next[i] = d;
    const joined = next.join("").slice(0, 6);
    onChange(joined);
    return joined;
  };

  const handleChange = (i, e) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) { setDigit(i, ""); return; }
    const d = raw[raw.length - 1];
    const joined = setDigit(i, d);
    if (i < 5) refs.current[i + 1]?.focus();
    if (joined.length === 6 && !joined.includes("")) onComplete?.(joined);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    onChange(pasted);
    const idx = Math.min(pasted.length, 5);
    refs.current[idx]?.focus();
    if (pasted.length === 6) onComplete?.(pasted);
  };

  return (
    <div className="flex gap-2.5 sm:gap-3" onPaste={handlePaste} data-testid="otp-input">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          data-testid={`otp-digit-${i}`}
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={`otp-box ${value[i] ? "filled" : ""}`}
        />
      ))}
    </div>
  );
}
