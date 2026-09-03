/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0C10",
        void: "#000000",
        surface: "#101319",
        "surface-2": "#161b25",
        line: "rgba(253,251,247,0.10)",
        ink: "#FDFBF7",
        muted: "rgba(253,251,247,0.60)",
        faint: "rgba(253,251,247,0.38)",
        cobalt: "#0E76FF",
        safe: "#00E676",
        caution: "#FFB300",
        critical: "#F44336",
        seasonal: "#64D2C9",
        grey: "#6B7280",
        lime: "#C0FE04",
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        body: ['Archivo', 'system-ui', 'sans-serif'],
        narrow: ['"Archivo Narrow"', 'Archivo', 'sans-serif'],
        stat: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      letterSpacing: {
        label: "0.12em",
        wide: "0.06em",
      },
      borderRadius: {
        card: "4px",
        sm: "2px",
      },
      transitionTimingFunction: {
        micro: "cubic-bezier(0.25,1,0.5,1)",
        expo: "cubic-bezier(0.16,1,0.3,1)",
        spring: "cubic-bezier(0.34,1.56,0.64,1)",
        out: "cubic-bezier(0.22,1,0.36,1)",
      },
      maxWidth: {
        grid: "1440px",
      },
      boxShadow: {
        glow: "0 0 40px rgba(14,118,255,0.25)",
        "glow-safe": "0 0 40px rgba(0,230,118,0.20)",
        "glow-lime": "0 0 40px rgba(192,254,4,0.30)",
        "glow-caution": "0 0 40px rgba(255,179,0,0.20)",
      },
    },
  },
  plugins: [],
};
