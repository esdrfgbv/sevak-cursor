/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b1326",
        surface: "#0b1326",
        "surface-bright": "#31394d",
        "surface-container-lowest": "#060e20",
        "surface-container-low": "#131b2e",
        "surface-container": "#171f33",
        "surface-container-high": "#222a3d",
        "surface-container-highest": "#2d3449",
        primary: "#adc6ff",
        "primary-container": "#4d8eff",
        "on-primary": "#002e6a",
        "on-surface": "#dae2fd",
        "on-surface-variant": "#c2c6d6",
        outline: "#8c909f",
        "outline-variant": "#424754",
        error: "#ffb4ab",
        yellow: "#f59e0b",
        green: "#10b981"
      },
      fontFamily: {
        headline: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"]
      },
      boxShadow: {
        tactical: "0 20px 50px rgba(0, 0, 0, 0.35)",
        glow: "0 0 30px rgba(173, 198, 255, 0.16)"
      },
      backgroundImage: {
        tactical: "radial-gradient(circle at top right, rgba(77, 142, 255, 0.18), transparent 35%), radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.12), transparent 25%)"
      }
    }
  },
  plugins: []
};
