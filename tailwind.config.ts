// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef6ff",
          100: "#d9eaff",
          200: "#b7d5ff",
          300: "#8fbaff",
          400: "#5e98ff",
          500: "#3b82f6",   // primary
          600: "#2f6fd4",
          700: "#2559aa",
          800: "#204a8a",
          900: "#1d3f73",
        },
        ink: {
          700: "#0f172a",   // headings
          500: "#334155",   // body
          300: "#94a3b8",   // subtext
        }
      },
      boxShadow: {
        card: "0 6px 24px -8px rgba(15,23,42,.12), 0 2px 6px rgba(15,23,42,.04)",
        soft: "0 1px 2px rgba(15,23,42,.06)",
      },
      borderRadius: { xl2: "1.25rem" },
      backdropBlur: { xs: "2px" }
    }
  }
};