import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi } from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("pulse_token"));
  const [role, setRole] = useState(() => localStorage.getItem("pulse_role"));
  const [merchantId, setMerchantId] = useState(() => localStorage.getItem("pulse_merchant_id"));
  const [phoneNumber, setPhoneNumber] = useState(() => localStorage.getItem("pulse_phone_number"));
  const [ready, setReady] = useState(false);

  const login = useCallback((data, userPhone) => {
    setToken(data.token);
    setRole(data.role);
    setMerchantId(data.merchant_id || null);
    localStorage.setItem("pulse_token", data.token);
    localStorage.setItem("pulse_role", data.role);
    if (data.merchant_id) localStorage.setItem("pulse_merchant_id", data.merchant_id);
    else localStorage.removeItem("pulse_merchant_id");
    if (userPhone) {
      setPhoneNumber(userPhone);
      localStorage.setItem("pulse_phone_number", userPhone);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null); setRole(null); setMerchantId(null); setPhoneNumber(null);
    localStorage.removeItem("pulse_token");
    localStorage.removeItem("pulse_role");
    localStorage.removeItem("pulse_merchant_id");
    localStorage.removeItem("pulse_phone_number");
    // clear legacy email key if present
    localStorage.removeItem("pulse_email");
  }, []);

  // Validate the stored token on boot.
  useEffect(() => {
    let alive = true;
    if (!token) { setReady(true); return; }
    authApi.me()
      .then((res) => {
        if (!alive) return;
        setRole(res.data.role);
        setMerchantId(res.data.merchant_id || null);
        setPhoneNumber(res.data.phone_number || null);
      })
      .catch(() => { /* keep local session; backend may be offline */ })
      .finally(() => alive && setReady(true));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = { token, role, merchantId, phoneNumber, ready, login, logout, isAuthed: !!token };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
