import React from "react";
import { Check, X } from "lucide-react";

// Mirrors auth-svc check_password_complexity exactly.
export const passwordRules = [
  { id: "len", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "num", label: "One number", test: (p) => /\d/.test(p) },
  {
    id: "special",
    label: "One special character",
    test: (p) => /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(p),
  },
];

export const passwordValid = (p) => passwordRules.every((r) => r.test(p));

export default function PasswordChecklist({ password }) {
  return (
    <ul data-testid="password-checklist" className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
      {passwordRules.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.id} data-testid={`pw-rule-${r.id}`} className="flex items-center gap-2 text-[13px] transition-colors duration-200">
            <span
              className={`flex items-center justify-center w-4 h-4 shrink-0 border transition-colors duration-200 ${
                ok ? "bg-safe/15 border-safe text-safe" : "border-ink/25 text-faint"
              }`}
            >
              {ok ? <Check className="w-3 h-3" strokeWidth={3} /> : <X className="w-3 h-3" strokeWidth={2.5} />}
            </span>
            <span className={ok ? "text-ink" : "text-muted"}>{r.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
