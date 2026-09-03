import { useState, useRef, useCallback, useEffect } from "react";

// Countdown in seconds. start(n) resets to n and ticks to 0.
export default function useCountdown(initial = 0) {
  const [seconds, setSeconds] = useState(initial);
  const ref = useRef(null);

  const clear = useCallback(() => {
    if (ref.current) { clearInterval(ref.current); ref.current = null; }
  }, []);

  const start = useCallback((n) => {
    clear();
    setSeconds(n);
    ref.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(ref.current); ref.current = null; return 0; }
        return s - 1;
      });
    }, 1000);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { seconds, start, clear, active: seconds > 0 };
}
