/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f8fb",
          100: "#eef2f7",
          200: "#dce4ee",
          300: "#c0cddc",
          400: "#8494a8",
          500: "#5a6b80",
          600: "#445366",
          700: "#344354",
          800: "#232e3c",
          900: "#141b24",
          950: "#0a0f16",
        },
        brand: {
          50: "#eefbf9",
          100: "#d5f5f0",
          200: "#acebe3",
          300: "#76d9cf",
          400: "#3fbfb3",
          500: "#22a399",
          600: "#1a837c",
          700: "#186963",
          800: "#175450",
          900: "#164643",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        chart: {
          teal: "#1a837c",
          sky: "#0284c7",
          mint: "#059669",
          amber: "#d97706",
          coral: "#e11d48",
          slate: "#64748b",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(10, 15, 22, 0.04), 0 4px 14px rgba(10, 15, 22, 0.04)",
        panel: "0 1px 2px rgba(10, 15, 22, 0.04), 0 10px 28px rgba(10, 15, 22, 0.06)",
        lift: "0 8px 28px rgba(10, 15, 22, 0.1)",
        glow: "0 0 0 1px rgba(26, 131, 124, 0.12), 0 12px 32px rgba(26, 131, 124, 0.14)",
        float: "0 20px 40px -12px rgba(10, 15, 22, 0.18)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "bar-grow": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "bar-rise": {
          "0%": { transform: "scaleY(0)", opacity: "0.4" },
          "100%": { transform: "scaleY(1)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.85" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "draw-ring": {
          "0%": { strokeDashoffset: "340" },
          "100%": { strokeDashoffset: "var(--ring-offset)" },
        },
        "orb-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(12px, -18px) scale(1.05)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in": "slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "bar-grow": "bar-grow 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "bar-rise": "bar-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        float: "float 4.5s ease-in-out infinite",
        "pulse-soft": "pulse-soft 3s ease-in-out infinite",
        "spin-slow": "spin-slow 18s linear infinite",
        "orb-drift": "orb-drift 10s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
