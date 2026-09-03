// Shared phone validation — mirrors auth-svc normalise_phone + is_valid_phone.
// Strips spaces/dashes/parens then checks E.164 format (+, 7-15 digits).
export function isValidPhone(phone) {
  return /^\+[1-9]\d{6,14}$/.test(phone.replace(/[\s\-()]/g, ""));
}
