import React, { useEffect, useRef, useState } from "react";

// "Continue with Google" — wired to Google Identity Services.
// Reads REACT_APP_GOOGLE_CLIENT_ID; when absent the button explains that
// credentials aren't plugged in yet (the /auth/google flow is ready either way).
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

export default function GoogleButton({ onCredential, onInfo, label = "Continue with Google" }) {
  const [loaded, setLoaded] = useState(false);
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) return;
    if (window.google?.accounts?.id) { setLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => {
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp) => cbRef.current?.(resp.credential),
      });
      setLoaded(true);
    };
    document.body.appendChild(s);
  }, []);

  const handleClick = () => {
    if (!CLIENT_ID || !loaded) {
      onInfo?.("Google Sign-In isn't configured yet — set REACT_APP_GOOGLE_CLIENT_ID and the /auth/google flow will light up.");
      return;
    }
    window.google.accounts.id.prompt();
  };

  return (
    <button
      type="button"
      data-testid="google-btn"
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-3 border border-ink/18 bg-void hover:bg-surface py-3.5 transition-colors duration-200"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
      </svg>
      <span className="font-narrow uppercase tracking-label text-[13px]">{label}</span>
    </button>
  );
}
