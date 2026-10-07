// Shared phone validation — mirrors auth-svc normalise_phone + is_valid_phone.
// Strips spaces/dashes/parens then checks E.164 format (+, 7-15 digits).
export function isValidPhone(phone) {
  if (!phone) return true; // optional
  return /^\+[1-9]\d{6,14}$/.test(phone.replace(/[\s\-()]/g, ""));
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

export function maskEmail(email) {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}***@${domain}`;
}

